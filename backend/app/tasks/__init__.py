"""
Quanto Vale — Benchmark Updater Task
Tarefa agendada para atualização periódica dos benchmarks setoriais.

Executa via APScheduler no startup da aplicação.
Atualiza benchmarks anualmente (ou sob demanda).
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import List

from app.services.sector_analysis_service import (
    persist_sector_benchmark,
    SECTOR_CNAE_MAP,
)
from app.services.ibge_aggregates_service import (
    fetch_sector_revenue_average,
    fetch_sector_growth,
    fetch_sector_company_count,
    fetch_sector_value_added,
)
from app.utils.normalizers import safe_float, calculate_volatility

logger = logging.getLogger(__name__)


async def update_all_benchmarks() -> dict:
    """Atualiza benchmarks de todos os setores mapeados.

    Retorna relatório de atualização.
    """
    logger.info("[BENCHMARK UPDATER] Iniciando atualização de benchmarks...")
    start_time = datetime.now(timezone.utc)
    current_year = datetime.now().year

    report = {
        "total_sectors": len(SECTOR_CNAE_MAP),
        "updated": 0,
        "failed": 0,
        "skipped": 0,
        "errors": [],
    }

    for sector_name, cnae_code in SECTOR_CNAE_MAP.items():
        try:
            logger.info(f"[BENCHMARK UPDATER] Atualizando {sector_name} (CNAE {cnae_code})...")

            # Buscar dados de múltiplas fontes
            revenue_data = await fetch_sector_revenue_average(cnae_code)
            growth_data = await fetch_sector_growth(cnae_code)
            companies_data = await fetch_sector_company_count(cnae_code)
            vab_data = await fetch_sector_value_added(cnae_code)

            # Montar dados para persistência
            benchmark_data = {
                "revenue_avg": None,
                "growth_rate": None,
                "companies_total": None,
                "value_added": None,
                "volatility": None,
            }

            if revenue_data:
                benchmark_data["revenue_avg"] = revenue_data.get("average_revenue")

            if growth_data:
                benchmark_data["growth_rate"] = growth_data.get("cagr")
                if growth_data.get("annual_growths"):
                    benchmark_data["volatility"] = calculate_volatility(
                        growth_data["annual_growths"]
                    )

            if companies_data:
                benchmark_data["companies_total"] = companies_data.get("latest_count")

            if vab_data:
                benchmark_data["value_added"] = vab_data.get("latest_value_added")

            # Verificar se tem pelo menos algum dado
            has_data = any(v is not None for k, v in benchmark_data.items())
            if not has_data:
                logger.warning(f"[BENCHMARK UPDATER] Sem dados para {sector_name}")
                report["skipped"] += 1
                continue

            # Persistir — último ano disponível ou ano atual
            year = current_year
            if revenue_data and revenue_data.get("series"):
                available_years = list(revenue_data["series"].keys())
                if available_years:
                    year = max(available_years)

            await persist_sector_benchmark(cnae_code, year, benchmark_data)
            report["updated"] += 1

            # Throttle para não sobrecarregar API do IBGE
            await asyncio.sleep(1)

        except Exception as e:
            logger.error(f"[BENCHMARK UPDATER] Erro {sector_name}: {e}")
            report["failed"] += 1
            report["errors"].append(f"{sector_name}: {str(e)}")

    elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
    report["elapsed_seconds"] = round(elapsed, 2)

    logger.info(
        f"[BENCHMARK UPDATER] Concluído em {elapsed:.1f}s — "
        f"{report['updated']} atualizados, {report['failed']} falhas, "
        f"{report['skipped']} ignorados"
    )

    return report


async def update_single_benchmark(cnae_code: str) -> dict:
    """Atualiza benchmark de um setor específico."""
    try:
        revenue_data = await fetch_sector_revenue_average(cnae_code)
        growth_data = await fetch_sector_growth(cnae_code)
        companies_data = await fetch_sector_company_count(cnae_code)
        vab_data = await fetch_sector_value_added(cnae_code)

        benchmark_data = {
            "revenue_avg": revenue_data.get("average_revenue") if revenue_data else None,
            "growth_rate": growth_data.get("cagr") if growth_data else None,
            "companies_total": companies_data.get("latest_count") if companies_data else None,
            "value_added": vab_data.get("latest_value_added") if vab_data else None,
            "volatility": None,
        }

        if growth_data and growth_data.get("annual_growths"):
            benchmark_data["volatility"] = calculate_volatility(growth_data["annual_growths"])

        year = datetime.now().year
        if revenue_data and revenue_data.get("series"):
            available_years = list(revenue_data["series"].keys())
            if available_years:
                year = max(available_years)

        await persist_sector_benchmark(cnae_code, year, benchmark_data)

        return {"status": "ok", "cnae_code": cnae_code, "year": year, "data": benchmark_data}

    except Exception as e:
        logger.error(f"[BENCHMARK UPDATER] Erro {cnae_code}: {e}")
        return {"status": "error", "cnae_code": cnae_code, "error": str(e)}


async def cleanup_trash() -> dict:
    """Remove permanently analyses that have been in trash for > 30 days."""
    from app.core.database import async_session_maker
    from app.models.models import Analysis, Report
    from sqlalchemy import select, delete
    import os

    logger.info("[TRASH CLEANUP] Iniciando limpeza da lixeira...")
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    deleted_count = 0

    async with async_session_maker() as db:
        # Find analyses past retention period
        result = await db.execute(
            select(Analysis).where(
                Analysis.deleted_at.isnot(None),
                Analysis.deleted_at < cutoff,
            )
        )
        expired = result.scalars().all()

        for analysis in expired:
            # Clean up files
            if analysis.logo_path:
                from app.core.config import settings as _s
                logo_full = os.path.join(_s.UPLOADS_DIR, analysis.logo_path.lstrip("/"))
                if os.path.exists(logo_full):
                    try:
                        os.remove(logo_full)
                    except OSError:
                        pass
            for report in (await db.execute(
                select(Report).where(Report.analysis_id == analysis.id)
            )).scalars().all():
                if report.file_path and os.path.exists(report.file_path):
                    try:
                        os.remove(report.file_path)
                    except OSError:
                        pass

            await db.delete(analysis)
            deleted_count += 1

        if deleted_count > 0:
            await db.commit()

    logger.info(f"[TRASH CLEANUP] {deleted_count} análises expiradas removidas permanentemente.")
    return {"deleted": deleted_count}


def setup_scheduler(app):
    """Configura APScheduler para atualização periódica de benchmarks.

    Roda:
    - Uma vez no startup (após 60s de delay)
    - Semanalmente (domingo 03:00 UTC)
    - Limpeza da lixeira diariamente às 04:00 UTC
    """
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
        from apscheduler.triggers.date import DateTrigger
        from datetime import timedelta

        scheduler = AsyncIOScheduler()

        # Atualização semanal — domingos 03:00 UTC
        scheduler.add_job(
            update_all_benchmarks,
            CronTrigger(day_of_week="sun", hour=3, minute=0),
            id="benchmark_weekly_update",
            name="Atualização semanal de benchmarks IBGE",
            replace_existing=True,
        )

        # Limpeza da lixeira — diariamente 04:00 UTC
        scheduler.add_job(
            cleanup_trash,
            CronTrigger(hour=4, minute=0),
            id="trash_cleanup_daily",
            name="Limpeza diária da lixeira (30 dias)",
            replace_existing=True,
        )

        # Atualização inicial desabilitada — IBGE/SIDRA instável
        # scheduler.add_job(
        #     update_all_benchmarks,
        #     DateTrigger(run_date=datetime.now(timezone.utc) + timedelta(seconds=60)),
        #     id="benchmark_initial_update",
        #     name="Atualização inicial de benchmarks IBGE",
        #     replace_existing=True,
        # )

        scheduler.start()
        logger.info("[SCHEDULER] APScheduler configurado para benchmarks IBGE")
        return scheduler

    except ImportError:
        logger.warning("[SCHEDULER] APScheduler não instalado. Instale com: pip install apscheduler")
        return None
    except Exception as e:
        logger.error(f"[SCHEDULER] Erro ao configurar scheduler: {e}")
        return None
