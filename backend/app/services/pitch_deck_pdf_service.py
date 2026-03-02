"""
Quanto Vale — Pitch Deck PDF Generator
Design premium, tema esmeralda/navy, 13 seções.
Mesmo padrão visual do relatório de valuation.
"""
import os
import uuid
import math
from datetime import datetime
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, HRFlowable, KeepTogether,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Circle

from app.core.config import settings

# Premium Color Palette (same as valuation report)
NAVY = HexColor("#0f172a")
NAVY_MID = HexColor("#1e293b")
NAVY_LIGHT = HexColor("#334155")
EMERALD = HexColor("#059669")
EMERALD_DARK = HexColor("#047857")
EMERALD_LIGHT = HexColor("#d1fae5")
EMERALD_PALE = HexColor("#ecfdf5")
TEAL = HexColor("#0d9488")
WHITE = HexColor("#ffffff")
BLACK = HexColor("#000000")
GRAY_900 = HexColor("#111827")
GRAY_700 = HexColor("#374151")
GRAY_600 = HexColor("#4b5563")
GRAY_500 = HexColor("#6b7280")
GRAY_400 = HexColor("#9ca3af")
GRAY_300 = HexColor("#d1d5db")
GRAY_200 = HexColor("#e5e7eb")
GRAY_100 = HexColor("#f3f4f6")
GRAY_50 = HexColor("#f9fafb")
GREEN = HexColor("#16a34a")
RED = HexColor("#dc2626")
AMBER = HexColor("#d97706")
PURPLE = HexColor("#8b5cf6")
BLUE = HexColor("#3b82f6")


def _get_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("CoverTitle", fontName="Helvetica-Bold", fontSize=36,
        textColor=WHITE, alignment=TA_LEFT, leading=42, spaceAfter=6))
    styles.add(ParagraphStyle("CoverSubtitle", fontName="Helvetica", fontSize=14,
        textColor=HexColor("#94a3b8"), alignment=TA_LEFT, leading=20, spaceAfter=4))
    styles.add(ParagraphStyle("CoverCompany", fontName="Helvetica-Bold", fontSize=26,
        textColor=EMERALD, alignment=TA_LEFT, leading=32, spaceAfter=8))
    styles.add(ParagraphStyle("CoverMeta", fontName="Helvetica", fontSize=9,
        textColor=HexColor("#64748b"), alignment=TA_LEFT, leading=14, spaceAfter=3))
    styles.add(ParagraphStyle("SectionTitle", fontName="Helvetica-Bold", fontSize=18,
        textColor=NAVY, spaceBefore=4, spaceAfter=6, leading=22))
    styles.add(ParagraphStyle("SubSection", fontName="Helvetica-Bold", fontSize=12,
        textColor=EMERALD_DARK, spaceBefore=10, spaceAfter=6, leading=16))
    styles.add(ParagraphStyle("Body", fontName="Helvetica", fontSize=10,
        textColor=GRAY_600, alignment=TA_JUSTIFY, leading=16, spaceAfter=8))
    styles.add(ParagraphStyle("BodySmall", fontName="Helvetica", fontSize=8.5,
        textColor=GRAY_500, alignment=TA_JUSTIFY, leading=13, spaceAfter=5))
    styles.add(ParagraphStyle("ValueHero", fontName="Helvetica-Bold", fontSize=32,
        textColor=NAVY, alignment=TA_CENTER, spaceBefore=10, spaceAfter=8, leading=38))
    styles.add(ParagraphStyle("ValueLabel", fontName="Helvetica", fontSize=10,
        textColor=GRAY_500, alignment=TA_CENTER, spaceBefore=2, spaceAfter=14))
    styles.add(ParagraphStyle("Footer", fontName="Helvetica", fontSize=7.5,
        textColor=GRAY_400, alignment=TA_CENTER))
    styles.add(ParagraphStyle("Disclaimer", fontName="Helvetica", fontSize=7.5,
        textColor=GRAY_500, alignment=TA_JUSTIFY, leading=11, spaceAfter=4))
    styles.add(ParagraphStyle("Quote", fontName="Helvetica-Bold", fontSize=14,
        textColor=EMERALD_DARK, alignment=TA_CENTER, leading=20, spaceBefore=10, spaceAfter=10))
    styles.add(ParagraphStyle("CardTitle", fontName="Helvetica-Bold", fontSize=11,
        textColor=NAVY, spaceBefore=2, spaceAfter=2, leading=14))
    styles.add(ParagraphStyle("CardBody", fontName="Helvetica", fontSize=9,
        textColor=GRAY_600, leading=13, spaceAfter=4))
    return styles


