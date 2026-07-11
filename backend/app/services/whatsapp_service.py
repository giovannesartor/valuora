"""Whatsmiau / Evolution API v2 — transactional WhatsApp notifications.

Configuration (Railway env vars):
    Whatsmiau_Secret_Key   — API key from Whatsmiau dashboard
    WHATSMIAU_INSTANCE     — Instance name created in Whatsmiau dashboard (must be connected)
"""
import re
import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

_BASE = "https://api.whatsmiau.dev/v2"

# Appended automatically to every outbound message except manual/admin events.
_AUTO_FOOTER = "\n\n_This is an automated message. Reply STOP to unsubscribe._"
_NO_FOOTER_EVENTS = {"auto_reply", "test", "weekly_report", "broadcast", "blacklist_optout"}

# ─── Default templates (seeded into DB on demand) ──────────────────────────────
# Variables: {nome}, {empresa}, {link}, {plano}, {valor}, {equity_value}, {resultado}, {parceiro}

DEFAULT_TEMPLATES = [
    {
        "event_type": "welcome",
        "text": (
            "🎉 Welcome to *Valuora*, {nome}!\n\n"
            "You can now start your company's valuation:\n"
            "👉 {link}\n\n"
            "If you have any questions, just reply here. 😊\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "charge_created",
        "text": (
            "Hello, {nome}! 👋\n\n"
            "We received your valuation request for *{empresa}*.\n\n"
            "Complete your payment to unlock your analysis:\n"
            "👉 {link}\n\n"
            "If you have any questions, just reply here. 😊\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "account_activation",
        "text": (
            "Hello, {nome}! 👋\n\n"
            "Your consultant *{parceiro}* has prepared the valuation for *{empresa}* for you.\n\n"
            "Set your password to access your account and view the analysis:\n"
            "👉 {link}\n\n"
            "If you have any questions, just reply here. 😊\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "payment_confirmed",
        "text": (
            "✅ Payment confirmed, {nome}!\n\n"
            "We are generating the valuation for *{empresa}* right now. 📊\n\n"
            "You will receive the report link here in a few minutes. ⏱️\n\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "report_ready",
        "text": (
            "🎉 Report ready, {nome}!\n\n"
            "The valuation for *{empresa}* has been completed.\n"
            "💰 Estimated value: *{equity_value}*\n\n"
            "📥 *Access the full report:*\n{link}\n\n"
            "If you have any questions, we're here. 🚀\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "report_not_downloaded",
        "text": (
            "Hi, {nome}! 👋\n\n"
            "Your valuation report for *{empresa}* is waiting for you! 📊\n"
            "💰 Estimated value: *{equity_value}*\n\n"
            "📥 Access now:\n{link}\n\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "pitch_deck_viewed",
        "text": (
            "👀 *Someone accessed your Pitch Deck!*\n\n"
            "An investor has opened the pitch deck for *{empresa}* right now.\n\n"
            "Track views on your dashboard:\n"
            "👉 {link}\n\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "overdue",
        "text": (
            "Hello, {nome}! 👋\n\n"
            "We noticed that the payment for the valuation of *{empresa}* is still pending.\n\n"
            "Your quote is still available — resume now:\n"
            "👉 {link}\n\n"
            "If you have any questions, just reply here.\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "diagnostic_ready",
        "text": (
            "📊 Your diagnosis is ready, {nome}!\n\n"
            "Result: *{resultado}*\n\n"
            "Discover the growth potential of your company:\n"
            "👉 {link}\n\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "partner_commission_pending",
        "text": (
            "🎯 New commission, {nome}!\n\n"
            "A client you referred has completed their payment:\n"
            "• Company: *{empresa}*\n"
            "• Your commission: *R$ {valor}*\n\n"
            "Visit your dashboard for more details.\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "partner_commission_paid",
        "text": (
            "💰 Commission paid, {nome}!\n\n"
            "The transfer of *R$ {valor}* has been completed. ✅\n\n"
            "Check the statement on your partner dashboard.\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "partner_welcome",
        "text": (
            "🤝 Welcome to the *Valuora Partner Program*, {nome}!\n\n"
            "We're thrilled to have you on our team. From now on, every company you refer earns you a *commission*. 💰\n\n"
            "🔗 *Your exclusive referral link:*\n{link}\n\n"
            "How it works:\n"
            "1️⃣ Share your link with your clients\n"
            "2️⃣ They get their valuation through the platform\n"
            "3️⃣ You track everything and receive your commission 🎯\n\n"
            "Access your partner dashboard to get started now.\n\n"
            "If you have any questions, just reply here. Count on us! 🚀\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "partner_new_client",
        "text": (
            "📋 New client on your dashboard, {nome}!\n\n"
            "Company: *{empresa}*\n\n"
            "Track the status on your partner dashboard.\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "partner_client_report_ready",
        "text": (
            "✅ Client report ready, {nome}!\n\n"
            "The valuation for *{empresa}* has been completed successfully.\n"
            "Access your partner dashboard to follow up.\n\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "checkout_abandoned",
        "text": (
            "Hello, {nome}! 👋\n\n"
            "We noticed you started the valuation for *{empresa}* but haven't completed the payment yet.\n\n"
            "Your quote is reserved — finish now and discover how much your company is worth:\n"
            "👉 {link}\n\n"
            "If you have any questions, just reply here. 😊\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "user_reactivation",
        "text": (
            "Hello, {nome}! 👋\n\n"
            "It's been a few days since you signed up at Valuora but haven't started your valuation yet.\n\n"
            "Discover how much your company is worth in minutes:\n"
            "👉 {link}\n\n"
            "It's fast, simple, and could change how you see your business. 🚀\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "partner_reactivation",
        "text": (
            "Hello, {nome}! 👋\n\n"
            "We miss you! It's been a while since we've seen new referrals from you at Valuora.\n\n"
            "Remember, every company you refer can earn you commissions. 💰\n\n"
            "Share your link and reactivate your referrals:\n"
            "👉 {link}\n\n"
            "If you have any questions, just reach out here.\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "auto_reply",
        "text": (
            "Hello! 👋 I'm the virtual assistant at *Valuora*.\n\n"
            "We received your message and our team will get back to you shortly.\n\n"
            "In the meantime, you can access our platform:\n"
            "👉 {link}\n\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "broadcast",
        "text": (
            "Hello, {nome}! 👋\n\n"
            "We have some exciting news for you at *Valuora*!\n\n"
            "Check it out now:\n"
            "👉 {link}\n\n"
            "— *Valuora*"
        ),
    },
    {
        "event_type": "weekly_report",
        "text": (
            "📊 *Weekly Report — Valuora*\n"
            "📅 {periodo}\n\n"
            "👥 New signups: *{novos_usuarios}*\n"
            "📈 Analyses started: *{analises}*\n"
            "💳 Payments confirmed: *{pagamentos}*\n"
            "💰 Gross revenue: *R$ {receita}*\n\n"
            "— *Valuora Admin*"
        ),
    },
    {
        "event_type": "test",
        "text": (
            "🤖 *Test message — Valuora*\n\n"
            "Hello, {nome}! If you're reading this, the WhatsApp integration is working correctly. ✅\n\n"
            "— *Valuora Admin*"
        ),
    },
    {
        "event_type": "payment_failed",
        "text": (
            "Hello, {nome}! ⚠️\n\n"
            "Unfortunately, the payment for the valuation of *{empresa}* could not be processed.\n\n"
            "This may have occurred due to insufficient balance, card limit, or incorrect details.\n\n"
            "Please try again with another payment method:\n"
            "👉 {link}\n\n"
            "If you have any questions, just reply here. 😊\n"
            "— *Valuora*"
        ),
    },
]


async def seed_default_templates(force: bool = False) -> dict:
    """Sync DEFAULT_TEMPLATES to the DB.

    Behaviour (runs automatically on every deploy via startup lifespan):
    - INSERT new templates that don't exist yet.
    - UPDATE existing templates whose text changed in code (auto-sync).
      Preserves the `enabled` flag set by admin — only the text is updated.
    - force=True: also overwrites templates whose text hasn't changed (full reset).
    """
    from app.core.database import async_session_maker
    from app.models.models import WhatsAppTemplate
    from sqlalchemy import select
    from datetime import datetime as _dt, timezone as _tz

    inserted = 0
    updated = 0
    skipped = 0
    async with async_session_maker() as db:
        for tpl in DEFAULT_TEMPLATES:
            row = (await db.execute(
                select(WhatsAppTemplate).where(WhatsAppTemplate.event_type == tpl["event_type"])
            )).scalar_one_or_none()
            if row is None:
                db.add(WhatsAppTemplate(
                    event_type=tpl["event_type"],
                    text=tpl["text"],
                    enabled=True,
                    updated_at=_dt.now(_tz.utc),
                ))
                inserted += 1
            elif force or row.text != tpl["text"]:
                # Auto-update when text changed in code; preserve enabled flag
                row.text = tpl["text"]
                row.updated_at = _dt.now(_tz.utc)
                updated += 1
            else:
                skipped += 1
        await db.commit()
    return {"inserted": inserted, "updated": updated, "skipped": skipped}


# ─── Phone helpers ─────────────────────────────────────────────────────────────

def _format_phone(raw: str | None) -> str | None:
    """Strip formatting and normalise to Whatsmiau format (e.g. 5554999536435).

    Returns None if the result is not a plausible Brazilian mobile number.
    """
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("00"):
        digits = digits[2:]
    # Add Brazil country code when missing
    if len(digits) in (10, 11):
        digits = "55" + digits
    # Must be 12-13 digits for Brazil (+55 + DDD + 8/9 digits)
    if not (12 <= len(digits) <= 13):
        return None
    return digits


def _first_name(full_name: str | None) -> str:
    if not full_name:
        return "customer"
    return full_name.strip().split()[0]


# ─── Logging helper (fire-and-forget) ─────────────────────────────────────────

async def _log(
    event_type: str,
    phone: str | None,
    status: str,
    message_preview: str | None = None,
    error: str | None = None,
    user_id=None,
) -> None:
    """Write a WhatsAppLog row. Never raises."""
    try:
        from app.core.database import async_session_maker
        from app.models.models import WhatsAppLog
        async with async_session_maker() as db:
            db.add(WhatsAppLog(
                phone=phone,
                user_id=user_id,
                event_type=event_type,
                status=status,
                error=error,
                message_preview=(message_preview or "")[:300],
            ))
            await db.commit()
    except Exception as exc:
        logger.warning(f"[WhatsApp] Failed to write log: {exc}")


async def _is_blacklisted(phone: str) -> bool:
    """Return True if the phone is on the opt-out blacklist."""
    try:
        from app.core.database import async_session_maker
        from app.models.models import WhatsAppBlacklist
        from sqlalchemy import select
        async with async_session_maker() as db:
            row = (await db.execute(
                select(WhatsAppBlacklist).where(WhatsAppBlacklist.phone == phone)
            )).scalar_one_or_none()
            return row is not None
    except Exception:
        return False


async def add_to_blacklist(phone: str, reason: str = "opt-out via SAIR") -> bool:
    """Add a phone number to the opt-out blacklist. Returns True if added, False if already listed."""
    try:
        from app.core.database import async_session_maker
        from app.models.models import WhatsAppBlacklist
        from sqlalchemy import select
        async with async_session_maker() as db:
            existing = (await db.execute(
                select(WhatsAppBlacklist).where(WhatsAppBlacklist.phone == phone)
            )).scalar_one_or_none()
            if existing:
                return False
            db.add(WhatsAppBlacklist(phone=phone, reason=reason))
            await db.commit()
            logger.info(f"[WhatsApp] Phone {phone} added to blacklist: {reason}")
            return True
    except Exception as e:
        logger.warning(f"[WhatsApp] Failed to add {phone} to blacklist: {e}")
        return False


async def _get_template(event_type: str) -> tuple[str | None, bool]:
    """Return (custom_text, enabled) from whatsapp_templates if present, else (None, True)."""
    try:
        from app.core.database import async_session_maker
        from app.models.models import WhatsAppTemplate
        from sqlalchemy import select
        async with async_session_maker() as db:
            row = (await db.execute(
                select(WhatsAppTemplate).where(WhatsAppTemplate.event_type == event_type)
            )).scalar_one_or_none()
            if row:
                return row.text, row.enabled
    except Exception:
        pass
    return None, True


# ─── Core HTTP call ────────────────────────────────────────────────────────────

async def _send(
    phone: str | None,
    text: str,
    event_type: str = "unknown",
    user_id=None,
    template_vars: dict | None = None,
) -> dict:
    """Send a text message. Returns {"ok": bool, "error": str | None}. Never raises."""
    # Temporary pause window (e.g. WhatsApp spam restriction). Skips sending until the
    # configured UTC datetime passes, then resumes automatically. Never raises.
    paused_until = getattr(settings, "WHATSAPP_PAUSED_UNTIL", "") or ""
    if paused_until:
        try:
            from datetime import datetime, timezone
            until = datetime.fromisoformat(paused_until)
            if until.tzinfo is None:
                until = until.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) < until:
                logger.info("[WhatsApp] Paused until %s — skipping %s", paused_until, event_type)
                await _log(event_type, phone, "skipped", text, f"paused until {paused_until}", user_id)
                return {"ok": False, "error": "paused"}
        except Exception:
            logger.warning("[WhatsApp] Invalid WHATSAPP_PAUSED_UNTIL=%r — ignoring pause", paused_until)
    api_key: str = getattr(settings, "WHATSMIAU_SECRET_KEY", "")
    instance: str = getattr(settings, "WHATSMIAU_INSTANCE", "")
    if not api_key or not instance:
        logger.debug("[WhatsApp] Skipped — WHATSMIAU_SECRET_KEY or WHATSMIAU_INSTANCE not configured")
        await _log(event_type, phone, "skipped", text, "credentials not configured", user_id)
        return {"ok": False, "error": "credentials not configured"}
    formatted = _format_phone(phone)
    if not formatted:
        logger.debug(f"[WhatsApp] Skipping invalid/empty phone: {phone!r}")
        await _log(event_type, phone, "skipped", text, "invalid phone", user_id)
        return {"ok": False, "error": "invalid phone"}

    # Blacklist check
    if await _is_blacklisted(formatted):
        logger.debug(f"[WhatsApp] Skipping blacklisted phone: {formatted}")
        await _log(event_type, formatted, "skipped", text, "blacklisted", user_id)
        return {"ok": False, "error": "blacklisted"}

    # Template override / enabled check
    custom_text, enabled = await _get_template(event_type)
    if not enabled:
        await _log(event_type, formatted, "skipped", text, "template disabled", user_id)
        return {"ok": False, "error": "template disabled"}
    if custom_text:
        # Apply variable substitution safely (unknown placeholders left as-is)
        if template_vars:
            class _SafeDict(dict):
                def __missing__(self, key):
                    return "{" + key + "}"
            try:
                text = custom_text.format_map(_SafeDict(template_vars))
            except Exception:
                text = custom_text
        else:
            text = custom_text

    # Append automatic footer for all transactional messages
    if event_type not in _NO_FOOTER_EVENTS:
        text = text + _AUTO_FOOTER

    # URL-encode instance name (may contain spaces like "Quanto Vale_90514490")
    from urllib.parse import quote
    instance_encoded = quote(instance, safe="")
    url = f"{_BASE}/message/sendText/{instance_encoded}"
    payload = {"number": formatted, "text": text, "delay": 1200}
    headers = {"apikey": api_key, "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code >= 400:
                err = f"HTTP {resp.status_code}: {resp.text[:200]}"
                logger.warning(f"[WhatsApp] {err} sending to {formatted}")
                await _log(event_type, formatted, "failed", text, err, user_id)
                return {"ok": False, "error": err}
            else:
                await _log(event_type, formatted, "sent", text, None, user_id)
                return {"ok": True, "error": None}
    except Exception as exc:
        logger.warning(f"[WhatsApp] Failed to send to {formatted}: {exc}")
        await _log(event_type, formatted, "failed", text, str(exc), user_id)
        return {"ok": False, "error": str(exc)}


# ─── Message templates ─────────────────────────────────────────────────────────

async def send_account_activation(
    phone: str | None,
    user_name: str | None,
    company_name: str,
    activation_url: str,
    partner_company: str = "",
    user_id=None,
) -> None:
    """Sent to a partner-created client so they can set their password and log in."""
    company_name = (company_name or "").strip()
    partner_company = (partner_company or "your consultant").strip()
    text = (
        f"Hello, {_first_name(user_name)}! 👋\n\n"
        f"Your consultant *{partner_company}* has prepared the valuation for *{company_name}* for you.\n\n"
        f"Set your password to access your account and view the analysis:\n"
        f"👉 {activation_url}\n\n"
        f"If you have any questions, just reply here. 😊\n"
        f"— *Valuora*"
    )
    await _send(phone, text, "account_activation", user_id, template_vars={
        "nome": _first_name(user_name), "empresa": company_name,
        "link": activation_url, "parceiro": partner_company,
    })


async def send_charge_created(
    phone: str | None,
    user_name: str | None,
    company_name: str,
    invoice_url: str,
    plan: str = "",
    user_id=None,
) -> None:
    """Sent right after a payment charge is generated (checkout initiated)."""
    company_name = (company_name or "").strip()
    plan_line = f"\nPlan: *{plan.capitalize()}*" if plan else ""
    text = (
        f"Hello, {_first_name(user_name)}! 👋\n\n"
        f"We received your valuation request for *{company_name}*.{plan_line}\n\n"
        f"Complete your payment to unlock your analysis:\n"
        f"👉 {invoice_url}\n\n"
        f"If you have any questions, just reply here. 😊\n"
        f"— *Valuora*"
    )
    await _send(phone, text, "charge_created", user_id, template_vars={
        "nome": _first_name(user_name), "empresa": company_name,
        "link": invoice_url, "plano": plan or "",
    })


async def send_payment_confirmed(
    phone: str | None,
    user_name: str | None,
    company_name: str,
    user_id=None,
) -> None:
    """Sent right after PAYMENT_CONFIRMED / PAYMENT_RECEIVED — before PDF is generated."""
    company_name = (company_name or "").strip()
    text = (
        f"✅ Payment confirmed, {_first_name(user_name)}!\n\n"
        f"We are generating the valuation for *{company_name}* right now. 📊\n\n"
        f"You will receive the report link here in a few minutes. ⏱️\n\n"
        f"— *Valuora*"
    )
    await _send(phone, text, "payment_confirmed", user_id, template_vars={
        "nome": _first_name(user_name), "empresa": company_name,
    })


def _format_equity(equity_value: float | None) -> str:
    """Format equity value as 'R$ X,XM' or 'R$ XXXk' for WhatsApp messages."""
    if not equity_value or equity_value <= 0:
        return "—"
    if equity_value >= 1_000_000:
        return f"R$ {equity_value / 1_000_000:.1f}M"
    if equity_value >= 1_000:
        return f"R$ {equity_value / 1_000:.0f}k"
    return f"R$ {equity_value:,.0f}"


async def send_report_ready(
    phone: str | None,
    user_name: str | None,
    company_name: str,
    report_url: str,
    plan: str = "",
    equity_value: float | None = None,
    user_id=None,
) -> None:
    """Sent after the PDF report has been generated successfully."""
    company_name = (company_name or "").strip()
    eq_str = _format_equity(equity_value)
    text = (
        f"🎉 Report ready, {_first_name(user_name)}!\n\n"
        f"The valuation for *{company_name}* has been completed.\n"
        f"💰 Estimated value: *{eq_str}*\n\n"
        f"📥 *Access the full report:*\n{report_url}\n\n"
        f"If you have any questions, we're here. 🚀\n"
        f"— *Valuora*\n"
        f"_Reply STOP to unsubscribe from automated messages._"
    )
    await _send(phone, text, "report_ready", user_id, template_vars={
        "nome": _first_name(user_name), "empresa": company_name,
        "link": report_url, "plano": plan or "",
        "equity_value": eq_str,
    })


async def send_report_not_downloaded(
    phone: str | None,
    user_name: str | None,
    company_name: str,
    report_url: str,
    equity_value: float | None = None,
    user_id=None,
) -> None:
    """Follow-up 24h after report_ready when download_count is still 0."""
    company_name = (company_name or "").strip()
    eq_str = _format_equity(equity_value)
    text = (
        f"Hi, {_first_name(user_name)}! 👋\n\n"
        f"Your valuation report for *{company_name}* is waiting for you! 📊\n"
        f"💰 Estimated value: *{eq_str}*\n\n"
        f"📥 Access now:\n{report_url}\n\n"
        f"— *Valuora*\n"
        f"_Reply STOP to unsubscribe from automated messages._"
    )
    await _send(phone, text, "report_not_downloaded", user_id, template_vars={
        "nome": _first_name(user_name), "empresa": company_name,
        "link": report_url, "equity_value": eq_str,
    })


async def send_pitch_deck_viewed(
    phone: str | None,
    owner_name: str | None,
    company_name: str,
    deck_url: str,
    user_id=None,
) -> None:
    """Sent to pitch deck owner when an investor opens the share link."""
    company_name = (company_name or "").strip()
    text = (
        f"👀 *Someone accessed your Pitch Deck!*\n\n"
        f"An investor has opened the pitch deck for *{company_name}* right now.\n\n"
        f"Track views on your dashboard:\n"
        f"👉 {deck_url}\n\n"
        f"— *Valuora*"
    )
    await _send(phone, text, "pitch_deck_viewed", user_id, template_vars={
        "nome": _first_name(owner_name), "empresa": company_name, "link": deck_url,
    })


async def send_charge_overdue(
    phone: str | None,
    user_name: str | None,
    company_name: str,
    invoice_url: str,
    user_id=None,
) -> None:
    """Sent when a charge goes overdue/expired."""
    company_name = (company_name or "").strip()
    text = (
        f"Hello, {_first_name(user_name)}! 👋\n\n"
        f"We noticed that the payment for the valuation of *{company_name}* is still pending.\n\n"
        f"Your quote is still available — resume now:\n"
        f"👉 {invoice_url}\n\n"
        f"If you have any questions, just reply here.\n"
        f"— *Valuora*"
    )
    await _send(phone, text, "overdue", user_id, template_vars={
        "nome": _first_name(user_name), "empresa": company_name, "link": invoice_url,
    })


async def send_partner_commission_pending(
    phone: str | None,
    partner_name: str | None,
    company_name: str,
    amount: float,
    user_id=None,
) -> None:
    """Sent to partner when a new commission is created (PENDING)."""
    company_name = (company_name or "").strip()
    text = (
        f"🎯 New commission, {_first_name(partner_name)}!\n\n"
        f"A client you referred has completed their payment:\n"
        f"• Company: *{company_name}*\n"
        f"• Your commission: *R$ {amount:.2f}*\n\n"
        f"Visit your dashboard for more details.\n"
        f"— *Valuora*"
    )
    await _send(phone, text, "partner_commission_pending", user_id, template_vars={
        "nome": _first_name(partner_name), "empresa": company_name, "valor": f"{amount:.2f}",
    })


async def send_partner_commission_paid(
    phone: str | None,
    partner_name: str | None,
    amount: float,
    user_id=None,
) -> None:
    """Sent to partner when admin marks commission as PAID."""
    text = (
        f"💰 Commission paid, {_first_name(partner_name)}!\n\n"
        f"The transfer of *R$ {amount:.2f}* has been completed. ✅\n\n"
        f"Check the statement on your partner dashboard.\n"
        f"— *Valuora*"
    )
    await _send(phone, text, "partner_commission_paid", user_id, template_vars={
        "nome": _first_name(partner_name), "valor": f"{amount:.2f}",
    })


async def send_test_message(
    phone: str,
    user_id=None,
) -> dict:
    """Send a test message. Returns dict with status + error."""
    api_key: str = getattr(settings, "WHATSMIAU_SECRET_KEY", "")
    instance: str = getattr(settings, "WHATSMIAU_INSTANCE", "")
    if not api_key or not instance:
        return {"ok": False, "error": "Credentials not configured (WHATSMIAU_SECRET_KEY / WHATSMIAU_INSTANCE)"}
    from urllib.parse import quote
    formatted = _format_phone(phone)
    if not formatted:
        return {"ok": False, "error": f"Invalid phone number: {phone!r}"}
    text = (
        "🤖 *Test message — Valuora*\n\n"
        "If you're reading this, the WhatsApp integration is working correctly! ✅\n\n"
        "— *Valuora Admin*"
    )
    instance_encoded = quote(instance, safe="")
    url = f"{_BASE}/message/sendText/{instance_encoded}"
    payload = {"number": formatted, "text": text, "delay": 500}
    headers = {"apikey": api_key, "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code >= 400:
                err = f"HTTP {resp.status_code}: {resp.text[:300]}"
                await _log("test", formatted, "failed", text, err, user_id)
                return {"ok": False, "error": err}
            await _log("test", formatted, "sent", text, None, user_id)
            return {"ok": True}
    except Exception as exc:
        await _log("test", formatted, "failed", text, str(exc), user_id)
        return {"ok": False, "error": str(exc)}


# ─── New user: welcome message ─────────────────────────────────────────────────

async def send_welcome(
    phone: str | None,
    user_name: str | None,
    user_id=None,
) -> None:
    """Sent right after user registers."""
    link = f"{settings.FRONTEND_URL}/new-analysis"
    text = (
        f"🎉 Welcome to *Valuora*, {_first_name(user_name)}!\n\n"
        f"You can now start your company's valuation:\n"
        f"👉 {link}\n\n"
        f"If you have any questions, just reply here. 😊\n"
        f"— *Valuora*"
    )
    await _send(phone, text, "welcome", user_id, template_vars={
        "nome": _first_name(user_name), "link": link,
    })


# ─── Diagnostic concluded ──────────────────────────────────────────────────────

async def send_diagnostic_ready(
    phone: str | None,
    user_name: str | None,
    score_label: str,
    link: str,
    user_id=None,
) -> None:
    """Sent when free diagnostic is completed."""
    text = (
        f"📊 Your diagnosis is ready, {_first_name(user_name)}!\n\n"
        f"Result: *{score_label}*\n\n"
        f"Discover the growth potential of your company:\n"
        f"👉 {link}\n\n"
        f"— *Valuora*"
    )
    await _send(phone, text, "diagnostic_ready", user_id, template_vars={
        "nome": _first_name(user_name), "resultado": score_label, "link": link,
    })


# ─── Partner: welcome on registration ──────────────────────────────────────────

async def send_partner_welcome(
    phone: str | None,
    partner_name: str | None,
    referral_link: str,
    user_id=None,
) -> None:
    """Sent right after a partner registers."""
    text = (
        f"🤝 Welcome to the *Valuora Partner Program*, {_first_name(partner_name)}!\n\n"
        f"We're thrilled to have you on our team. From now on, every company you refer earns you a *commission*. 💰\n\n"
        f"🔗 *Your exclusive referral link:*\n{referral_link}\n\n"
        f"How it works:\n"
        f"1️⃣ Share your link with your clients\n"
        f"2️⃣ They get their valuation through the platform\n"
        f"3️⃣ You track everything and receive your commission 🎯\n\n"
        f"Access your partner dashboard to get started now.\n\n"
        f"If you have any questions, just reply here. Count on us! 🚀\n"
        f"— *Valuora*"
    )
    await _send(phone, text, "partner_welcome", user_id, template_vars={
        "nome": _first_name(partner_name), "link": referral_link,
    })


# ─── Partner: new client added ─────────────────────────────────────────────────

async def send_partner_new_client(
    phone: str | None,
    partner_name: str | None,
    company_name: str,
    user_id=None,
) -> None:
    """Sent to partner when a new client is added to their portfolio."""
    company_name = (company_name or "").strip()
    text = (
        f"📋 New client on your dashboard, {_first_name(partner_name)}!\n\n"
        f"Company: *{company_name}*\n\n"
        f"Track the status on your partner dashboard.\n"
        f"— *Valuora*"
    )
    await _send(phone, text, "partner_new_client", user_id, template_vars={
        "nome": _first_name(partner_name), "empresa": company_name,
    })


# ─── Partner: client report ready ─────────────────────────────────────────────

async def send_partner_client_report_ready(
    phone: str | None,
    partner_name: str | None,
    company_name: str,
    user_id=None,
) -> None:
    """Sent to partner when one of their clients' reports is generated."""
    company_name = (company_name or "").strip()
    text = (
        f"✅ Client report ready, {_first_name(partner_name)}!\n\n"
        f"The valuation for *{company_name}* has been completed successfully.\n"
        f"Access your partner dashboard to follow up.\n\n"
        f"— *Valuora*"
    )
    await _send(phone, text, "partner_client_report_ready", user_id, template_vars={
        "nome": _first_name(partner_name), "empresa": company_name,
    })


async def send_checkout_abandoned(
    phone: str | None,
    user_name: str | None,
    company_name: str,
    checkout_url: str,
    user_id=None,
) -> None:
    """Sent when a user created an analysis but didn't complete checkout (~2h later)."""
    company_name = (company_name or "").strip()
    text = (
        f"Hello, {_first_name(user_name)}! 👋\n\n"
        f"We noticed you started the valuation for *{company_name}* but haven't completed the payment yet.\n\n"
        f"Your quote is reserved — finish now and discover how much your company is worth:\n"
        f"👉 {checkout_url}\n\n"
        f"If you have any questions, just reply here. 😊\n"
        f"— *Valuora*"
    )
    await _send(phone, text, "checkout_abandoned", user_id, template_vars={
        "nome": _first_name(user_name), "empresa": company_name, "link": checkout_url,
    })


async def send_user_reactivation(
    phone: str | None,
    user_name: str | None,
    new_analysis_url: str,
    user_id=None,
) -> None:
    """Sent to users who registered 7 days ago but never created an analysis."""
    text = (
        f"Hello, {_first_name(user_name)}! 👋\n\n"
        f"It's been a few days since you signed up at Valuora but haven't started your valuation yet.\n\n"
        f"Discover how much your company is worth in minutes:\n"
        f"👉 {new_analysis_url}\n\n"
        f"It's fast, simple, and could change how you see your business. 🚀\n"
        f"— *Valuora*"
    )
    await _send(phone, text, "user_reactivation", user_id, template_vars={
        "nome": _first_name(user_name), "link": new_analysis_url,
    })


async def send_partner_reactivation(
    phone: str | None,
    partner_name: str | None,
    referral_link: str,
    user_id=None,
) -> None:
    """Sent to partners with no referrals in the last 30 days."""
    text = (
        f"Hello, {_first_name(partner_name)}! 👋\n\n"
        f"We miss you! It's been a while since we've seen new referrals from you at Valuora.\n\n"
        f"Remember, every company you refer can earn you commissions. 💰\n\n"
        f"Share your link and reactivate your referrals:\n"
        f"👉 {referral_link}\n\n"
        f"If you have any questions, just reach out here.\n"
        f"— *Valuora*"
    )
    await _send(phone, text, "partner_reactivation", user_id, template_vars={
        "nome": _first_name(partner_name), "link": referral_link,
    })


async def send_report_pdf(
    phone: str | None,
    user_name: str | None,
    company_name: str,
    pdf_path: str,
    report_url: str,
    lang: str = "pt",
    user_id=None,
) -> None:
    """Send the valuation PDF file directly via WhatsApp after report generation.

    Uses Evolution API v2  message/sendMedia  endpoint with mediatype=document.
    Falls back silently if credentials are missing or the file can't be read.
    lang: 'pt' or 'en' — adjusts caption language.
    """
    api_key: str = getattr(settings, "WHATSMIAU_SECRET_KEY", "")
    instance: str = getattr(settings, "WHATSMIAU_INSTANCE", "")
    if not api_key or not instance:
        return
    formatted = _format_phone(phone)
    if not formatted:
        return
    if await _is_blacklisted(formatted):
        return

    company_name = (company_name or "").strip()
    import base64
    import os

    try:
        if not os.path.isfile(pdf_path):
            logger.warning(f"[WhatsApp] PDF not found at {pdf_path!r} — skipping sendMedia")
            return
        with open(pdf_path, "rb") as fh:
            b64 = base64.b64encode(fh.read()).decode()
    except Exception as exc:
        logger.warning(f"[WhatsApp] Failed to read PDF for sendMedia: {exc}")
        return

    first = _first_name(user_name)
    if lang == "en":
        caption = (
            f"📊 *Valuora — Valuation Report*\n\n"
            f"Hello, {first}! Here is the valuation report for *{company_name}*. 🎉\n\n"
            f"You can also access it online:\n"
            f"👉 {report_url}\n\n"
            f"— *Valuora*"
        )
        file_name = f"Valuora_Valuation_{company_name.replace(' ', '_')}_EN.pdf"
    else:
        caption = (
            f"📊 *Valuation Report — Valuora*\n\n"
            f"Hello, {first}! Here is the valuation report for *{company_name}*. 🎉\n\n"
            f"You can also access it online:\n"
            f"👉 {report_url}\n\n"
            f"— *Valuora*"
        )
        file_name = f"Valuora_Valuation_{company_name.replace(' ', '_')}_PT.pdf"

    from urllib.parse import quote
    instance_encoded = quote(instance, safe="")
    url = f"{_BASE}/message/sendMedia/{instance_encoded}"
    payload = {
        "number": formatted,
        "mediatype": "document",
        "mimetype": "application/pdf",
        "media": b64,
        "fileName": file_name,
        "caption": caption,
        "delay": 2000,
    }
    headers = {"apikey": api_key, "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code >= 400:
                err = f"HTTP {resp.status_code}: {resp.text[:200]}"
                logger.warning(f"[WhatsApp] sendMedia failed for {formatted}: {err}")
                await _log(f"report_pdf_{lang}", formatted, "failed", caption, err, user_id)
            else:
                logger.info(f"[WhatsApp] PDF sent to {formatted} ({lang})")
                await _log(f"report_pdf_{lang}", formatted, "sent", caption, None, user_id)
    except Exception as exc:
        logger.warning(f"[WhatsApp] sendMedia exception for {formatted}: {exc}")
        await _log(f"report_pdf_{lang}", formatted, "failed", caption, str(exc), user_id)


async def send_ebook_pdf(
    phone: str | None,
    buyer_name: str | None,
    product_name: str,
    pdf_path: str,
    download_url: str,
    file_name: str = "Manual-Valuora.pdf",
) -> dict:
    """Delivers the ebook (PDF) directly to the buyer's WhatsApp after payment.

    Uses the Evolution API v2 message/sendMedia endpoint (mediatype=document).
    Bypasses the template system (paid product delivery — always sends).
    Returns {"ok": bool, "error": str | None}. Never raises an exception.
    """
    api_key: str = getattr(settings, "WHATSMIAU_SECRET_KEY", "")
    instance: str = getattr(settings, "WHATSMIAU_INSTANCE", "")
    if not api_key or not instance:
        return {"ok": False, "error": "credentials not configured"}
    formatted = _format_phone(phone)
    if not formatted:
        return {"ok": False, "error": "invalid phone"}

    import base64
    import os

    try:
        if not os.path.isfile(pdf_path):
            logger.warning(f"[WhatsApp] Ebook PDF not found at {pdf_path!r} — skipping sendMedia")
            return {"ok": False, "error": "pdf not found"}
        with open(pdf_path, "rb") as fh:
            b64 = base64.b64encode(fh.read()).decode()
    except Exception as exc:
        logger.warning(f"[WhatsApp] Failed to read ebook PDF: {exc}")
        return {"ok": False, "error": f"read error: {exc}"}

    first = _first_name(buyer_name)
    caption = (
        f"📘 *{product_name}*\n\n"
        f"Hello, {first}! Here is your copy — it's already attached to this message. 🎉\n\n"
        f"This material was designed to help you protect your company's value "
        f"when selling, fundraising, or bringing on partners. Happy reading! 📈\n\n"
        f"If you prefer, you can also download it from this link (valid for 7 days):\n"
        f"👉 {download_url}\n\n"
        f"If you have any questions, just reply here. 😊\n— *Valuora*"
    )

    from urllib.parse import quote
    instance_encoded = quote(instance, safe="")
    url = f"{_BASE}/message/sendMedia/{instance_encoded}"
    payload = {
        "number": formatted,
        "mediatype": "document",
        "mimetype": "application/pdf",
        "media": b64,
        "fileName": file_name,
        "caption": caption,
        "delay": 2000,
    }
    headers = {"apikey": api_key, "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code >= 400:
                err = f"HTTP {resp.status_code}: {resp.text[:200]}"
                logger.warning(f"[WhatsApp] ebook sendMedia failed for {formatted}: {err}")
                await _log("ebook_delivery", formatted, "failed", caption, err, None)
                return {"ok": False, "error": err}
            logger.info(f"[WhatsApp] Ebook PDF sent to {formatted}")
            await _log("ebook_delivery", formatted, "sent", caption, None, None)
            return {"ok": True, "error": None}
    except Exception as exc:
        logger.warning(f"[WhatsApp] ebook sendMedia exception for {formatted}: {exc}")
        await _log("ebook_delivery", formatted, "failed", caption, str(exc), None)
        return {"ok": False, "error": str(exc)}


async def send_payment_failed(
    phone: str | None,
    user_name: str | None,
    company_name: str,
    invoice_url: str,
    user_id=None,
) -> None:
    """Sent when Asaas fires PAYMENT_DECLINED / PAYMENT_REFUSED — charge was rejected."""
    company_name = (company_name or "").strip()
    text = (
        f"Hello, {_first_name(user_name)}! ⚠️\n\n"
        f"Unfortunately, the payment for the valuation of *{company_name}* could not be processed.\n\n"
        f"This may have occurred due to insufficient balance, card limit, or incorrect details.\n\n"
        f"Please try again with another payment method:\n"
        f"👉 {invoice_url}\n\n"
        f"If you have any questions, just reply here. 😊\n"
        f"— *Valuora*"
    )
    await _send(phone, text, "payment_failed", user_id, template_vars={
        "nome": _first_name(user_name),
        "empresa": company_name,
        "link": invoice_url,
    })


async def check_instance_status() -> dict:
    """Check if the configured Whatsmiau instance is connected."""
    api_key: str = getattr(settings, "WHATSMIAU_SECRET_KEY", "")
    instance: str = getattr(settings, "WHATSMIAU_INSTANCE", "")
    if not api_key or not instance:
        return {"connected": False, "error": "Credentials not configured", "instance": instance}
    from urllib.parse import quote
    instance_encoded = quote(instance, safe="")
    url = f"{_BASE}/instance/connectionState/{instance_encoded}"
    headers = {"apikey": api_key}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 404:
                return {"connected": False, "error": "Instance not found", "instance": instance}
            data = resp.json()
            # Evolution API v2 may nest state under data["instance"]["state"]
            state = (
                data.get("state")
                or data.get("instance", {}).get("state")
                or "unknown"
            )
            return {
                "connected": state == "open",
                "state": state,
                "instance": instance,
                "error": None if state == "open" else f"State: {state}",
            }
    except Exception as exc:
        return {"connected": False, "error": str(exc), "instance": instance}


async def send_partner_broadcast_whatsapp(
    phone: str | None,
    partner_name: str | None,
    message_template: str,
    user_id=None,
) -> bool:
    """Sends a broadcast message to a partner, replacing {nome} with their first name.
    Returns True if sent, False if skipped (no phone or blacklisted).
    """
    if not phone:
        return False
    first = _first_name(partner_name)
    text = message_template.replace("{nome}", first)
    try:
        await _send(phone, text, event_type="partner_broadcast", user_id=user_id)
        return True
    except Exception:
        return False

