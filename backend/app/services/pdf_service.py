"""
Quanto Vale \u2014 PDF Report Generator v4
Relat\u00f3rio premium, design executivo, tema esmeralda/navy.
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
    PageBreak, Image, HRFlowable, KeepTogether, Frame, PageTemplate,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Circle
from reportlab.graphics import renderPDF

from app.core.config import settings

# Premium Color Palette
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
GREEN_LIGHT = HexColor("#f0fdf4")
RED = HexColor("#dc2626")
RED_LIGHT = HexColor("#fef2f2")
AMBER = HexColor("#d97706")
AMBER_LIGHT = HexColor("#fffbeb")
GOLD = HexColor("#b8860b")


def get_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("CoverTitle", fontName="Helvetica-Bold", fontSize=32,
        textColor=WHITE, alignment=TA_LEFT, leading=38, spaceAfter=6))
    styles.add(ParagraphStyle("CoverSubtitle", fontName="Helvetica", fontSize=13,
        textColor=HexColor("#94a3b8"), alignment=TA_LEFT, leading=18, spaceAfter=4))
    styles.add(ParagraphStyle("CoverCompany", fontName="Helvetica-Bold", fontSize=24,
        textColor=EMERALD, alignment=TA_LEFT, leading=30, spaceAfter=8))
    styles.add(ParagraphStyle("CoverMeta", fontName="Helvetica", fontSize=9,
        textColor=HexColor("#64748b"), alignment=TA_LEFT, leading=14, spaceAfter=3))
    styles.add(ParagraphStyle("SectionTitle", fontName="Helvetica-Bold", fontSize=16,
        textColor=NAVY, spaceBefore=4, spaceAfter=4, leading=20))
    styles.add(ParagraphStyle("SubSection", fontName="Helvetica-Bold", fontSize=12,
        textColor=EMERALD_DARK, spaceBefore=14, spaceAfter=6, leading=16))
    styles.add(ParagraphStyle("Body", fontName="Helvetica", fontSize=9.5,
        textColor=GRAY_600, alignment=TA_JUSTIFY, leading=15, spaceAfter=6))
    styles.add(ParagraphStyle("BodySmall", fontName="Helvetica", fontSize=8.5,
        textColor=GRAY_500, alignment=TA_JUSTIFY, leading=13, spaceAfter=5))
    styles.add(ParagraphStyle("ValueHero", fontName="Helvetica-Bold", fontSize=30,
        textColor=NAVY, alignment=TA_CENTER, spaceBefore=8, spaceAfter=2))
    styles.add(ParagraphStyle("ValueLabel", fontName="Helvetica", fontSize=9,
        textColor=GRAY_500, alignment=TA_CENTER, spaceAfter=12))
    styles.add(ParagraphStyle("Footer", fontName="Helvetica", fontSize=7.5,
        textColor=GRAY_400, alignment=TA_CENTER))
    styles.add(ParagraphStyle("Disclaimer", fontName="Helvetica", fontSize=7.5,
        textColor=GRAY_500, alignment=TA_JUSTIFY, leading=11, spaceAfter=4))
    styles.add(ParagraphStyle("TOCEntry", fontName="Helvetica", fontSize=10,
        textColor=GRAY_700, spaceAfter=5, leftIndent=8, leading=15))
    styles.add(ParagraphStyle("GlossaryTerm", fontName="Helvetica-Bold", fontSize=9,
        textColor=NAVY, spaceBefore=6, spaceAfter=1))
    styles.add(ParagraphStyle("GlossaryDef", fontName="Helvetica", fontSize=8.5,
        textColor=GRAY_600, leftIndent=10, spaceAfter=5, leading=13))
    return styles


def format_brl(value):
    if value is None:
        return "\u2014"
    if abs(value) >= 1_000_000:
        return f"R$ {value/1_000_000:,.2f}M"
    elif abs(value) >= 1_000:
        return f"R$ {value/1_000:,.1f}K"
    return f"R$ {value:,.2f}"


def format_pct(value):
    if value is None:
        return "\u2014"
    return f"{value*100:.1f}%"


def _premium_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setStrokeColor(EMERALD)
    canvas.setLineWidth(1.2)
    canvas.line(2.5 * cm, 20 * mm, w - 2.5 * cm, 20 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(GRAY_400)
    canvas.drawString(2.5 * cm, 14 * mm, "Quanto Vale  \u00b7  quantovale.online")
    canvas.drawRightString(w - 2.5 * cm, 14 * mm, f"P\u00e1gina {doc.page}")
    canvas.restoreState()


def _cover_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)
    canvas.setFillColor(EMERALD)
    canvas.rect(0, 0, 6 * mm, h, fill=1, stroke=0)
    canvas.setFillColor(HexColor("#1e293b"))
    canvas.circle(w - 40 * mm, h - 40 * mm, 80 * mm, fill=1, stroke=0)
    canvas.setFillColor(HexColor("#1a2332"))
    canvas.circle(w - 30 * mm, h - 50 * mm, 50 * mm, fill=1, stroke=0)
    canvas.setFillColor(EMERALD_DARK)
    canvas.rect(0, 0, w, 28 * mm, fill=1, stroke=0)
    canvas.setFillColor(EMERALD)
    canvas.rect(0, 0, w, 3 * mm, fill=1, stroke=0)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(HexColor("#a7f3d0"))
    canvas.drawCentredString(w / 2, 12 * mm, "quantovale.online  \u00b7  Valuation Empresarial Inteligente")
    canvas.restoreState()


def _section_header(story, title, styles, icon_char=None):
    bar = HRFlowable(width="100%", thickness=3, color=EMERALD, spaceAfter=0, spaceBefore=0)
    story.append(bar)
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(title, styles["SectionTitle"]))
    story.append(Spacer(1, 2 * mm))


def _build_premium_table(story, data, col_widths=None, accent_color=None):
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
        ("LINEAFTER", (0, 0), (0, -1), 0.5, GRAY_200),
    ]))
    story.append(table)


def _build_wide_table(story, data, col_widths=None, accent_color=None):
    if accent_color is None:
        accent_color = EMERALD_DARK
    if col_widths is None:
        n = len(data[0]) if data else 2
        col_widths = [int(450 / n)] * n
    table = Table(data, colWidths=col_widths)
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("BACKGROUND", (0, 0), (-1, 0), accent_color),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_50]),
        ("LINEBELOW", (0, 0), (-1, 0), 2, accent_color),
        ("LINEBELOW", (0, 1), (-1, -2), 0.5, GRAY_200),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAY_300),
    ]))
    story.append(table)


def _value_card(story, value_text, label_text, styles, color=None):
    if color is None:
        color = NAVY
    story.append(Paragraph(value_text, ParagraphStyle(
        "ValCard", parent=styles["ValueHero"], textColor=color)))
    story.append(Paragraph(label_text, styles["ValueLabel"]))


def _scenario_table(story, val_range, styles):
    data = [
        [
            Paragraph("<b>Conservador</b>", ParagraphStyle("sc", fontName="Helvetica-Bold", fontSize=8, textColor=GRAY_600, alignment=TA_CENTER)),
            Paragraph("<b>Base</b>", ParagraphStyle("sc2", fontName="Helvetica-Bold", fontSize=8, textColor=WHITE, alignment=TA_CENTER)),
            Paragraph("<b>Otimista</b>", ParagraphStyle("sc3", fontName="Helvetica-Bold", fontSize=8, textColor=GRAY_600, alignment=TA_CENTER)),
        ],
        [
            Paragraph(f"<b>{format_brl(val_range.get('low', 0))}</b>", ParagraphStyle("sv", fontName="Helvetica-Bold", fontSize=13, textColor=RED, alignment=TA_CENTER)),
            Paragraph(f"<b>{format_brl(val_range.get('mid', 0))}</b>", ParagraphStyle("sv2", fontName="Helvetica-Bold", fontSize=14, textColor=WHITE, alignment=TA_CENTER)),
            Paragraph(f"<b>{format_brl(val_range.get('high', 0))}</b>", ParagraphStyle("sv3", fontName="Helvetica-Bold", fontSize=13, textColor=GREEN, alignment=TA_CENTER)),
        ],
    ]
    t = Table(data, colWidths=[150, 150, 150])
    t.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (0, -1), GRAY_50),
        ("BACKGROUND", (1, 0), (1, -1), EMERALD_DARK),
        ("BACKGROUND", (2, 0), (2, -1), GRAY_50),
        ("BOX", (0, 0), (-1, -1), 1, GRAY_300),
        ("LINEBEFORE", (1, 0), (1, -1), 1, EMERALD),
        ("LINEAFTER", (1, 0), (1, -1), 1, EMERALD),
    ]))
    story.append(t)


def generate_report_pdf(analysis):
    from app.models.models import PlanType
    plan_type = analysis.plan
    is_prof = plan_type in (PlanType.PROFISSIONAL, PlanType.ESTRATEGICO) if plan_type else False
    is_strat = plan_type == PlanType.ESTRATEGICO if plan_type else False
    _plan_labels = {PlanType.ESSENCIAL: "Essencial", PlanType.PROFISSIONAL: "Profissional", PlanType.ESTRATEGICO: "Estrat\u00e9gico"}
    _plan_label = _plan_labels.get(plan_type, "Premium")

    report_id = str(uuid.uuid4())[:8].upper()
    timestamp = datetime.now().strftime("%d/%m/%Y %H:%M")

    output_dir = Path(settings.REPORTS_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = f"quantovale-{analysis.id}-{report_id}.pdf"
    filepath = str(output_dir / filename)

    styles = get_styles()
    doc = SimpleDocTemplate(
        filepath, pagesize=A4,
        topMargin=2 * cm, bottomMargin=2.5 * cm,
        leftMargin=2.5 * cm, rightMargin=2.5 * cm,
    )

    story = []
    result = analysis.valuation_result or {}
    params = result.get("parameters", {})
    dlom = result.get("dlom", {})
    survival = result.get("survival", {})
    qual = result.get("qualitative", {})
    tv_gordon = result.get("terminal_value_gordon", {})
    tv_exit = result.get("terminal_value_exit", {})
    multiples_val = result.get("multiples_valuation", {})
    inv_round = result.get("investment_round", {})
    projections = result.get("fcf_projections", [])
    pnl = result.get("pnl_projections", [])
    wacc_val = result.get("wacc", 0)

    # COVER PAGE
    logo_spacer = 70
    if analysis.logo_path:
        try:
            logo_full_path = Path(settings.UPLOADS_DIR) / analysis.logo_path
            if logo_full_path.exists():
                logo_img = Image(str(logo_full_path), width=45 * mm, height=45 * mm, kind='proportional')
                logo_img.hAlign = 'LEFT'
                story.append(Spacer(1, 35 * mm))
                story.append(logo_img)
                story.append(Spacer(1, 8 * mm))
                logo_spacer = 8
        except Exception:
            pass

    story.append(Spacer(1, logo_spacer * mm))
    story.append(Paragraph("RELAT\u00d3RIO DE VALUATION", ParagraphStyle(
        "CoverLabel", fontName="Helvetica-Bold", fontSize=10, textColor=EMERALD,
        alignment=TA_LEFT, spaceAfter=6)))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(analysis.company_name, styles["CoverTitle"]))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(f"Setor: {analysis.sector.capitalize()}", styles["CoverSubtitle"]))
    story.append(Spacer(1, 20 * mm))

    meta_lines = [
        f"Relat\u00f3rio #{report_id}  \u00b7  {timestamp}",
        f"Plano {_plan_label}",
        "Metodologia: DCF (Gordon + Exit Multiple) + M\u00faltiplos Damodaran",
        "Fontes: Damodaran/NYU  \u00b7  BCB/Selic  \u00b7  IBGE/SIDRA",
    ]
    for line in meta_lines:
        story.append(Paragraph(line, styles["CoverMeta"]))
    story.append(PageBreak())

    # TABLE OF CONTENTS
    _section_header(story, "Sum\u00e1rio", styles)

    toc_items = ["Resumo Executivo"]
    if is_prof:
        toc_items.append("Premissas e Dados de Entrada")
    toc_items.append("Metodologia de Valuation")
    if is_prof:
        toc_items += ["Proje\u00e7\u00e3o de Receita e FCL", "DRE Projetado (P&L)"]
    toc_items.append("DCF \u2014 Gordon Growth Model")
    if is_prof:
        toc_items += ["DCF \u2014 Exit Multiple", "M\u00faltiplos de Mercado", "Triangula\u00e7\u00e3o e Composi\u00e7\u00e3o"]
        toc_items += ["Desconto de Liquidez (DLOM)", "Taxa de Sobreviv\u00eancia"]
    if is_strat:
        toc_items.append("Avalia\u00e7\u00e3o Qualitativa")
    if is_prof:
        toc_items += ["An\u00e1lise de Sensibilidade", "Benchmark Setorial"]
    toc_items.append("Risco e Maturidade")
    if is_strat:
        toc_items.append("Simula\u00e7\u00e3o de Rodada")
        if analysis.ai_analysis:
            toc_items.append("An\u00e1lise Estrat\u00e9gica IA")
    toc_items += ["Gloss\u00e1rio", "Disclaimer Legal"]

    for i, item in enumerate(toc_items, 1):
        story.append(Paragraph(
            f'<font face="Helvetica-Bold" color="#059669">{i:02d}</font>'
            f'<font face="Helvetica" color="#374151">    {item}</font>',
            styles["TOCEntry"]))
    story.append(PageBreak())

    # RESUMO EXECUTIVO
    _section_header(story, "Resumo Executivo", styles)
    equity = result.get("equity_value", 0)
    val_range = result.get("valuation_range", {})

    _value_card(story, format_brl(equity), "Valor Estimado do Equity (ap\u00f3s todos os ajustes)", styles)
    story.append(Spacer(1, 6 * mm))
    _scenario_table(story, val_range, styles)
    story.append(Spacer(1, 8 * mm))

    key_metrics = [
        ["Indicador", "Valor"],
        ["Receita Anual", format_brl(params.get("revenue", 0))],
        ["Margem L\u00edquida", format_pct(params.get("net_margin", 0))],
        ["Crescimento", format_pct(params.get("growth_rate", 0))],
        ["WACC", format_pct(wacc_val)],
        ["Enterprise Value", format_brl(result.get("enterprise_value", 0))],
        ["Score de Risco", f"{result.get('risk_score', 0):.1f}/100"],
        ["Maturidade", f"{result.get('maturity_index', 0):.1f}/100"],
        ["DLOM (Desconto Liquidez)", format_pct(dlom.get("dlom_pct", 0))],
        ["Taxa de Sobreviv\u00eancia", format_pct(survival.get("survival_rate", 0))],
    ]
    _build_premium_table(story, key_metrics)
    story.append(PageBreak())

    # PREMISSAS (Prof+)
    if is_prof:
        _section_header(story, "Premissas e Dados de Entrada", styles)
        story.append(Paragraph(
            "Os par\u00e2metros abaixo foram utilizados como base para todos os c\u00e1lculos "
            "de valuation apresentados neste relat\u00f3rio.", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        premissas = [
            ["Par\u00e2metro", "Valor"],
            ["Receita (R$)", format_brl(params.get("revenue", 0))],
            ["Margem L\u00edquida", format_pct(params.get("net_margin", 0))],
            ["Margem EBIT (calculada)", format_pct(params.get("ebit_margin", 0))],
            ["Crescimento Informado", format_pct(params.get("growth_rate", 0))],
            ["D\u00edvida (R$)", format_brl(params.get("debt", 0))],
            ["Caixa (R$)", format_brl(params.get("cash", 0))],
            ["Depend\u00eancia do Fundador", format_pct(params.get("founder_dependency", 0))],
            ["Anos Projetados", str(params.get("projection_years", 5))],
            ["Anos de Opera\u00e7\u00e3o", str(params.get("years_in_business", 3))],
            ["Receita Recorrente", format_pct(params.get("recurring_revenue_pct", 0))],
            ["Funcion\u00e1rios", str(params.get("num_employees", 0))],
            ["Taxa Selic (Rf)", format_pct(params.get("selic_rate", 0))],
            ["Peso DCF vs M\u00faltiplos", f"{params.get('dcf_weight', 0.6)*100:.0f}% / {(1-params.get('dcf_weight', 0.6))*100:.0f}%"],
            ["Fonte de Dados", params.get("data_source", "Damodaran/NYU")],
        ]
        _build_premium_table(story, premissas)
        story.append(PageBreak())

    # METODOLOGIA
    _section_header(story, "Metodologia de Valuation", styles)
    story.append(Paragraph("<b>Abordagem Multi-M\u00e9todo (Triangula\u00e7\u00e3o)</b>", styles["SubSection"]))
    story.append(Paragraph(
        "Este relat\u00f3rio utiliza uma abordagem de triangula\u00e7\u00e3o combinando tr\u00eas metodologias "
        "reconhecidas internacionalmente para estimar o valor justo da empresa. "
        "A pondera\u00e7\u00e3o dos m\u00e9todos segue as melhores pr\u00e1ticas de M&A:", styles["Body"]))

    methods = [
        ["M\u00e9todo", "Peso", "Descri\u00e7\u00e3o"],
        ["DCF Gordon Growth", "36%", "Proje\u00e7\u00e3o de FCL + valor terminal por perpetuidade"],
        ["DCF Exit Multiple", "24%", "Proje\u00e7\u00e3o de FCL + valor terminal por m\u00faltiplo EV/EBITDA"],
        ["M\u00faltiplos de Mercado", "40%", "EV/Receita e EV/EBITDA compar\u00e1veis (Damodaran)"],
    ]
    _build_wide_table(story, methods, col_widths=[130, 50, 270], accent_color=NAVY)
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("<b>Ajustes P\u00f3s-Triangula\u00e7\u00e3o</b>", styles["SubSection"]))
    for a in [
        "DLOM \u2014 Desconto por falta de liquidez (10-35%)",
        "Taxa de Sobreviv\u00eancia \u2014 Probabilidade de continuidade (SEBRAE/IBGE)",
        "Score Qualitativo \u2014 Ajuste \u00b115% baseado em avalia\u00e7\u00e3o qualitativa",
        "Desconto do Fundador \u2014 Risco de concentra\u00e7\u00e3o na pessoa do fundador",
    ]:
        story.append(Paragraph(f"  \u00b7  {a}", styles["BodySmall"]))

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("<b>WACC (Custo M\u00e9dio Ponderado de Capital)</b>", styles["SubSection"]))
    story.append(Paragraph(
        f"WACC calculado: <b>{format_pct(wacc_val)}</b>  |  "
        f"Beta unlevered ({analysis.sector}): <b>{result.get('beta_unlevered', 0):.2f}</b>  |  "
        f"Beta relevered: <b>{result.get('beta_levered', 0):.2f}</b>", styles["Body"]))
    story.append(Paragraph(
        "F\u00f3rmula: Ke \u00d7 (E/(D+E)) + Kd \u00d7 (1-t) \u00d7 (D/(D+E))  |  "
        "Ke: Rf + \u03b2 \u00d7 (Rm-Rf) + Pr\u00eamio PME", styles["BodySmall"]))
    story.append(PageBreak())

    # PROJECAO FCL (Prof+)
    if is_prof and projections:
        _section_header(story, "Proje\u00e7\u00e3o de Receita e FCL", styles)
        story.append(Paragraph(
            "Proje\u00e7\u00e3o dos fluxos de caixa livres ao longo do per\u00edodo expl\u00edcito, "
            "base para o c\u00e1lculo do valor presente no modelo DCF.", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        proj_header = ["Ano", "Receita", "Cresc.", "EBIT", "NOPAT", "FCL"]
        proj_rows = [proj_header]
        for p in projections:
            proj_rows.append([
                f"Ano {p['year']}", format_brl(p["revenue"]), format_pct(p["growth_rate"]),
                format_brl(p["ebit"]), format_brl(p["nopat"]), format_brl(p["fcf"]),
            ])
        _build_wide_table(story, proj_rows, col_widths=[55, 85, 50, 85, 85, 85])
        story.append(PageBreak())

    # P&L (Prof+)
    if is_prof and pnl:
        _section_header(story, "DRE Projetado (P&L)", styles)
        story.append(Paragraph(
            "Demonstra\u00e7\u00e3o de resultado projetada com base nas premissas de crescimento e margens.", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        display_pnl = pnl[:min(len(pnl), 6)]
        pnl_header = [""] + [f"Ano {p['year']}" for p in display_pnl]
        pnl_rows = [pnl_header]

        def _pnl_row(label, key, is_pct=False):
            row = [label]
            for p in display_pnl:
                row.append(format_pct(p[key]) if is_pct else format_brl(p[key]))
            return row

        pnl_rows.append(_pnl_row("Receita", "revenue"))
        pnl_rows.append(_pnl_row("(-) CMV", "cogs"))
        pnl_rows.append(_pnl_row("Lucro Bruto", "gross_profit"))
        pnl_rows.append(_pnl_row("Margem Bruta", "gross_margin", True))
        pnl_rows.append(_pnl_row("(-) Opex", "opex"))
        pnl_rows.append(_pnl_row("EBITDA", "ebitda"))
        pnl_rows.append(_pnl_row("Margem EBITDA", "ebitda_margin", True))
        pnl_rows.append(_pnl_row("(-) D&A", "depreciation"))
        pnl_rows.append(_pnl_row("EBIT", "ebit"))
        pnl_rows.append(_pnl_row("(-) Impostos", "taxes"))
        pnl_rows.append(_pnl_row("Lucro L\u00edquido", "net_income"))
        pnl_rows.append(_pnl_row("Margem L\u00edquida", "net_margin", True))

        n_cols = len(pnl_header)
        col_w = [80] + [int(370 / (n_cols - 1))] * (n_cols - 1)
        table = Table(pnl_rows, colWidths=col_w)
        table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("ALIGN", (0, 0), (0, -1), "LEFT"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_50]),
            ("LINEBELOW", (0, 0), (-1, 0), 2, NAVY),
            ("LINEBELOW", (0, 1), (-1, -2), 0.5, GRAY_200),
            ("BOX", (0, 0), (-1, -1), 0.5, GRAY_300),
            ("FONTNAME", (0, 6), (-1, 6), "Helvetica-Bold"),
            ("FONTNAME", (0, 11), (-1, 11), "Helvetica-Bold"),
            ("BACKGROUND", (0, 6), (-1, 6), EMERALD_PALE),
            ("BACKGROUND", (0, 11), (-1, 11), EMERALD_PALE),
        ]))
        story.append(table)
        story.append(PageBreak())

    # DCF GORDON GROWTH
    _section_header(story, "DCF \u2014 Gordon Growth Model", styles)
    story.append(Paragraph(
        "O modelo de Gordon calcula o valor terminal assumindo que os fluxos de caixa crescem "
        "a uma taxa constante (g) na perpetuidade: TV = FCL \u00d7 (1+g) / (WACC - g).", styles["Body"]))
    story.append(Spacer(1, 3 * mm))
    perp_g = tv_gordon.get("perpetuity_growth", 0.035)
    gordon_data = [
        ["Componente", "Valor"],
        ["\u00daltimo FCL Projetado", format_brl(projections[-1]["fcf"] if projections else 0)],
        ["Crescimento Perp\u00e9tuo (g)", format_pct(perp_g)],
        ["WACC", format_pct(wacc_val)],
        ["Valor Terminal (Gordon)", format_brl(tv_gordon.get("terminal_value", 0))],
        ["VP do Valor Terminal", format_brl(result.get("pv_terminal_value", 0))],
        ["VP dos FCLs", format_brl(result.get("pv_fcf_total", 0))],
        ["Enterprise Value (Gordon)", format_brl(result.get("enterprise_value_gordon", 0))],
        ["Equity Value (Gordon)", format_brl(result.get("equity_value_gordon", 0))],
    ]
    _build_premium_table(story, gordon_data)
    for w in tv_gordon.get("warnings", []):
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(f"Aten\u00e7\u00e3o: {w}", ParagraphStyle(
            "Warn", fontName="Helvetica-Bold", fontSize=8, textColor=AMBER, spaceAfter=3)))
    story.append(PageBreak())

    # EXIT MULTIPLE..SOBREVIVENCIA (Prof+)
    if is_prof:
        _section_header(story, "DCF \u2014 Exit Multiple", styles)
        story.append(Paragraph(
            "O m\u00e9todo Exit Multiple calcula o valor terminal aplicando um m\u00faltiplo EV/EBITDA "
            "sobre o EBITDA do \u00faltimo ano projetado \u2014 abordagem preferida em M&A.", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        exit_data = [
            ["Componente", "Valor"],
            ["EBITDA \u00daltimo Ano", format_brl(pnl[-1]["ebitda"] if pnl else 0)],
            ["M\u00faltiplo de Sa\u00edda (EV/EBITDA)", f"{tv_exit.get('exit_multiple', 0):.1f}x"],
            ["Valor Terminal (Exit)", format_brl(tv_exit.get("terminal_value", 0))],
            ["Enterprise Value (Exit)", format_brl(result.get("enterprise_value_exit", 0))],
            ["Equity Value (Exit)", format_brl(result.get("equity_value_exit_multiple", 0))],
        ]
        _build_premium_table(story, exit_data, accent_color=TEAL)
        story.append(PageBreak())

        # MULTIPLOS
        _section_header(story, "Valuation por M\u00faltiplos de Mercado", styles)
        story.append(Paragraph(
            f"M\u00faltiplos setoriais de <b>{analysis.sector.capitalize()}</b> extra\u00eddos de "
            f"Damodaran/NYU Stern, aplicados sobre a receita e EBITDA da empresa.", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        mult_used = multiples_val.get("multiples_used", {})
        mult_data = [
            ["M\u00e9todo", "M\u00faltiplo", "EV Estimado"],
            ["EV/Receita", f"{mult_used.get('ev_revenue', 0):.1f}x", format_brl(multiples_val.get("ev_by_revenue", 0))],
            ["EV/EBITDA", f"{mult_used.get('ev_ebitda', 0):.1f}x", format_brl(multiples_val.get("ev_by_ebitda", 0))],
            ["M\u00e9dia Ponderada", "\u2014", format_brl(multiples_val.get("ev_avg_multiples", 0))],
            ["Equity (M\u00faltiplos)", "\u2014", format_brl(multiples_val.get("equity_avg_multiples", 0))],
        ]
        _build_wide_table(story, mult_data, col_widths=[150, 100, 200], accent_color=TEAL)
        story.append(PageBreak())

        # TRIANGULACAO
        _section_header(story, "Triangula\u00e7\u00e3o e Composi\u00e7\u00e3o do Valor", styles)
        story.append(Paragraph(
            f"Pondera\u00e7\u00e3o: DCF <b>{params.get('dcf_weight', 0.6)*100:.0f}%</b> "
            f"(Gordon 60% / Exit 40%) + M\u00faltiplos <b>{(1-params.get('dcf_weight', 0.6))*100:.0f}%</b>.", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        waterfall = result.get("waterfall", [])
        if waterfall:
            wf_rows = [["Componente", "Valor"]]
            for item in waterfall:
                wf_rows.append([item["label"], format_brl(item["value"])])
            wf_table = Table(wf_rows, colWidths=[300, 150])
            wf_table.setStyle(TableStyle([
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, GRAY_50]),
                ("LINEBELOW", (0, 0), (-1, 0), 2, NAVY),
                ("LINEBELOW", (0, 1), (-1, -2), 0.5, GRAY_200),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("BACKGROUND", (0, -1), (-1, -1), EMERALD),
                ("TEXTCOLOR", (0, -1), (-1, -1), WHITE),
                ("FONTSIZE", (0, -1), (-1, -1), 10),
            ]))
            story.append(wf_table)
        story.append(PageBreak())

        # DLOM
        _section_header(story, "Desconto de Liquidez (DLOM)", styles)
        story.append(Paragraph(
            "O DLOM (Discount for Lack of Marketability) reflete a dificuldade de vender uma "
            "participa\u00e7\u00e3o em empresa de capital fechado comparado a a\u00e7\u00f5es listadas em bolsa.", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        dlom_data = [
            ["Componente", "Valor"],
            ["Desconto Base", format_pct(dlom.get("base_discount", 0.20))],
            ["Ajuste por Porte", f"{dlom.get('size_adjustment', 0)*100:+.0f}%"],
            ["Ajuste por Maturidade", f"{dlom.get('maturity_adjustment', 0)*100:+.0f}%"],
            ["Ajuste Setorial", f"{dlom.get('sector_adjustment', 0)*100:+.0f}%"],
            ["Liquidez do Setor", dlom.get("sector_liquidity", "medium").capitalize()],
            ["DLOM Final", format_pct(dlom.get("dlom_pct", 0))],
        ]
        _build_premium_table(story, dlom_data)
        story.append(Spacer(1, 8 * mm))

        # SOBREVIVENCIA
        _section_header(story, "Taxa de Sobreviv\u00eancia", styles)
        story.append(Paragraph(
            "A taxa de sobreviv\u00eancia \u00e9 baseada em dados do SEBRAE/IBGE e reflete "
            "a probabilidade da empresa continuar operando no horizonte projetado.", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        surv_data = [
            ["Componente", "Valor"],
            ["Taxa Base (setor/horizonte)", format_pct(survival.get("base_rate", 0))],
            ["Horizonte", survival.get("horizon", "5yr")],
            ["B\u00f4nus por Idade", f"+{survival.get('age_bonus', 0)*100:.0f}%"],
            ["Taxa Ajustada", format_pct(survival.get("survival_rate", 0))],
        ]
        _build_premium_table(story, surv_data)
        story.append(PageBreak())

    # AVALIACAO QUALITATIVA (Estrategico)
    if is_strat:
        _section_header(story, "Avalia\u00e7\u00e3o Qualitativa", styles)
        if qual.get("has_data"):
            story.append(Paragraph(
                f"Score Qualitativo: <b>{qual.get('score', 50):.0f}/100</b>  |  "
                f"Ajuste no valor: <b>{qual.get('adjustment', 0)*100:+.1f}%</b>", styles["Body"]))
            story.append(Spacer(1, 3 * mm))
            dims = qual.get("dimensions", {})
            dim_labels = {
                "governanca": "Governan\u00e7a", "mercado": "Mercado", "financeiro": "Financeiro",
                "clientes": "Clientes", "diferenciacao": "Diferencia\u00e7\u00e3o", "escalabilidade": "Escalabilidade",
            }
            if dims:
                dim_data = [["Dimens\u00e3o", "Score (1-5)"]]
                for k, v in dims.items():
                    dim_data.append([dim_labels.get(k, k.capitalize()), f"{v:.1f}"])
                _build_premium_table(story, dim_data)
            obs = qual.get("observations", {})
            if obs:
                story.append(Spacer(1, 5 * mm))
                story.append(Paragraph("<b>Observa\u00e7\u00f5es do Avaliador</b>", styles["SubSection"]))
                obs_labels = {
                    "gov_profissional": "Gest\u00e3o profissionalizada",
                    "gov_compliance": "Controles e compliance",
                    "mercado_lider": "Posi\u00e7\u00e3o de mercado",
                    "mercado_tendencia": "Tend\u00eancia do setor",
                    "financeiro_crescimento": "Crescimento do faturamento",
                    "financeiro_margens": "Margens vs setor",
                    "clientes_diversificacao": "Diversifica\u00e7\u00e3o de receita",
                    "clientes_recorrencia": "Receita recorrente",
                    "diferenciacao_moat": "Diferencial competitivo",
                    "escala_operacional": "Escalabilidade",
                }
                for key, text in obs.items():
                    if text and text.strip():
                        label = obs_labels.get(key, key)
                        story.append(Paragraph(f"<b>{label}:</b> {text}", styles["BodySmall"]))
        else:
            story.append(Paragraph(
                "Nenhuma avalia\u00e7\u00e3o qualitativa foi preenchida. "
                "O score foi mantido neutro (50/100, sem ajuste).", styles["Body"]))
        story.append(PageBreak())

    # SENSIBILIDADE + BENCHMARK (Prof+)
    if is_prof:
        _section_header(story, "An\u00e1lise de Sensibilidade", styles)
        story.append(Paragraph(
            "A tabela mostra como o Equity Value varia conforme mudan\u00e7as na "
            "taxa de desconto (WACC) e na taxa de crescimento.", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        sens = result.get("sensitivity_table", {})
        wacc_vals = sens.get("wacc_values", [])
        growth_vals = sens.get("growth_values", [])
        matrix = sens.get("equity_matrix", [])
        if wacc_vals and growth_vals and matrix:
            header = ["WACC \\ Cresc."] + [f"{g:.1f}%" for g in growth_vals]
            sens_rows = [header]
            for i, w in enumerate(wacc_vals):
                row_data = [f"{w:.1f}%"]
                for val in matrix[i]:
                    row_data.append(format_brl(val))
                sens_rows.append(row_data)
            n_c = len(header)
            s_cw = [75] + [int(375 / (n_c - 1))] * (n_c - 1)
            sens_table = Table(sens_rows, colWidths=s_cw)
            sens_table.setStyle(TableStyle([
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("BACKGROUND", (0, 1), (0, -1), GRAY_100),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("BOX", (0, 0), (-1, -1), 0.5, GRAY_300),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, GRAY_200),
            ]))
            mid = len(wacc_vals) // 2 + 1
            mid_c = len(growth_vals) // 2 + 1
            sens_table.setStyle(TableStyle([
                ("BACKGROUND", (mid_c, mid), (mid_c, mid), EMERALD_PALE),
                ("FONTNAME", (mid_c, mid), (mid_c, mid), "Helvetica-Bold"),
            ]))
            story.append(sens_table)
        story.append(PageBreak())

        # BENCHMARK
        _section_header(story, "Benchmark Setorial", styles)
        sector_multiples = result.get("sector_multiples", {})
        ev_rev = result.get("enterprise_value", 0) / max(params.get("revenue", 1), 1)
        ev_rev_sector = sector_multiples.get("ev_revenue", 2.0)
        comp = "Acima" if ev_rev > ev_rev_sector * 1.1 else "Abaixo" if ev_rev < ev_rev_sector * 0.9 else "Na m\u00e9dia"
        bench_data = [
            ["Indicador", "Empresa", "Setor", "Posi\u00e7\u00e3o"],
            ["EV/Receita", f"{ev_rev:.1f}x", f"{ev_rev_sector:.1f}x", comp],
            ["Beta Unlevered", f"{result.get('beta_levered', 0):.2f}", f"{result.get('beta_unlevered', 0):.2f}", "\u2014"],
            ["Percentil", f"{result.get('percentile', 0):.0f}%", "50%",
             f"{'Acima' if result.get('percentile', 50) > 50 else 'Abaixo'}"],
        ]
        _build_wide_table(story, bench_data, col_widths=[110, 100, 100, 140], accent_color=TEAL)
        story.append(Spacer(1, 5 * mm))
        story.append(PageBreak())

    # RISCO + MATURIDADE
    _section_header(story, "Risco e Maturidade", styles)
    risk_score = result.get("risk_score", 0)
    maturity_idx = result.get("maturity_index", 0)
    risk_label = "Baixo" if risk_score < 30 else "Moderado" if risk_score < 60 else "Alto" if risk_score < 80 else "Muito Alto"
    mat_label = "Inicial" if maturity_idx < 30 else "Em Desenvolvimento" if maturity_idx < 50 else "Consolidada" if maturity_idx < 75 else "Madura"
    rm_data = [
        ["Indicador", "Score", "Classifica\u00e7\u00e3o"],
        ["Score de Risco", f"{risk_score:.1f}/100", risk_label],
        ["Maturidade", f"{maturity_idx:.1f}/100", mat_label],
        ["Percentil de Mercado", f"{result.get('percentile', 0):.1f}%", "\u2014"],
    ]
    _build_wide_table(story, rm_data, col_widths=[160, 120, 170])
    story.append(PageBreak())

    # RODADA (Estrategico)
    if is_strat:
        _section_header(story, "Simula\u00e7\u00e3o de Rodada de Investimento", styles)
        story.append(Paragraph(
            "Simula\u00e7\u00e3o baseada no equity value estimado como pre-money valuation, "
            "projetando cen\u00e1rio de capta\u00e7\u00e3o de investimento.", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        round_data = [
            ["Par\u00e2metro", "Valor"],
            ["Pre-Money Valuation", format_brl(inv_round.get("pre_money_valuation", 0))],
            ["Investimento (simula\u00e7\u00e3o)", format_brl(inv_round.get("investment_amount", 0))],
            ["Post-Money Valuation", format_brl(inv_round.get("post_money_valuation", 0))],
            ["Dilui\u00e7\u00e3o", f"{inv_round.get('dilution_pct', 0):.1f}%"],
            ["Equity Fundador", f"{inv_round.get('founder_equity_pct', 0):.1f}%"],
            ["Equity Investidor", f"{inv_round.get('investor_equity_pct', 0):.1f}%"],
            ["Pre\u00e7o por 1%", format_brl(inv_round.get("price_per_1pct", 0))],
        ]
        _build_premium_table(story, round_data)
        story.append(PageBreak())

    # ANALISE IA (Estrategico)
    if is_strat and analysis.ai_analysis:
        _section_header(story, "An\u00e1lise Estrat\u00e9gica (IA)", styles)
        story.append(Paragraph(
            "An\u00e1lise gerada por intelig\u00eancia artificial com base nos dados financeiros "
            "e resultados do valuation.", ParagraphStyle(
                "AINote", fontName="Helvetica-Oblique", fontSize=8.5,
                textColor=GRAY_500, spaceAfter=10, leading=12)))
        for paragraph in analysis.ai_analysis.split("\n\n"):
            p = paragraph.strip()
            if p:
                if p.startswith("## "):
                    story.append(Paragraph(p[3:], styles["SubSection"]))
                elif p.startswith("# "):
                    story.append(Paragraph(p[2:], styles["SubSection"]))
                elif p.startswith("**") and p.endswith("**"):
                    story.append(Paragraph(p.strip("*"), styles["SubSection"]))
                else:
                    clean = p.replace("**", "<b>").replace("\n", "<br/>")
                    bold_count = clean.count("<b>")
                    close_count = clean.count("</b>")
                    if bold_count > close_count:
                        clean += "</b>" * (bold_count - close_count)
                    story.append(Paragraph(clean, styles["Body"]))
                story.append(Spacer(1, 2 * mm))
        story.append(PageBreak())

    # GLOSSARIO
    _section_header(story, "Gloss\u00e1rio", styles)
    glossary = [
        ("DCF", "Discounted Cash Flow \u2014 m\u00e9todo de avalia\u00e7\u00e3o que desconta fluxos de caixa futuros ao valor presente."),
        ("WACC", "Weighted Average Cost of Capital \u2014 custo m\u00e9dio ponderado de capital, taxa de desconto utilizada no DCF."),
        ("FCL", "Fluxo de Caixa Livre \u2014 caixa gerado pelas opera\u00e7\u00f5es ap\u00f3s investimentos e varia\u00e7\u00f5es de capital de giro."),
        ("Valor Terminal", "Valor presente dos fluxos de caixa al\u00e9m do per\u00edodo de proje\u00e7\u00e3o expl\u00edcita."),
        ("Gordon Growth", "Modelo de perpetuidade com crescimento constante para calcular o valor terminal."),
        ("Exit Multiple", "M\u00e9todo que aplica um m\u00faltiplo (EV/EBITDA) sobre o EBITDA do \u00faltimo ano projetado."),
        ("EBITDA", "Lucro operacional antes de juros, impostos, deprecia\u00e7\u00e3o e amortiza\u00e7\u00e3o."),
        ("EV/Receita", "Enterprise Value dividido pela receita \u2014 m\u00faltiplo de avalia\u00e7\u00e3o por faturamento."),
        ("EV/EBITDA", "Enterprise Value dividido pelo EBITDA \u2014 m\u00faltiplo de avalia\u00e7\u00e3o operacional."),
        ("DLOM", "Discount for Lack of Marketability \u2014 desconto por falta de liquidez de empresa fechada."),
        ("Beta (B)", "Medida de risco sistem\u00e1tico de um setor em rela\u00e7\u00e3o ao mercado."),
        ("NOPAT", "Net Operating Profit After Tax \u2014 lucro operacional l\u00edquido de impostos."),
        ("Pre-Money", "Valor estimado da empresa antes de receber um investimento."),
        ("Post-Money", "Valor da empresa ap\u00f3s o investimento (pre-money + investimento)."),
        ("Dilui\u00e7\u00e3o", "Redu\u00e7\u00e3o percentual na participa\u00e7\u00e3o dos s\u00f3cios originais ap\u00f3s investimento."),
    ]
    for term, definition in glossary:
        story.append(Paragraph(term, styles["GlossaryTerm"]))
        story.append(Paragraph(definition, styles["GlossaryDef"]))
    story.append(PageBreak())

    # DISCLAIMER
    _section_header(story, "Disclaimer Legal", styles)
    disclaimer_paras = [
        "Este relat\u00f3rio foi gerado pela plataforma Quanto Vale com finalidade exclusivamente "
        "informativa e educacional. Os valores apresentados s\u00e3o estimativas baseadas nas metodologias de "
        "Fluxo de Caixa Descontado (DCF Gordon Growth e Exit Multiple), M\u00faltiplos de Mercado "
        "e ajustes de DLOM e Sobreviv\u00eancia.",
        "Os dados setoriais (betas, m\u00faltiplos) s\u00e3o derivados de Aswath Damodaran (NYU Stern) e "
        "estat\u00edsticas de sobreviv\u00eancia do SEBRAE/IBGE. A taxa livre de risco utiliza a Selic "
        "do Banco Central do Brasil.",
        "Este documento N\u00c3O constitui recomenda\u00e7\u00e3o de investimento, oferta de compra ou venda de "
        "participa\u00e7\u00e3o societ\u00e1ria, nem substitui uma avalia\u00e7\u00e3o formal realizada por profissional habilitado.",
        "Os resultados dependem diretamente da qualidade e veracidade dos dados inseridos. Proje\u00e7\u00f5es "
        "financeiras s\u00e3o, por natureza, incertas e podem divergir significativamente dos resultados reais.",
        "A Quanto Vale n\u00e3o se responsabiliza por decis\u00f5es tomadas com base neste relat\u00f3rio. "
        "Recomendamos consultar um assessor financeiro qualificado antes de tomar decis\u00f5es relevantes.",
        "Todos os direitos reservados. Quanto Vale \u00a9 2026.",
    ]
    for para in disclaimer_paras:
        story.append(Paragraph(para, styles["Disclaimer"]))
        story.append(Spacer(1, 2 * mm))

    story.append(Spacer(1, 12 * mm))
    story.append(HRFlowable(width="30%", thickness=0.5, color=EMERALD, spaceAfter=8))
    story.append(Paragraph(f"Relat\u00f3rio #{report_id}  \u00b7  {timestamp}", styles["Footer"]))
    story.append(Paragraph("quantovale.online", styles["Footer"]))

    doc.build(story, onFirstPage=_cover_page, onLaterPages=_premium_footer)
    return filepath
