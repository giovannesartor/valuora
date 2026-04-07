"""
Sidebar summary — single endpoint that consolidates all sidebar badge data.
Replaces N separate polling calls with 1.
"""
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.cache import cache_get, cache_set, CACHE_TTL_SHORT
from app.models.models import Analysis, AnalysisStatus, User, NotificationRead
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sidebar", tags=["Sidebar"])


@router.get("/summary")
async def sidebar_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Consolidated sidebar data — replaces multiple separate polling calls."""
    cache_key = f"vl:sidebar:{current_user.id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    user_id = current_user.id

    result = await db.execute(
        select(
            func.count().filter(Analysis.deleted_at.is_(None)).label("total"),
            func.count().filter(
                Analysis.deleted_at.is_(None),
                Analysis.status == AnalysisStatus.COMPLETED,
            ).label("completed"),
            func.count().filter(
                Analysis.deleted_at.is_(None),
                Analysis.status == AnalysisStatus.PROCESSING,
            ).label("processing"),
            func.count().filter(
                Analysis.deleted_at.isnot(None),
            ).label("trash"),
            func.max(Analysis.equity_value).filter(
                Analysis.deleted_at.is_(None),
                Analysis.status == AnalysisStatus.COMPLETED,
            ).label("max_value"),
            func.avg(Analysis.equity_value).filter(
                Analysis.deleted_at.is_(None),
                Analysis.status == AnalysisStatus.COMPLETED,
                Analysis.equity_value.isnot(None),
            ).label("avg_value"),
        ).where(Analysis.user_id == user_id)
    )
    row = result.one()

    # Unread notifications count
    notif_count = 0
    try:
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        recent_analyses = (await db.execute(
            select(func.count()).where(
                Analysis.user_id == user_id,
                Analysis.updated_at >= seven_days_ago,
                Analysis.status.in_([AnalysisStatus.COMPLETED, AnalysisStatus.PROCESSING]),
            )
        )).scalar() or 0
        read_count = (await db.execute(
            select(func.count()).where(
                NotificationRead.user_id == user_id,
                NotificationRead.created_at >= seven_days_ago,
            )
        )).scalar() or 0
        notif_count = max(0, recent_analyses - read_count)
    except Exception:
        pass

    data = {
        "total": row.total or 0,
        "completed": row.completed or 0,
        "processing": row.processing or 0,
        "trash": row.trash or 0,
        "max_value": float(row.max_value) if row.max_value else 0,
        "avg_value": float(row.avg_value) if row.avg_value else 0,
        "unread_notifications": notif_count,
    }

    await cache_set(cache_key, data, ttl=CACHE_TTL_SHORT)
    return data