def _format_brl(value):
    if value is None:
        return "—"
    if abs(value) >= 1_000_000:
        return f"R$ {value/1_000_000:,.2f}M"
    elif abs(value) >= 1_000:
        return f"R$ {value/1_000:,.1f}K"
    return f"R$ {value:,.2f}"


def _footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setStrokeColor(EMERALD)
    canvas.setLineWidth(1.2)
    canvas.line(2.5 * cm, 20 * mm, w - 2.5 * cm, 20 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(GRAY_400)
    canvas.drawString(2.5 * cm, 14 * mm, "Quanto Vale · Pitch Deck  ·  quantovale.online")
    canvas.drawRightString(w - 2.5 * cm, 14 * mm, f"Página {doc.page}")
    canvas.restoreState()


def _cover_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    # Navy background
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)
    # Emerald left accent
    canvas.setFillColor(EMERALD)
    canvas.rect(0, 0, 6 * mm, h, fill=1, stroke=0)
    # Decorative circles
    canvas.setFillColor(HexColor("#1e293b"))
    canvas.circle(w - 40 * mm, h - 40 * mm, 80 * mm, fill=1, stroke=0)
    canvas.setFillColor(HexColor("#1a2332"))
    canvas.circle(w - 30 * mm, h - 50 * mm, 50 * mm, fill=1, stroke=0)
    # Bottom bar
    canvas.setFillColor(EMERALD_DARK)
    canvas.rect(0, 0, w, 28 * mm, fill=1, stroke=0)
    canvas.setFillColor(EMERALD)
    canvas.rect(0, 0, w, 3 * mm, fill=1, stroke=0)
    # Bottom text
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(HexColor("#a7f3d0"))
    canvas.drawCentredString(w / 2, 12 * mm, "quantovale.online  ·  Investor Pitch Deck")
    canvas.restoreState()


def _section_header(story, title, styles):
    bar = HRFlowable(width="100%", thickness=3, color=EMERALD, spaceAfter=0, spaceBefore=0)
    story.append(bar)
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(title, styles["SectionTitle"]))
    story.append(Spacer(1, 3 * mm))


def _build_table(story, data, col_widths=None, accent_color=None):
    if col_widths is None:
        col_widths = [250, 200]
    if accent_color is None:
        accent_color = EMERALD_DARK
    table = Table(data, colWidths=col_widths)
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("BACKGROUND", (0, 0), (-1, 0), accent_color),
        ("TOPPADDING", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("FONTNAME", (0, 1), (0, -1), "Helvetica"),
        ("FONTNAME", (1, 1), (1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("TEXTCOLOR", (0, 1), (0, -1), GRAY_600),
        ("TEXTCOLOR", (1, 1), (1, -1), NAVY),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("TOPPADDING", (0, 1), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 7),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_50]),
        ("LINEBELOW", (0, 0), (-1, 0), 2, accent_color),
        ("LINEBELOW", (0, 1), (-1, -2), 0.5, GRAY_200),
        ("LINEBELOW", (0, -1), (-1, -1), 1, GRAY_300),
    ]))
    story.append(table)


