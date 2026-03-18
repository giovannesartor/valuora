import aiosmtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path
from app.core.config import settings

logger = logging.getLogger(__name__)

template_dir = Path(__file__).parent.parent / "templates" / "email"
jinja_env = Environment(
    loader=FileSystemLoader(str(template_dir)),
    autoescape=select_autoescape(["html"]),
)


def _build_message(
    from_addr: str, to_email: str, subject: str,
    html_body: str, attachment_path: str | None
) -> MIMEMultipart:
    import re
    message = MIMEMultipart("alternative")
    message["From"] = f"{settings.SMTP_FROM_NAME} <{from_addr}>"
    message["To"] = to_email
    message["Subject"] = subject

    plain_body = re.sub(r'<[^>]+>', '', html_body)
    plain_body = re.sub(r'[ \t]+', ' ', plain_body)
    plain_body = re.sub(r'\n{3,}', '\n\n', plain_body).strip()
    message.attach(MIMEText(plain_body, "plain", "utf-8"))
    message.attach(MIMEText(html_body, "html", "utf-8"))

    if attachment_path:
        with open(attachment_path, "rb") as f:
            pdf_attachment = MIMEApplication(f.read(), _subtype="pdf")
            pdf_attachment.add_header("Content-Disposition", "attachment", filename="valuora-report.pdf")
            message.attach(pdf_attachment)

    return message


async def send_email(to_email: str, subject: str, html_body: str, attachment_path: str = None):
    """Send via Resend SMTP (primary) → Gmail SMTP (fallback)."""

    # ── 1. Resend ─────────────────────────────────────────────
    if settings.RESEND_API_KEY:
        msg = _build_message(settings.RESEND_FROM_EMAIL, to_email, subject, html_body, attachment_path)
        try:
            await aiosmtplib.send(
                msg,
                hostname="smtp.resend.com",
                port=465,
                username="resend",
                password=settings.RESEND_API_KEY,
                use_tls=True,          # SSL on connect (port 465)
            )
            logger.info("[EMAIL:resend] Sent to %s — %s", to_email, subject)
            return
        except Exception as exc:
            logger.warning(
                "[EMAIL:resend] Failed (%s) — falling back to Gmail for %s",
                exc, to_email,
            )

    # ── 2. Gmail fallback ─────────────────────────────────────
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.error(
            "[EMAIL] No sender configured — email to %s ('%s') was NOT sent.",
            to_email, subject,
        )
        return

    msg = _build_message(settings.SMTP_FROM_EMAIL, to_email, subject, html_body, attachment_path)
    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info("[EMAIL:gmail] Sent to %s — %s", to_email, subject)
    except Exception as exc:
        logger.error("[EMAIL:gmail] Failed to send to %s — %s: %s", to_email, subject, exc)


def render_template(template_name: str, **kwargs) -> str:
    template = jinja_env.get_template(template_name)
    return template.render(
        app_name="Valuora",
        app_url=settings.APP_URL,
        frontend_url=settings.FRONTEND_URL,
        contact_email=settings.SMTP_FROM_EMAIL,
        **kwargs,
    )


# ─── Email Functions ──────────────────────────────────────

async def send_verification_email(email: str, full_name: str, token: str):
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    html = render_template("verification.html", name=full_name, verify_url=verify_url)
    await send_email(email, "Confirm your email — Valuora", html)


async def send_password_reset_email(email: str, full_name: str, token: str):
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    html = render_template("password_reset.html", name=full_name, reset_url=reset_url)
    await send_email(email, "Reset your password — Valuora", html)


async def send_payment_confirmation_email(email: str, full_name: str, plan: str, amount: float):
    html = render_template("payment_confirmation.html", name=full_name, plan=plan, amount=f"${amount:.2f}")
    await send_email(email, "Payment confirmed — Valuora", html)


async def send_report_ready_email(email: str, full_name: str, company_name: str, download_url: str):
    html = render_template("report_ready.html", name=full_name, company_name=company_name, download_url=download_url)
    await send_email(email, f"Report ready: {company_name} — Valuora", html)


async def send_report_updated_email(email: str, full_name: str, company_name: str, version: int, download_url: str):
    html = render_template("report_updated.html", name=full_name, company_name=company_name, version=version, download_url=download_url)
    await send_email(email, f"Updated report: {company_name} — Valuora", html)


async def send_diagnostico_email(
    email: str,
    nome: str,
    score: float,
    score_label: str,
    mensagem: str,
    recomendacoes: list[str],
    setor: str,
    receita: str,
    margem: float,
    tempo: int,
    coupon_code: str = "FIRST",
    coupon_discount: str = "10% discount on your first valuation",
):
    html = render_template(
        "diagnostico_result.html",
        nome=nome,
        score=score,
        score_label=score_label,
        mensagem=mensagem,
        recomendacoes=recomendacoes,
        setor=setor,
        receita=receita,
        margem=margem,
        tempo=tempo,
        coupon_code=coupon_code,
        coupon_discount=coupon_discount,
    )
    await send_email(email, "Your Free Diagnostic — Valuora", html)


async def send_welcome_email(email: str, full_name: str):
    """Sent after e-mail verification is confirmed."""
    html = render_template("welcome.html", name=full_name)
    await send_email(email, "Welcome to Valuora! \u2713", html)


async def send_welcome_partner_email(email: str, full_name: str, referral_link: str):
    """Sent after a partner's e-mail is verified."""
    html = render_template("partner_welcome.html", name=full_name, referral_link=referral_link)
    await send_email(email, "Partnership active! Welcome to the Partner Program \u2014 Valuora", html)


async def send_password_reset_done_email(email: str, full_name: str, reset_at: str):
    """Confirmation that a password reset was successfully completed."""
    html = render_template("password_reset_done.html", name=full_name, reset_at=reset_at)
    await send_email(email, "Password reset successfully \u2014 Valuora", html)


async def send_analysis_abandoned_email(
    email: str,
    full_name: str,
    company_name: str,
    analysis_id: str,
    coupon_code: str = "",
    coupon_discount: str = "",
):
    """Reminder sent 24 h after an analysis was created but not paid."""
    from app.core.config import settings as _s
    analysis_url = f"{_s.FRONTEND_URL}/analysis/{analysis_id}"
    html = render_template(
        "analysis_abandoned.html",
        name=full_name,
        company_name=company_name,
        analysis_url=analysis_url,
        coupon_code=coupon_code,
        coupon_discount=coupon_discount,
    )
    await send_email(email, f"{company_name}: your valuation is waiting — Valuora", html)


async def send_coupon_gift_email(
    email: str,
    full_name: str,
    coupon_code: str,
    discount_label: str,
    expires_label: str = "",
    message: str = "",
):
    """Admin sends a personalised coupon to a specific user."""
    html = render_template(
        "coupon_gift.html",
        name=full_name,
        coupon_code=coupon_code,
        discount_label=discount_label,
        expires_label=expires_label,
        message=message,
    )
    await send_email(email, f"Special gift for you: coupon {coupon_code} \u2014 Valuora", html)
