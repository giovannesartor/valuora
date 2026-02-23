import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path
from app.core.config import settings

template_dir = Path(__file__).parent.parent / "templates" / "email"
jinja_env = Environment(
    loader=FileSystemLoader(str(template_dir)),
    autoescape=select_autoescape(["html"]),
)


async def send_email(to_email: str, subject: str, html_body: str, attachment_path: str = None):
    message = MIMEMultipart("alternative")
    message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    message["To"] = to_email
    message["Subject"] = subject

    html_part = MIMEText(html_body, "html", "utf-8")
    message.attach(html_part)

    if attachment_path:
        with open(attachment_path, "rb") as f:
            pdf_attachment = MIMEApplication(f.read(), _subtype="pdf")
            pdf_attachment.add_header("Content-Disposition", "attachment", filename="relatorio-quantovale.pdf")
            message.attach(pdf_attachment)

    await aiosmtplib.send(
        message,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASSWORD,
        start_tls=True,
    )


def render_template(template_name: str, **kwargs) -> str:
    template = jinja_env.get_template(template_name)
    return template.render(
        app_name="Quanto Vale",
        app_url=settings.APP_URL,
        frontend_url=settings.FRONTEND_URL,
        contact_email=settings.SMTP_FROM_EMAIL,
        **kwargs,
    )


# ─── Email Functions ──────────────────────────────────────

async def send_verification_email(email: str, full_name: str, token: str):
    verify_url = f"{settings.FRONTEND_URL}/verificar-email?token={token}"
    html = render_template("verification.html", name=full_name, verify_url=verify_url)
    await send_email(email, "Confirme seu e-mail — Quanto Vale", html)


async def send_password_reset_email(email: str, full_name: str, token: str):
    reset_url = f"{settings.FRONTEND_URL}/redefinir-senha?token={token}"
    html = render_template("password_reset.html", name=full_name, reset_url=reset_url)
    await send_email(email, "Redefinir senha — Quanto Vale", html)


async def send_payment_confirmation_email(email: str, full_name: str, plan: str, amount: float):
    html = render_template("payment_confirmation.html", name=full_name, plan=plan, amount=f"R${amount:.2f}")
    await send_email(email, "Pagamento confirmado — Quanto Vale", html)


async def send_report_ready_email(email: str, full_name: str, company_name: str, download_url: str):
    html = render_template("report_ready.html", name=full_name, company_name=company_name, download_url=download_url)
    await send_email(email, f"Relatório pronto: {company_name} — Quanto Vale", html)


async def send_report_updated_email(email: str, full_name: str, company_name: str, version: int, download_url: str):
    html = render_template("report_updated.html", name=full_name, company_name=company_name, version=version, download_url=download_url)
    await send_email(email, f"Nova versão do relatório: {company_name} — Quanto Vale", html)


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
    )
    await send_email(email, "Seu Diagnóstico Gratuito — Quanto Vale", html)