def _draw_revenue_chart(story, projections):
    """Bar chart for revenue/expenses/profit projections."""
    if not projections:
        return
    W, H = 450, 200
    d = Drawing(W, H + 30)
    d.add(String(0, H + 15, "Projeções Financeiras", fontName="Helvetica-Bold", fontSize=10, fillColor=NAVY))

    n = len(projections)
    margin_l, margin_r, margin_b = 65, 20, 30
    chart_w = W - margin_l - margin_r
    chart_h = H - margin_b - 10

    all_vals = []
    for p in projections:
        all_vals.extend([p.get("revenue", 0), p.get("expenses", 0), abs(p.get("profit", 0))])
    max_val = max(all_vals) if all_vals else 1
    if max_val == 0:
        max_val = 1

    bar_group_w = chart_w / n
    bar_w = bar_group_w * 0.22

    # Y-axis gridlines
    for i in range(5):
        y = margin_b + (chart_h * i / 4)
        d.add(Line(margin_l, y, W - margin_r, y, strokeColor=GRAY_200, strokeWidth=0.5))
        label_val = max_val * i / 4
        d.add(String(2, y - 3, _format_brl(label_val), fontName="Helvetica", fontSize=5.5, fillColor=GRAY_500))

    d.add(Line(margin_l, margin_b, W - margin_r, margin_b, strokeColor=GRAY_300, strokeWidth=1))

    for i, p in enumerate(projections):
        rev = p.get("revenue", 0)
        exp = p.get("expenses", 0)
        profit = p.get("profit", 0)
        x_center = margin_l + bar_group_w * i + bar_group_w / 2

        rev_h = (rev / max_val) * chart_h if max_val > 0 else 0
        d.add(Rect(x_center - bar_w * 1.5, margin_b, bar_w, max(rev_h, 0.5),
                    fillColor=EMERALD, strokeColor=None))

        exp_h = (exp / max_val) * chart_h if max_val > 0 else 0
        d.add(Rect(x_center - bar_w * 0.3, margin_b, bar_w, max(exp_h, 0.5),
                    fillColor=AMBER, strokeColor=None))

        prof_h = (abs(profit) / max_val) * chart_h if max_val > 0 else 0
        prof_color = TEAL if profit >= 0 else RED
        d.add(Rect(x_center + bar_w * 0.9, margin_b, bar_w, max(prof_h, 0.5),
                    fillColor=prof_color, strokeColor=None))

        year = p.get("year", i + 1)
        d.add(String(x_center - 10, margin_b - 12, str(year),
                      fontName="Helvetica", fontSize=7, fillColor=GRAY_600))

    # Legend
    lx = margin_l
    d.add(Rect(lx, H + 5, 8, 8, fillColor=EMERALD, strokeColor=None))
    d.add(String(lx + 11, H + 5, "Receita", fontName="Helvetica", fontSize=7, fillColor=GRAY_600))
    d.add(Rect(lx + 55, H + 5, 8, 8, fillColor=AMBER, strokeColor=None))
    d.add(String(lx + 66, H + 5, "Despesas", fontName="Helvetica", fontSize=7, fillColor=GRAY_600))
    d.add(Rect(lx + 120, H + 5, 8, 8, fillColor=TEAL, strokeColor=None))
    d.add(String(lx + 131, H + 5, "Lucro", fontName="Helvetica", fontSize=7, fillColor=GRAY_600))

    story.append(d)
    story.append(Spacer(1, 6 * mm))


