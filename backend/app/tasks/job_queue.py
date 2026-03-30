"""
Valuora — Background Job Queue
Lightweight async job queue using asyncio + Redis for persistence.
Handles: heavy report generation, batch re-calcs, webhook delivery.
"""

import asyncio
import json
import logging
import traceback
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Coroutine, Dict, Optional

from app.core.redis import redis_client

logger = logging.getLogger(__name__)

PREFIX_JOB = "vl:job:"
PREFIX_QUEUE = "vl:queue:"
JOB_TTL = 86400  # 24h


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


# Registry of job handlers
_handlers: Dict[str, Callable[..., Coroutine]] = {}
# Active tasks (prevent GC)
_active_tasks: set = set()


def register_handler(name: str):
    """Decorator to register an async job handler."""
    def decorator(fn):
        _handlers[name] = fn
        return fn
    return decorator


async def enqueue_job(
    job_type: str,
    payload: Dict[str, Any],
    priority: int = 5,
) -> str:
    """Enqueue a background job. Returns job_id."""
    job_id = str(uuid.uuid4())
    job_data = {
        "id": job_id,
        "type": job_type,
        "payload": payload,
        "status": JobStatus.PENDING,
        "priority": priority,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "started_at": None,
        "completed_at": None,
        "result": None,
        "error": None,
    }
    try:
        await redis_client.set(
            f"{PREFIX_JOB}{job_id}",
            json.dumps(job_data, default=str),
            ex=JOB_TTL,
        )
        # Push to queue sorted by priority
        await redis_client.lpush(f"{PREFIX_QUEUE}{job_type}", job_id)
        logger.info(f"[JOB_QUEUE] Enqueued {job_type} job {job_id}")

        # Auto-process immediately via asyncio task
        task = asyncio.create_task(_process_job(job_id, job_type, payload))
        _active_tasks.add(task)
        task.add_done_callback(_active_tasks.discard)

    except Exception as e:
        logger.error(f"[JOB_QUEUE] Failed to enqueue job: {e}")
    return job_id


async def get_job_status(job_id: str) -> Optional[Dict]:
    """Get current status of a job."""
    try:
        data = await redis_client.get(f"{PREFIX_JOB}{job_id}")
        if data:
            return json.loads(data)
    except Exception as e:
        logger.warning(f"[JOB_QUEUE] Error reading job {job_id}: {e}")
    return None


async def _update_job(job_id: str, updates: Dict):
    """Update job data in Redis."""
    try:
        data = await redis_client.get(f"{PREFIX_JOB}{job_id}")
        if data:
            job = json.loads(data)
            job.update(updates)
            await redis_client.set(
                f"{PREFIX_JOB}{job_id}",
                json.dumps(job, default=str),
                ex=JOB_TTL,
            )
    except Exception as e:
        logger.warning(f"[JOB_QUEUE] Error updating job {job_id}: {e}")


async def _process_job(job_id: str, job_type: str, payload: Dict):
    """Process a single job."""
    handler = _handlers.get(job_type)
    if not handler:
        logger.error(f"[JOB_QUEUE] No handler registered for {job_type}")
        await _update_job(job_id, {
            "status": JobStatus.FAILED,
            "error": f"No handler for {job_type}",
        })
        return

    await _update_job(job_id, {
        "status": JobStatus.RUNNING,
        "started_at": datetime.now(timezone.utc).isoformat(),
    })

    try:
        result = await handler(**payload)
        await _update_job(job_id, {
            "status": JobStatus.COMPLETED,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "result": result,
        })
        logger.info(f"[JOB_QUEUE] Job {job_id} ({job_type}) completed.")
    except Exception as e:
        logger.error(f"[JOB_QUEUE] Job {job_id} ({job_type}) failed: {e}")
        await _update_job(job_id, {
            "status": JobStatus.FAILED,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "error": str(e),
            "traceback": traceback.format_exc()[:2000],
        })


# ─── Built-in Job Handlers ─────────────────────────────────

@register_handler("batch_revaluation")
async def handle_batch_revaluation(
    analysis_ids: list,
    user_id: str,
    **kwargs,
) -> Dict:
    """Re-run valuation engine for multiple analyses."""
    from app.core.database import async_session_maker
    from app.models.models import Analysis, AnalysisVersion, AnalysisStatus
    from app.core.valuation_engine.engine import run_valuation
    from app.core.cache import cache_set, valuation_key, CACHE_TTL_BENCHMARK
    from sqlalchemy import select

    results = {"updated": 0, "failed": 0, "errors": []}

    async with async_session_maker() as db:
        for aid in analysis_ids:
            try:
                analysis = (await db.execute(
                    select(Analysis).where(
                        Analysis.id == uuid.UUID(aid),
                        Analysis.deleted_at.is_(None),
                    )
                )).scalar_one_or_none()
                if not analysis:
                    results["errors"].append(f"{aid}: not found")
                    results["failed"] += 1
                    continue

                result = await asyncio.to_thread(
                    run_valuation,
                    revenue=float(analysis.revenue),
                    net_margin=analysis.net_margin,
                    sector=analysis.sector,
                    growth_rate=analysis.growth_rate,
                    debt=float(analysis.debt or 0),
                    cash=float(analysis.cash or 0),
                    founder_dependency=analysis.founder_dependency or 0.5,
                    projection_years=analysis.projection_years or 5,
                    ebitda=float(analysis.ebitda) if analysis.ebitda else None,
                    recurring_revenue_pct=analysis.recurring_revenue_pct or 0,
                    num_employees=analysis.num_employees or 0,
                    years_in_business=analysis.years_in_business or 3,
                )

                analysis.valuation_result = result
                analysis.equity_value = result["equity_value"]
                analysis.risk_score = result["risk_score"]
                analysis.maturity_index = result["maturity_index"]
                analysis.percentile = result["percentile"]
                analysis.status = AnalysisStatus.COMPLETED

                # Update cache
                await cache_set(valuation_key(aid), result, CACHE_TTL_BENCHMARK)
                results["updated"] += 1

            except Exception as e:
                results["failed"] += 1
                results["errors"].append(f"{aid}: {str(e)}")

        await db.commit()

    return results


@register_handler("generate_report_async")
async def handle_generate_report(
    analysis_id: str,
    user_id: str,
    plan: str = "essential",
    language: str = "en",
    **kwargs,
) -> Dict:
    """Generate a PDF report in the background."""
    from app.core.database import async_session_maker
    from app.models.models import Analysis, Report, User
    from sqlalchemy import select

    async with async_session_maker() as db:
        analysis = (await db.execute(
            select(Analysis).where(Analysis.id == uuid.UUID(analysis_id))
        )).scalar_one_or_none()

        if not analysis:
            return {"error": "Analysis not found"}

        # Trigger report generation (reuses existing report service)
        # This is a placeholder — actual PDF gen logic is in reports route
        return {
            "status": "completed",
            "analysis_id": analysis_id,
            "message": "Report generation queued",
        }
