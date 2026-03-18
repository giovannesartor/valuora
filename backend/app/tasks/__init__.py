"""
Quanto Vale — Benchmark Updater Task
Scheduled task for periodic sector benchmark updates.

Runs via APScheduler on application startup.
Updates benchmarks annually (or on demand).
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
    """Update benchmarks for all mapped sectors.

    Returns update report.
    """
    logger.info("[BENCHMARK UPDATER] Starting benchmark update...")
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
            logger.info(f"[BENCHMARK UPDATER] Updating {sector_name} (CNAE {cnae_code})...")

            # Fetch data from multiple sources
            revenue_data = await fetch_sector_revenue_average(cnae_code)
            growth_data = await fetch_sector_growth(cnae_code)
            companies_data = await fetch_sector_company_count(cnae_code)
            vab_data = await fetch_sector_value_added(cnae_code)

            # Build data for persistence
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

            # Check if there is at least some data
            has_data = any(v is not None for k, v in benchmark_data.items())
            if not has_data:
                logger.warning(f"[BENCHMARK UPDATER] No data for {sector_name}")
                report["skipped"] += 1
                continue

            # Persist — latest available year or current year
            year = current_year
            if revenue_data and revenue_data.get("series"):
                available_years = list(revenue_data["series"].keys())
                if available_years:
                    year = max(available_years)

            await persist_sector_benchmark(cnae_code, year, benchmark_data)
            report["updated"] += 1

            # Throttle to avoid overloading IBGE API
            await asyncio.sleep(1)

        except Exception as e:
            logger.error(f"[BENCHMARK UPDATER] Error {sector_name}: {e}")
            report["failed"] += 1
            report["errors"].append(f"{sector_name}: {str(e)}")

    elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
    report["elapsed_seconds"] = round(elapsed, 2)

    logger.info(
        f"[BENCHMARK UPDATER] Completed in {elapsed:.1f}s — "
        f"{report['updated']} updated, {report['failed']} failed, "
        f"{report['skipped']} skipped"
    )

    return report


async def update_single_benchmark(cnae_code: str) -> dict:
    """Update benchmark for a specific sector."""
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
        logger.error(f"[BENCHMARK UPDATER] Error {cnae_code}: {e}")
        return {"status": "error", "cnae_code": cnae_code, "error": str(e)}


async def cleanup_trash() -> dict:
    """Remove permanently analyses that have been in trash for > 30 days."""
    from app.core.database import async_session_maker
    from app.models.models import Analysis, Report
    from sqlalchemy import select, delete
    import os

    logger.info("[TRASH CLEANUP] Starting trash cleanup...")
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

    logger.info(f"[TRASH CLEANUP] {deleted_count} expired analyses permanently removed.")
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
            logger.warning("[STALLED] ADMIN_EMAIL not configured — alert skipped.")
            return {"alerted": 0}
        try:
            items_html = "".join(
                f"<li>{a.company_name} — id={a.id}, user={email}, "
                f"desde {a.updated_at.strftime('%d/%m %H:%M')} UTC</li>"
                for a, email in rows
            )
            await send_email(
                to_email=settings.ADMIN_EMAIL,
                subject=f"[Valuora] ⚠️ {len(rows)} analysis(es) stuck in PROCESSING",
                html_body=(
                    f"<p>The following analyses have been in <b>PROCESSING</b> status for over 30 minutes:</p>"
                    f"<ul>{items_html}</ul>"
                    f"<p>Please check the admin panel and server logs.</p>"
                ),
            )
            alerted = len(rows)
            logger.warning("[STALLED] Alerted admin about %d stalled analysis(es).", len(rows))
        except Exception as exc:
            logger.error("[STALLED] Failed to send alert email: %s", exc)

    return {"alerted": alerted}


async def send_partner_followups() -> dict:
    """Daily task: automated follow-up for partner clients.

    - no_fill_3d: Client registered 3+ days ago, no analysis linked
    - report_7d: Report generated 7+ days ago, suggest review meeting
    - no_purchase_7d: Analysis completed 7+ days ago, not paid
    """
    from app.core.database import async_session_maker as AsyncSessionLocal
    from app.models.models import (
        PartnerClient, Partner, Analysis, Payment, User,
        FollowUpLog, FollowUpTrigger, AnalysisStatus, PaymentStatus,
    )
    from app.services.email_service import send_email

    now = datetime.now(timezone.utc)
    sent = 0

    async with AsyncSessionLocal() as db:
        # Fetch all active partners
        partners = (await db.execute(
            select(Partner, User.full_name, User.email)
            .join(User, Partner.user_id == User.id)
            .where(Partner.status == "active")
        )).all()

        for partner, partner_name, partner_email in partners:
            # Get partner's clients
            clients = (await db.execute(
                select(PartnerClient).where(PartnerClient.partner_id == partner.id)
            )).scalars().all()

            followup_items = []

            for client in clients:
                days_since_registration = (now - client.created_at).days

                # ── no_fill_3d: registered ≥3 days, no analysis ──
                if not client.analysis_id and days_since_registration >= 3:
                    # Check if we already sent this type
                    existing = (await db.execute(
                        select(FollowUpLog).where(
                            FollowUpLog.client_id == client.id,
                            FollowUpLog.trigger_type == FollowUpTrigger.NO_FILL_3D,
                        )
                    )).scalar_one_or_none()
                    if not existing:
                        msg = f"📋 {client.client_name} registered {days_since_registration} days ago but hasn't started their analysis."
                        followup_items.append((client, FollowUpTrigger.NO_FILL_3D, msg))

                # ── report_7d: report sent ≥7 days ago ──
                if client.data_status == "report_sent" and client.analysis_id:
                    analysis = (await db.execute(
                        select(Analysis).where(Analysis.id == client.analysis_id)
                    )).scalar_one_or_none()
                    if analysis and analysis.updated_at and (now - analysis.updated_at).days >= 7:
                        existing = (await db.execute(
                            select(FollowUpLog).where(
                                FollowUpLog.client_id == client.id,
                                FollowUpLog.trigger_type == FollowUpTrigger.REPORT_7D,
                            )
                        )).scalar_one_or_none()
                        if not existing:
                            msg = f"📊 {client.client_name}'s report was generated {(now - analysis.updated_at).days} days ago. Schedule a review meeting."
                            followup_items.append((client, FollowUpTrigger.REPORT_7D, msg))

                # ── no_purchase_7d: analysis complete ≥7 days, not paid ──
                if client.analysis_id:
                    analysis = (await db.execute(
                        select(Analysis).where(Analysis.id == client.analysis_id)
                    )).scalar_one_or_none()
                    if analysis and analysis.status == AnalysisStatus.COMPLETED:
                        is_paid = (await db.execute(
                            select(Payment).where(
                                Payment.analysis_id == analysis.id,
                                Payment.status == PaymentStatus.PAID,
                            )
                        )).scalar_one_or_none()
                        if not is_paid and analysis.created_at and (now - analysis.created_at).days >= 7:
                            existing = (await db.execute(
                                select(FollowUpLog).where(
                                    FollowUpLog.client_id == client.id,
                                    FollowUpLog.trigger_type == FollowUpTrigger.NO_PURCHASE_7D,
                                )
                            )).scalar_one_or_none()
                            if not existing:
                                msg = f"💰 {client.client_name}'s analysis is ready but not purchased ({(now - analysis.created_at).days} days). Offer an incentive."
                                followup_items.append((client, FollowUpTrigger.NO_PURCHASE_7D, msg))

            # Send consolidated email to partner
            if followup_items:
                items_html = "".join(
                    f"<li style='margin-bottom:8px'>{msg}</li>" for _, _, msg in followup_items
                )
                try:
                    await send_email(
                        to_email=partner_email,
                        subject=f"[Valuora] {len(followup_items)} client follow-up(s) need your attention",
                        html_body=(
                            f"<p>Hi {partner_name},</p>"
                            f"<p>Here are follow-up actions for your clients:</p>"
                            f"<ul>{items_html}</ul>"
                            f"<p>Log in to your <a href='https://valuora.com/partner/clients'>Partner Panel</a> to take action.</p>"
                            f"<p>— Valuora Team</p>"
                        ),
                    )
                    sent += len(followup_items)
                except Exception as exc:
                    logger.error("[FOLLOWUP] Failed to send to %s: %s", partner_email, exc)

                # Log follow-ups
                for client, trigger, msg in followup_items:
                    log = FollowUpLog(
                        client_id=client.id,
                        partner_id=partner.id,
                        trigger_type=trigger,
                        message=msg,
                    )
                    db.add(log)
                await db.commit()

    logger.info("[FOLLOWUP] %d follow-up(s) sent in this run.", sent)
    return {"sent": sent}


async def send_task_reminders() -> dict:
    """Daily task: email partners about tasks due today or overdue."""
    from app.core.database import async_session_maker as AsyncSessionLocal
    from app.models.models import ClientTask, PartnerClient, Partner, User
    from app.services.email_service import send_email

    now = datetime.now(timezone.utc)
    today_end = now.replace(hour=23, minute=59, second=59)
    sent = 0

    async with AsyncSessionLocal() as db:
        # Find tasks due today or overdue and not completed, not yet reminded
        from sqlalchemy import and_
        tasks_result = await db.execute(
            select(ClientTask, PartnerClient.client_name, Partner.user_id)
            .join(PartnerClient, ClientTask.client_id == PartnerClient.id)
            .join(Partner, ClientTask.partner_id == Partner.id)
            .where(
                ClientTask.is_completed == False,
                ClientTask.due_date.isnot(None),
                ClientTask.due_date <= today_end,
                ClientTask.reminder_sent == False,
            )
        )
        rows = tasks_result.all()

        # Group by partner
        partner_tasks = {}
        for task, client_name, partner_user_id in rows:
            if partner_user_id not in partner_tasks:
                partner_tasks[partner_user_id] = []
            partner_tasks[partner_user_id].append((task, client_name))

        for partner_user_id, items in partner_tasks.items():
            user = (await db.execute(
                select(User).where(User.id == partner_user_id)
            )).scalar_one_or_none()
            if not user:
                continue

            items_html = "".join(
                f"<li style='margin-bottom:8px'><strong>{client_name}</strong>: {task.title}"
                f" (due {task.due_date.strftime('%b %d')})</li>"
                for task, client_name in items
            )
            try:
                await send_email(
                    to_email=user.email,
                    subject=f"[Valuora] {len(items)} task(s) due today",
                    html_body=(
                        f"<p>Hi {user.full_name},</p>"
                        f"<p>You have tasks that need attention:</p>"
                        f"<ul>{items_html}</ul>"
                        f"<p>Log in to your <a href='https://valuora.com/partner/clients'>Partner Panel</a> to manage them.</p>"
                        f"<p>— Valuora Team</p>"
                    ),
                )
                sent += 1
            except Exception as exc:
                logger.error("[TASK REMINDER] Failed for %s: %s", user.email, exc)

            # Mark as reminded
            for task, _ in items:
                task.reminder_sent = True
            await db.commit()

    logger.info("[TASK REMINDER] %d reminder email(s) sent.", sent)
    return {"sent": sent}


def setup_scheduler(app):
    """Configure APScheduler for periodic benchmark updates.

    Runs:
    - Once on startup (after 60s delay)
    - Weekly (Sunday 03:00 UTC)
    - Trash cleanup daily at 04:00 UTC
    - Abandoned analysis reminders daily at 10:00 UTC
    - Automated partner follow-ups daily at 08:00 UTC
    - Overdue task reminders daily at 09:00 UTC
    """
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
        from apscheduler.triggers.date import DateTrigger
        from datetime import timedelta

        scheduler = AsyncIOScheduler()

        # Weekly update — Sundays 03:00 UTC
        scheduler.add_job(
            update_all_benchmarks,
            CronTrigger(day_of_week="sun", hour=3, minute=0),
            id="benchmark_weekly_update",
            name="Weekly IBGE benchmark update",
            replace_existing=True,
        )

        # Trash cleanup — daily 04:00 UTC
        scheduler.add_job(
            cleanup_trash,
            CronTrigger(hour=4, minute=0),
            id="trash_cleanup_daily",
            name="Daily trash cleanup (30 days)",
            replace_existing=True,
        )

        # Abandoned analysis reminders — daily 10:00 UTC
        scheduler.add_job(
            send_abandoned_analysis_reminders,
            CronTrigger(hour=10, minute=0),
            id="abandoned_analysis_reminders",
            name="Abandoned analysis reminders (24-48h)",
            replace_existing=True,
        )

        # Stalled analysis alerts — every 15 min
        scheduler.add_job(
            alert_stalled_analyses,
            CronTrigger(minute="*/15"),
            id="stalled_analyses_alert",
            name="Alert for analyses in PROCESSING >30min",
            replace_existing=True,
        )

        # Automated partner follow-ups — daily 08:00 UTC
        scheduler.add_job(
            send_partner_followups,
            CronTrigger(hour=8, minute=0),
            id="partner_followups_daily",
            name="Smart automated partner follow-ups",
            replace_existing=True,
        )

        # Task reminders — daily 09:00 UTC
        scheduler.add_job(
            send_task_reminders,
            CronTrigger(hour=9, minute=0),
            id="partner_task_reminders_daily",
            name="Overdue task reminders for partners",
            replace_existing=True,
        )

        # Initial update disabled — IBGE/SIDRA unstable
        # scheduler.add_job(
        #     update_all_benchmarks,
        #     DateTrigger(run_date=datetime.now(timezone.utc) + timedelta(seconds=60)),
        #     id="benchmark_initial_update",
        #     name="Initial IBGE benchmark update",
        #     replace_existing=True,
        # )

        scheduler.start()
        logger.info("[SCHEDULER] APScheduler configured for IBGE benchmarks")
        return scheduler

    except ImportError:
        logger.warning("[SCHEDULER] APScheduler not installed. Install with: pip install apscheduler")
        return None
    except Exception as e:
        logger.error(f"[SCHEDULER] Error configuring scheduler: {e}")
        return None
