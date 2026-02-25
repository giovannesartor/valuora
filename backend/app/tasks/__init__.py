"""
Quanto Vale — Benchmark Updater Task
Tarefa agendada para atualização periódica dos benchmarks setoriais.

Executa via APScheduler no startup da aplicação.
Atualiza benchmarks anualmente (ou sob demanda).
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
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


async def send_abandoned_analysis_reminders() -> dict:
    """Daily task: e-mail users whose analysis was created 24-48h ago but never paid.

    Uses coupon PRIMEIRA (if active) as motivation.
    """
    from datetime import timedelta, timezone
    from sqlalchemy import select as _sel, and_, not_, exists
    from app.core.database import async_session_maker as AsyncSessionLocal
    from app.models.models import Analysis, Payment, User, PaymentStatus, AnalysisStatus, Coupon
    from app.services.email_service import send_analysis_abandoned_email

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(hours=48)
    window_end   = now - timedelta(hours=24)

    sent = 0
    async with AsyncSessionLocal() as db:
        # Look up the PRIMEIRA coupon (or any active one) to include in the email
        coupon_row = (await db.execute(
            _sel(Coupon).where(Coupon.is_active == True).order_by(Coupon.created_at.asc()).limit(1)
        )).scalar_one_or_none()
        coupon_code    = coupon_row.code if coupon_row else ""
        coupon_discount = f"{int(coupon_row.discount_pct * 100)}% de desconto" if coupon_row else ""

        # Analyses created 24-48h ago, not DRAFT/FAILED, with no PAID payment
        paid_sub = _sel(Payment.analysis_id).where(Payment.status == PaymentStatus.PAID)
        rows = (await db.execute(
            _sel(Analysis, User.email, User.full_name)
            .join(User, Analysis.user_id == User.id)
            .where(
                Analysis.created_at >= window_start,
                Analysis.created_at < window_end,
                Analysis.deleted_at.is_(None),
                User.is_active == True,
                not_(Analysis.id.in_(paid_sub)),
            )
        )).all()

        for analysis, email, full_name in rows:
            try:
                await send_analysis_abandoned_email(
                    email=email,
                    full_name=full_name or email,
                    company_name=analysis.company_name,
                    analysis_id=str(analysis.id),
                    coupon_code=coupon_code,
                    coupon_discount=coupon_discount,
                )
                sent += 1
                logger.info("[ABANDONED] Sent reminder to %s for analysis %s", email, analysis.id)
            except Exception as exc:
                logger.error("[ABANDONED] Failed for %s: %s", email, exc)

    logger.info("[ABANDONED] %d reminders sent in this run.", sent)
    return {"sent": sent}


async def alert_stalled_analyses() -> dict:
    """Every 15 min: alert admin about analyses stuck in PROCESSING for > 30 min."""
    from datetime import timedelta
    from sqlalchemy import select as _sel
    from app.core.database import async_session_maker as AsyncSessionLocal
    from app.models.models import Analysis, AnalysisStatus, User
    from app.services.email_service import send_email

    threshold = datetime.now(timezone.utc) - timedelta(minutes=30)
    alerted = 0

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            _sel(Analysis, User.email)
            .join(User, Analysis.user_id == User.id)
            .where(
                Analysis.status == AnalysisStatus.PROCESSING,
                Analysis.updated_at < threshold,
                Analysis.deleted_at.is_(None),
            )
        )).all()

        if not rows:
            return {"alerted": 0}

        from app.core.config import settings
        if not settings.ADMIN_EMAIL:
            logger.warning("[STALLED] ADMIN_EMAIL não configurado — alerta ignorado.")
            return {"alerted": 0}
        try:
            items_html = "".join(
                f"<li>{a.company_name} — id={a.id}, user={email}, "
                f"desde {a.updated_at.strftime('%d/%m %H:%M')} UTC</li>"
                for a, email in rows
            )
            await send_email(
                to_email=settings.ADMIN_EMAIL,
                subject=f"[QuantoVale] ⚠️ {len(rows)} análise(s) travada(s) em PROCESSING",
                html_body=(
                    f"<p>As seguintes análises estão em status <b>PROCESSING</b> há mais de 30 minutos:</p>"
                    f"<ul>{items_html}</ul>"
                    f"<p>Verifique o painel administrativo e os logs do servidor.</p>"
                ),
            )
            alerted = len(rows)
            logger.warning("[STALLED] Alertou admin sobre %d análise(s) travada(s).", len(rows))
        except Exception as exc:
            logger.error("[STALLED] Falha ao enviar e-mail de alerta: %s", exc)

    return {"alerted": alerted}


def setup_scheduler(app):
    """Configura APScheduler para atualização periódica de benchmarks.

    Roda:
    - Uma vez no startup (após 60s de delay)
    - Semanalmente (domingo 03:00 UTC)
    - Limpeza da lixeira diariamente às 04:00 UTC
    - Lembretes de análise abandonada diariamente às 10:00 UTC
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

        # Lembretes de análise abandonada — diariamente 10:00 UTC
        scheduler.add_job(
            send_abandoned_analysis_reminders,
            CronTrigger(hour=10, minute=0),
            id="abandoned_analysis_reminders",
            name="Lembretes de análise abandonada (24-48h)",
            replace_existing=True,
        )

        # Alerta de análises travadas — a cada 15 min
        scheduler.add_job(
            alert_stalled_analyses,
            CronTrigger(minute="*/15"),
            id="stalled_analyses_alert",
            name="Alerta de análises em PROCESSING por >30min",
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