def _draw_milestone_timeline(story, milestones):
    """Visual timeline for milestones."""
    if not milestones:
        return
    W = 450
    item_h = 38
    H = min(len(milestones) * item_h + 30, 600)
    d = Drawing(W, H)

    d.add(String(0, H - 8, "Roadmap — Marcos Estratégicos", fontName="Helvetica-Bold", fontSize=10, fillColor=NAVY))

    line_x = 40
    # Vertical line
    d.add(Line(line_x, H - 25, line_x, max(H - 25 - len(milestones) * item_h, 5),
               strokeColor=EMERALD, strokeWidth=2))

    for i, m in enumerate(milestones[:12]):  # max 12
        y = H - 30 - i * item_h
        status = m.get("status", "upcoming")
        color = EMERALD if status == "completed" else AMBER if status == "in_progress" else GRAY_400

        # Dot on timeline
        d.add(Circle(line_x, y + 8, 5, fillColor=color, strokeColor=WHITE, strokeWidth=1.5))

        # Date
        date_str = m.get("date", "")
        if date_str:
            d.add(String(line_x + 14, y + 14, date_str[:20],
                          fontName="Helvetica", fontSize=6.5, fillColor=GRAY_500))

        # Title
        title = m.get("title", "")[:50]
        d.add(String(line_x + 14, y + 3, title,
                      fontName="Helvetica-Bold", fontSize=8, fillColor=NAVY))

        # Description
        desc = m.get("description", "")
        if desc:
            d.add(String(line_x + 14, y - 8, desc[:80],
                          fontName="Helvetica", fontSize=6.5, fillColor=GRAY_500))

    story.append(d)
    story.append(Spacer(1, 6 * mm))


def _draw_funding_breakdown(story, funding):
    """Donut chart for funding allocation."""
    if not funding:
        return
    breakdown = funding.get("breakdown", [])
    if not breakdown:
        return

    total = sum(item.get("value", 0) for item in breakdown)
    if total <= 0:
        return

    W, H = 400, 180
    d = Drawing(W, H + 15)
    d.add(String(0, H + 2, "Destinação dos Recursos", fontName="Helvetica-Bold", fontSize=10, fillColor=NAVY))

    cx, cy = 100, H / 2 - 5
    outer_r = 65
    inner_r = 38
    colors = [EMERALD, TEAL, BLUE, PURPLE, AMBER, RED, GREEN, GRAY_600]

    from reportlab.graphics.shapes import Wedge
    start_angle = 90
    for i, item in enumerate(breakdown[:8]):
        val = item.get("value", 0)
        if val <= 0:
            continue
        pct = val / total * 100
        sweep = pct * 3.6
        color = colors[i % len(colors)]
        w = Wedge(cx, cy, outer_r, start_angle, start_angle + sweep,
                  fillColor=color, strokeColor=WHITE, strokeWidth=1.5)
        d.add(w)
        start_angle += sweep

    # White center
    d.add(Circle(cx, cy, inner_r, fillColor=WHITE, strokeColor=None))
    d.add(String(cx - 18, cy + 4, "Total",
                  fontName="Helvetica", fontSize=7, fillColor=GRAY_500))
    d.add(String(cx - 25, cy - 8, _format_brl(total),
                  fontName="Helvetica-Bold", fontSize=8, fillColor=NAVY))

    # Legend
    lx = 190
    for i, item in enumerate(breakdown[:8]):
        val = item.get("value", 0)
        if val <= 0:
            continue
        pct = val / total * 100
        ly = H / 2 + 50 - i * 20
        color = colors[i % len(colors)]
        d.add(Rect(lx, ly, 10, 10, fillColor=color, strokeColor=None))
        label = item.get("label", f"Item {i+1}")[:25]
        d.add(String(lx + 14, ly + 1, f"{label}",
                      fontName="Helvetica-Bold", fontSize=7, fillColor=GRAY_700))
        d.add(String(lx + 14, ly - 9, f"{_format_brl(val)} ({pct:.0f}%)",
                      fontName="Helvetica", fontSize=6.5, fillColor=GRAY_500))

    story.append(d)
    story.append(Spacer(1, 6 * mm))


def generate_pitch_deck_pdf(deck, analysis_data=None):
    """
    Generate the Pitch Deck PDF.

    Args:
        deck: PitchDeck SQLAlchemy model instance
        analysis_data: dict with valuation data if linked to an analysis
    Returns:
        filepath: str path to generated PDF
    """
    report_id = str(uuid.uuid4())[:8].upper()
    timestamp = datetime.now().strftime("%d/%m/%Y %H:%M")

    output_dir = Path(settings.REPORTS_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = f"pitchdeck-{deck.id}-{report_id}.pdf"
    filepath = str(output_dir / filename)

    styles = _get_styles()
    doc = SimpleDocTemplate(
        filepath, pagesize=A4,
        topMargin=2 * cm, bottomMargin=2.5 * cm,
        leftMargin=2.5 * cm, rightMargin=2.5 * cm,
        title=f"Pitch Deck — {deck.company_name}",
        author="Quanto Vale · quantovale.online",
        subject="Investor Pitch Deck",
        creator="Quanto Vale (quantovale.online)",
    )

    story = []

    # ═══════════════════════════════════════════════════════
    # COVER PAGE
    # ═══════════════════════════════════════════════════════
    logo_spacer = 70
    if deck.logo_path:
        try:
            logo_full_path = Path(settings.UPLOADS_DIR) / deck.logo_path
            if logo_full_path.exists():
                logo_img = Image(str(logo_full_path), width=50 * mm, height=50 * mm, kind='proportional')
                logo_img.hAlign = 'LEFT'
                story.append(Spacer(1, 30 * mm))
                story.append(logo_img)
                story.append(Spacer(1, 8 * mm))
                logo_spacer = 5
        except Exception:
            pass

    story.append(Spacer(1, logo_spacer * mm))
    story.append(Paragraph("INVESTOR PITCH DECK", ParagraphStyle(
        "CoverLabel", fontName="Helvetica-Bold", fontSize=11, textColor=EMERALD,
        alignment=TA_LEFT, spaceAfter=6)))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(deck.company_name, styles["CoverTitle"]))
    story.append(Spacer(1, 4 * mm))

    if deck.slogan:
        story.append(Paragraph(deck.slogan, styles["CoverSubtitle"]))
        story.append(Spacer(1, 4 * mm))
    if deck.sector:
        story.append(Paragraph(f"Setor: {deck.sector.capitalize()}", styles["CoverSubtitle"]))

    story.append(Spacer(1, 20 * mm))

    meta_lines = [
        f"Documento #{report_id}  ·  {timestamp}",
    ]
    if deck.contact_email:
        meta_lines.append(f"Contato: {deck.contact_email}")
    if deck.contact_phone:
        meta_lines.append(f"Telefone: {deck.contact_phone}")
    if deck.website:
        meta_lines.append(f"Website: {deck.website}")
    meta_lines.append("Gerado por Quanto Vale · quantovale.online")

    for line in meta_lines:
        story.append(Paragraph(line, styles["CoverMeta"]))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════
    # 1. HEADLINE ESTRATÉGICA
    # ═══════════════════════════════════════════════════════
    headline_text = deck.ai_headline or deck.headline
    if headline_text:
        _section_header(story, "Visão Geral", styles)
        story.append(Paragraph(f'<i>"{headline_text}"</i>', styles["Quote"]))
        story.append(Spacer(1, 6 * mm))

    # Company summary card
    summary_data = [["Dado", "Detalhe"]]
    summary_data.append(["Empresa", deck.company_name])
    if deck.sector:
        summary_data.append(["Setor", deck.sector.capitalize()])
    if deck.website:
        summary_data.append(["Website", deck.website])
    if deck.contact_email:
        summary_data.append(["E-mail", deck.contact_email])
    if deck.contact_phone:
        summary_data.append(["Telefone", deck.contact_phone])
    if len(summary_data) > 1:
        _build_table(story, summary_data)
        story.append(Spacer(1, 6 * mm))

    # If linked to valuation, show equity value hero
    if analysis_data and analysis_data.get("equity_value"):
        story.append(Paragraph(
            _format_brl(analysis_data["equity_value"]),
            styles["ValueHero"]))
        story.append(Paragraph("Valuation Estimado (DCF)", styles["ValueLabel"]))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════
    # 2. PROBLEMA
    # ═══════════════════════════════════════════════════════
    problem_text = deck.ai_problem or deck.problem
    if problem_text:
        _section_header(story, "Problema", styles)
        story.append(Paragraph(
            "Todo grande negócio começa resolvendo um problema real de mercado.",
            styles["BodySmall"]))
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph(problem_text, styles["Body"]))
        story.append(Spacer(1, 8 * mm))

    # ═══════════════════════════════════════════════════════
    # 3. SOLUÇÃO
    # ═══════════════════════════════════════════════════════
    solution_text = deck.ai_solution or deck.solution
    if solution_text:
        _section_header(story, "Nossa Solução", styles)
        story.append(Paragraph(solution_text, styles["Body"]))
        story.append(Spacer(1, 8 * mm))

    # ═══════════════════════════════════════════════════════
    # 4. MERCADO-ALVO
    # ═══════════════════════════════════════════════════════
    target = deck.target_market
    if target:
        _section_header(story, "Mercado-Alvo", styles)
        if target.get("description"):
            story.append(Paragraph(target["description"], styles["Body"]))
            story.append(Spacer(1, 4 * mm))

        market_data = [["Métrica", "Valor"]]
        if target.get("tam"):
            market_data.append(["TAM (Mercado Total)", target["tam"]])
        if target.get("sam"):
            market_data.append(["SAM (Mercado Endereçável)", target["sam"]])
        if target.get("som"):
            market_data.append(["SOM (Mercado Atingível)", target["som"]])
        if len(market_data) > 1:
            _build_table(story, market_data)

        segments = target.get("segments", [])
        if segments:
            story.append(Spacer(1, 4 * mm))
            story.append(Paragraph("<b>Segmentos-alvo:</b>", styles["Body"]))
            for seg in segments[:10]:
                story.append(Paragraph(f"  ● {seg}", styles["Body"]))

        story.append(Spacer(1, 8 * mm))

    # ═══════════════════════════════════════════════════════
    # 5. CENÁRIO COMPETITIVO
    # ═══════════════════════════════════════════════════════
    competitors = deck.competitive_landscape
    if competitors:
        _section_header(story, "Cenário Competitivo", styles)
        comp_data = [["Concorrente", "Nossa Vantagem"]]
        for c in competitors[:8]:
            comp_data.append([c.get("competitor", ""), c.get("advantage", "")])
        _build_table(story, comp_data)
        story.append(Spacer(1, 8 * mm))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════
    # 6. MODELO DE NEGÓCIOS
    # ═══════════════════════════════════════════════════════
    bm_text = deck.ai_business_model or deck.business_model
    if bm_text:
        _section_header(story, "Modelo de Negócios", styles)
        story.append(Paragraph(bm_text, styles["Body"]))
        story.append(Spacer(1, 8 * mm))

    # ═══════════════════════════════════════════════════════
    # 7. CANAIS DE VENDAS
    # ═══════════════════════════════════════════════════════
    sales_text = deck.ai_sales_channels or deck.sales_channels
    if sales_text:
        _section_header(story, "Canais de Vendas", styles)
        story.append(Paragraph(sales_text, styles["Body"]))
        story.append(Spacer(1, 8 * mm))

    # ═══════════════════════════════════════════════════════
    # 8. ATIVIDADES DE MARKETING
    # ═══════════════════════════════════════════════════════
    marketing_text = deck.ai_marketing or deck.marketing_activities
    if marketing_text:
        _section_header(story, "Marketing & Crescimento", styles)
        story.append(Paragraph(marketing_text, styles["Body"]))
        story.append(Spacer(1, 8 * mm))

    # ═══════════════════════════════════════════════════════
    # 9. PROJEÇÕES FINANCEIRAS
    # ═══════════════════════════════════════════════════════
    projections = deck.financial_projections
    if projections:
        _section_header(story, "Projeções Financeiras", styles)

        # Chart
        _draw_revenue_chart(story, projections)

        # Table
        proj_data = [["Ano", "Receita", "Despesas", "Lucro"]]
        for p in projections:
            proj_data.append([
                str(p.get("year", "")),
                _format_brl(p.get("revenue", 0)),
                _format_brl(p.get("expenses", 0)),
                _format_brl(p.get("profit", 0)),
            ])
        _build_table(story, proj_data, col_widths=[80, 130, 130, 130])
        story.append(Spacer(1, 8 * mm))

    # If linked to valuation, pull projections from there
    elif analysis_data:
        vr = analysis_data.get("valuation_result", {})
        fcf_proj = vr.get("fcf_projections", [])
        if fcf_proj:
            _section_header(story, "Projeções Financeiras (DCF)", styles)
            proj_data = [["Ano", "Receita", "FCFE"]]
            for p in fcf_proj[:10]:
                proj_data.append([
                    f"Ano {p.get('year', '')}",
                    _format_brl(p.get("revenue", 0)),
                    _format_brl(p.get("fcf", 0)),
                ])
            _build_table(story, proj_data, col_widths=[100, 175, 175])
            story.append(Spacer(1, 8 * mm))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════
    # 10. NECESSIDADE DE CAPITAL
    # ═══════════════════════════════════════════════════════
    funding = deck.funding_needs
    if funding:
        _section_header(story, "Necessidade de Capital", styles)
        amount = funding.get("amount", 0)
        if amount:
            story.append(Paragraph(_format_brl(amount), styles["ValueHero"]))
            story.append(Paragraph("Capital buscado", styles["ValueLabel"]))

        desc = deck.ai_funding_use or funding.get("description", "")
        if desc:
            story.append(Paragraph(desc, styles["Body"]))
            story.append(Spacer(1, 4 * mm))

        # Breakdown chart
        _draw_funding_breakdown(story, funding)

        # Breakdown table
        breakdown = funding.get("breakdown", [])
        if breakdown:
            bd_data = [["Destinação", "Valor"]]
            for item in breakdown:
                bd_data.append([item.get("label", ""), _format_brl(item.get("value", 0))])
            _build_table(story, bd_data)
        story.append(Spacer(1, 8 * mm))

    # ═══════════════════════════════════════════════════════
    # 11. MILESTONES / ROADMAP
    # ═══════════════════════════════════════════════════════
    milestones = deck.milestones
    if milestones:
        _section_header(story, "Roadmap — Marcos Estratégicos", styles)
        _draw_milestone_timeline(story, milestones)
        story.append(PageBreak())

    # ═══════════════════════════════════════════════════════
    # 12. EQUIPE
    # ═══════════════════════════════════════════════════════
    team = deck.team
    if team:
        _section_header(story, "Equipe", styles)

        team_rows = []
        for i in range(0, len(team[:8]), 2):
            left = team[i]
            right = team[i + 1] if i + 1 < len(team) else None

            def _team_card(member):
                if not member:
                    return ""
                name = member.get("name", "")
                role = member.get("role", "")
                return Paragraph(
                    f'<font face="Helvetica-Bold" size="11" color="{NAVY.hexval()}">{name}</font><br/>'
                    f'<font face="Helvetica" size="9" color="{GRAY_500.hexval()}">{role}</font>',
                    ParagraphStyle("TeamCard", alignment=TA_CENTER, leading=16, spaceBefore=6, spaceAfter=6)
                )

            team_rows.append([_team_card(left), _team_card(right)])

        team_table = Table(team_rows, colWidths=[225, 225])
        team_table.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOX", (0, 0), (-1, -1), 0.5, GRAY_300),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, GRAY_200),
            ("TOPPADDING", (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ("BACKGROUND", (0, 0), (-1, -1), GRAY_50),
        ]))
        story.append(team_table)
        story.append(Spacer(1, 8 * mm))

    # ═══════════════════════════════════════════════════════
    # 13. PARCEIROS E RECURSOS
    # ═══════════════════════════════════════════════════════
    partners = deck.partners_resources
    if partners:
        _section_header(story, "Parceiros & Recursos", styles)
        partner_items = []
        for p in partners[:8]:
            partner_items.append(Paragraph(
                f'● <b>{p.get("name", "")}</b>',
                ParagraphStyle("PartnerItem", fontName="Helvetica", fontSize=10,
                               textColor=GRAY_700, leading=16, spaceAfter=4)
            ))
        for item in partner_items:
            story.append(item)
        story.append(Spacer(1, 8 * mm))

    # ═══════════════════════════════════════════════════════
    # VALUATION SUMMARY (if linked)
    # ═══════════════════════════════════════════════════════
    if analysis_data:
        story.append(PageBreak())
        _section_header(story, "Valuation — Resumo Executivo", styles)

        equity = analysis_data.get("equity_value")
        if equity:
            story.append(Paragraph(_format_brl(equity), styles["ValueHero"]))
            story.append(Paragraph("Valor Estimado do Equity (DCF)", styles["ValueLabel"]))

        vr = analysis_data.get("valuation_result", {})
        val_data = [["Indicador", "Valor"]]
        if analysis_data.get("revenue"):
            val_data.append(["Receita Anual", _format_brl(analysis_data["revenue"])])
        if analysis_data.get("net_margin"):
            val_data.append(["Margem Líquida", f"{analysis_data['net_margin'] * 100:.1f}%"])
        if analysis_data.get("growth_rate"):
            val_data.append(["Crescimento", f"{analysis_data['growth_rate'] * 100:.1f}%"])
        if analysis_data.get("ebitda"):
            val_data.append(["EBITDA", _format_brl(analysis_data["ebitda"])])
        if vr.get("wacc"):
            val_data.append(["Ke (Custo de Capital)", f"{vr['wacc'] * 100:.1f}%"])
        if analysis_data.get("risk_score"):
            val_data.append(["Score de Risco", f"{analysis_data['risk_score']:.0f}/100"])
        if len(val_data) > 1:
            _build_table(story, val_data)
        story.append(Spacer(1, 8 * mm))

        # Valuation range
        val_range = vr.get("valuation_range", {})
        if val_range:
            range_data = [["Cenário", "Valor"]]
            if val_range.get("low"):
                range_data.append(["Conservador", _format_brl(val_range["low"])])
            if val_range.get("mid"):
                range_data.append(["Base", _format_brl(val_range["mid"])])
            if val_range.get("high"):
                range_data.append(["Otimista", _format_brl(val_range["high"])])
            if len(range_data) > 1:
                _build_table(story, range_data)

    # ═══════════════════════════════════════════════════════
    # DISCLAIMER
    # ═══════════════════════════════════════════════════════
    story.append(PageBreak())
    _section_header(story, "Disclaimer Legal", styles)
    story.append(Paragraph(
        "Este Pitch Deck foi gerado pela plataforma Quanto Vale (quantovale.online) com base "
        "em informações fornecidas pelo usuário. As projeções financeiras são estimativas e não "
        "constituem garantia de resultados futuros. Dados de valuation, quando presentes, são "
        "baseados em metodologia DCF (Discounted Cash Flow) com parâmetros setoriais públicos. "
        "Este documento não substitui parecer jurídico, contábil ou de assessoria financeira "
        "profissional. A Quanto Vale não se responsabiliza por decisões de investimento baseadas "
        "neste material. Todos os dados são confidenciais.", styles["Disclaimer"]))

    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph(
        "Gerado por <b>Quanto Vale</b> · quantovale.online",
        ParagraphStyle("FinalNote", fontName="Helvetica", fontSize=9,
                       textColor=EMERALD_DARK, alignment=TA_CENTER, leading=14)))

    # Build PDF
    doc.build(story, onFirstPage=_cover_page, onLaterPages=_footer)
    return filepath
