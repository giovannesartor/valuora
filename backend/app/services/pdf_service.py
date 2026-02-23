"""
Quanto Vale — PDF Report Generator v3
Relatório premium ~20 páginas, tema esmeralda, watermark QuantoVale.
"""
import os
import uuid
from datetime import datetime
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, HRFlowable, KeepTogether,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from app.core.config import settings

# ─── Emerald Theme Colors ────────────────────────────────
EMERALD = HexColor("#059669")
EMERALD_DARK = HexColor("#047857")
EMERALD_LIGHT = HexColor("#d1fae5")
TEAL = HexColor("#0d9488")
NAVY = HexColor("#0f172a")
GRAY = HexColor("#475569")
GRAY_LIGHT = HexColor("#f1f5f9")
GREEN = HexColor("#16a34a")
GREEN_LIGHT = HexColor("#f0fdf4")
RED = HexColor("#dc2626")
RED_LIGHT = HexColor("#fef2f2")
WHITE = HexColor("#ffffff")
BLACK = HexColor("#000000")
AMBER = HexColor("#d97706")


def get_styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("CoverTitle", fontName="Helvetica-Bold", fontSize=36, textColor=WHITE, alignment=TA_CENTER, spaceAfter=10))
    styles.add(ParagraphStyle("CoverSubtitle", fontName="Helvetica", fontSize=14, textColor=HexColor("#a7f3d0"), alignment=TA_CENTER, spaceAfter=6))
    styles.add(ParagraphStyle("SectionTitle", fontName="Helvetica-Bold", fontSize=18, textColor=NAVY, spaceBefore=20, spaceAfter=12))
    styles.add(ParagraphStyle("SubSection", fontName="Helvetica-Bold", fontSize=13, textColor=EMERALD, spaceBefore=14, spaceAfter=8))
    styles.add(ParagraphStyle("BodyText2", fontName="Helvetica", fontSize=10, textColor=GRAY, alignment=TA_JUSTIFY, leading=16, spaceAfter=8))
    styles.add(ParagraphStyle("ValueBig", fontName="Helvetica-Bold", fontSize=28, textColor=NAVY, alignment=TA_CENTER, spaceBefore=10, spaceAfter=4))
    styles.add(ParagraphStyle("ValueLabel", fontName="Helvetica", fontSize=10, textColor=GRAY, alignment=TA_CENTER, spaceAfter=16))
    styles.add(ParagraphStyle("Disclaimer", fontName="Helvetica", fontSize=8, textColor=HexColor("#94a3b8"), alignment=TA_JUSTIFY, leading=12))
    styles.add(ParagraphStyle("Footer", fontName="Helvetica", fontSize=8, textColor=HexColor("#94a3b8"), alignment=TA_CENTER))
    styles.add(ParagraphStyle("TOCEntry", fontName="Helvetica", fontSize=11, textColor=NAVY, spaceAfter=6, leftIndent=10))
    styles.add(ParagraphStyle("GlossaryTerm", fontName="Helvetica-Bold", fontSize=10, textColor=NAVY, spaceBefore=8, spaceAfter=2))
    styles.add(ParagraphStyle("GlossaryDef", fontName="Helvetica", fontSize=9, textColor=GRAY, leftIndent=10, spaceAfter=6, leading=14))
    return styles


def format_brl(value: float) -> str:
    if abs(value) >= 1_000_000:
        return f"R$ {value/1_000_000:,.2f}M"
    elif abs(value) >= 1_000:
        return f"R$ {value/1_000:,.1f}K"
    return f"R$ {value:,.2f}"


def format_pct(value: float) -> str:
    return f"{value*100:.1f}%"


def _watermark_footer(canvas, doc):
    """Draws footer watermark on every page."""
    canvas.saveState()
    w, h = A4
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(HexColor("#94a3b8"))
    canvas.drawCentredString(w / 2, 18 * mm, "Valuation Realizado por QuantoVale  •  quantovale.online")
    canvas.setFont("Helvetica", 7)
    canvas.drawRightString(w - 2.5 * cm, 18 * mm, f"Página {doc.page}")
    # Emerald accent line
    canvas.setStrokeColor(EMERALD)
    canvas.setLineWidth(1.5)
    canvas.line(2.5 * cm, 22 * mm, w - 2.5 * cm, 22 * mm)
    canvas.restoreState()


def generate_report_pdf(analysis) -> str:
    """Gera PDF premium para análise de valuation. Conteúdo varia conforme plano."""
    from app.models.models import PlanType
    plan_type = analysis.plan
    is_prof = plan_type in (PlanType.PROFISSIONAL, PlanType.ESTRATEGICO) if plan_type else False
    is_strat = plan_type == PlanType.ESTRATEGICO if plan_type else False
    _plan_labels = {PlanType.ESSENCIAL: "Essencial", PlanType.PROFISSIONAL: "Profissional", PlanType.ESTRATEGICO: "Estratégico"}
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
        topMargin=2 * cm, bottomMargin=3 * cm,
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

    # ═══════════════════════════════════════════════════════
    # 1. CAPA
    # ═══════════════════════════════════════════════════════
    story.append(Spacer(1, 60 * mm))
    story.append(Paragraph("QUANTO VALE", styles["CoverTitle"]))
    story.append(Paragraph("Relatório de Valuation Empresarial", styles["CoverSubtitle"]))
    story.append(Spacer(1, 25 * mm))
    story.append(HRFlowable(width="60%", thickness=1, color=HexColor("#a7f3d0"), spaceAfter=20, spaceBefore=20))
    story.append(Paragraph(f"<b>{analysis.company_name}</b>", ParagraphStyle(
        "CompanyName", fontName="Helvetica-Bold", fontSize=22, textColor=NAVY, alignment=TA_CENTER, spaceAfter=8)))
    story.append(Paragraph(f"Setor: {analysis.sector.capitalize()}", styles["CoverSubtitle"]))
    story.append(Spacer(1, 20 * mm))

    meta_data = [
        ["ID do Relatório", report_id],
        ["Data", timestamp],
        ["Metodologia", "DCF (Gordon + Exit Multiple) + Múltiplos"],
        ["Fonte de Dados", "Damodaran/NYU + BCB/Selic + IBGE"],
    ]
    meta_table = Table(meta_data, colWidths=[130, 220])
    meta_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9), ("TEXTCOLOR", (0, 0), (-1, -1), GRAY),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(f"Relatório {_plan_label}", styles["CoverSubtitle"]))
    story.append(Spacer(1, 15 * mm))
    story.append(Paragraph("quantovale.online", styles["Footer"]))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════
    # 2. SUMÁRIO
    # ═══════════════════════════════════════════════════════
    story.append(Paragraph("Sumário", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))
    toc_items = ["Resumo Executivo"]
    if is_prof:
        toc_items.append("Premissas e Dados de Entrada")
    toc_items.append("Metodologia")
    if is_prof:
        toc_items += ["Projeção de Receita e FCL", "DRE Projetado (P&L)"]
    toc_items.append("DCF — Gordon Growth")
    if is_prof:
        toc_items += ["DCF — Exit Multiple", "Valuation por Múltiplos", "Triangulação e Composição do Valor"]
        toc_items += ["Desconto de Liquidez (DLOM)", "Taxa de Sobrevivência"]
    if is_strat:
        toc_items.append("Avaliação Qualitativa")
    if is_prof:
        toc_items += ["Análise de Sensibilidade", "Benchmark Setorial"]
    toc_items.append("Risco e Maturidade")
    if is_strat:
        toc_items.append("Simulação de Rodada")
        if analysis.ai_analysis:
            toc_items.append("Análise Estratégica IA")
    toc_items += ["Glossário", "Disclaimer"]
    for i, item in enumerate(toc_items, 1):
        story.append(Paragraph(f"{i}. {item}", styles["TOCEntry"]))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════════
    # RESUMO EXECUTIVO
    # ═══════════════════════════════════════════════════════
    story.append(Paragraph("Resumo Executivo", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))

    equity = result.get("equity_value", 0)
    val_range = result.get("valuation_range", {})
    story.append(Paragraph(format_brl(equity), styles["ValueBig"]))
    story.append(Paragraph("Valor estimado do equity (após todos os ajustes)", styles["ValueLabel"]))

    range_data = [
        ["Cenário Conservador", "Cenário Base", "Cenário Otimista"],
        [format_brl(val_range.get("low", 0)), format_brl(val_range.get("mid", 0)), format_brl(val_range.get("high", 0))],
    ]
    range_table = Table(range_data, colWidths=[150, 150, 150])
    range_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9), ("FONTSIZE", (0, 1), (-1, 1), 12),
        ("TEXTCOLOR", (0, 0), (-1, 0), GRAY),
        ("TEXTCOLOR", (0, 1), (0, 1), RED), ("TEXTCOLOR", (1, 1), (1, 1), NAVY), ("TEXTCOLOR", (2, 1), (2, 1), GREEN),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("BOTTOMPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, -1), EMERALD_LIGHT), ("BOX", (0, 0), (-1, -1), 1, EMERALD),
    ]))
    story.append(range_table)
    story.append(Spacer(1, 8 * mm))

    # Key metrics summary
    key_metrics = [
        ["Métrica", "Valor"],
        ["Receita Anual", format_brl(params.get("revenue", 0))],
        ["Margem Líquida", format_pct(params.get("net_margin", 0))],
        ["Crescimento", format_pct(params.get("growth_rate", 0))],
        ["WACC", format_pct(result.get("wacc", 0))],
        ["Enterprise Value", format_brl(result.get("enterprise_value", 0))],
        ["Score de Risco", f"{result.get('risk_score', 0):.1f}/100"],
        ["Maturidade", f"{result.get('maturity_index', 0):.1f}/100"],
        ["DLOM", format_pct(dlom.get("dlom_pct", 0))],
        ["Sobrevivência", format_pct(survival.get("survival_rate", 0))],
    ]
    _build_metrics_table(story, key_metrics)
    story.append(PageBreak())

    # ═══════ PREMISSAS (Profissional+) ═══════
    __story, story = story, story if is_prof else []
    story.append(Paragraph("Premissas e Dados de Entrada", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))
    premissas = [
        ["Parâmetro", "Valor"],
        ["Receita (R$)", format_brl(params.get("revenue", 0))],
        ["Margem Líquida", format_pct(params.get("net_margin", 0))],
        ["Margem EBIT (calculada)", format_pct(params.get("ebit_margin", 0))],
        ["Crescimento Informado", format_pct(params.get("growth_rate", 0))],
        ["Dívida (R$)", format_brl(params.get("debt", 0))],
        ["Caixa (R$)", format_brl(params.get("cash", 0))],
        ["Dependência do Fundador", format_pct(params.get("founder_dependency", 0))],
        ["Anos Projetados", str(params.get("projection_years", 5))],
        ["Anos de Operação", str(params.get("years_in_business", 3))],
        ["% Receita Recorrente", format_pct(params.get("recurring_revenue_pct", 0))],
        ["Funcionários", str(params.get("num_employees", 0))],
        ["Taxa Selic (Rf)", format_pct(params.get("selic_rate", 0))],
        ["Peso DCF vs Múltiplos", f"{params.get('dcf_weight', 0.6)*100:.0f}% / {(1-params.get('dcf_weight', 0.6))*100:.0f}%"],
        ["Fonte de Dados", params.get("data_source", "Damodaran/NYU")],
    ]
    _build_metrics_table(story, premissas)
    story.append(PageBreak())
    story = __story

    # ═══════ METODOLOGIA ═══════
    story.append(Paragraph("Metodologia", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))

    story.append(Paragraph("Abordagem Multi-Método", styles["SubSection"]))
    story.append(Paragraph(
        "Este relatório utiliza uma <b>abordagem de triangulação</b> combinando três metodologias "
        "reconhecidas internacionalmente para estimar o valor justo da empresa:", styles["BodyText2"]))
    methods = [
        "<b>DCF Gordon Growth Model</b> — Projeção de FCL + valor terminal por perpetuidade (Gordon Growth). Peso: 36%",
        "<b>DCF Exit Multiple</b> — Projeção de FCL + valor terminal por múltiplo de saída (EV/EBITDA). Peso: 24%",
        "<b>Múltiplos de Mercado</b> — EV/Receita e EV/EBITDA comparáveis do setor (Damodaran). Peso: 40%",
    ]
    for m in methods:
        story.append(Paragraph(f"• {m}", ParagraphStyle("Method", fontName="Helvetica", fontSize=10, textColor=NAVY, leftIndent=15, spaceAfter=6, leading=15)))

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("Ajustes Pós-Triangulação", styles["SubSection"]))
    adjustments = [
        "<b>DLOM</b> — Desconto por falta de liquidez (10-35%)",
        "<b>Taxa de Sobrevivência</b> — Probabilidade de continuidade (SEBRAE/IBGE)",
        "<b>Score Qualitativo</b> — Ajuste ±15% baseado em 10 perguntas qualitativas",
        "<b>Desconto do Fundador</b> — Risco de concentração na pessoa do fundador",
    ]
    for a in adjustments:
        story.append(Paragraph(f"• {a}", ParagraphStyle("Adj", fontName="Helvetica", fontSize=10, textColor=GRAY, leftIndent=15, spaceAfter=4, leading=15)))

    story.append(Spacer(1, 6 * mm))
    wacc_val = result.get("wacc", 0)
    story.append(Paragraph("WACC (Custo Médio Ponderado de Capital)", styles["SubSection"]))
    story.append(Paragraph(
        f"<b>WACC calculado:</b> {format_pct(wacc_val)}<br/>"
        f"<b>Fórmula:</b> Ke × (E/(D+E)) + Kd × (1-t) × (D/(D+E))<br/>"
        f"<b>Ke:</b> Rf + β × (Rm-Rf) + Prêmio PME<br/>"
        f"<b>β unlevered ({analysis.sector}):</b> {result.get('beta_unlevered', 0):.2f} → "
        f"<b>β relevered:</b> {result.get('beta_levered', 0):.2f}", styles["BodyText2"]))
    story.append(PageBreak())

    # ═══════ PROJEÇÃO FCL + P&L (Profissional+) ═══════
    __story, story = story, story if is_prof else []
    story.append(Paragraph("Projeção de Receita e FCL", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))

    projections = result.get("fcf_projections", [])
    if projections:
        proj_header = ["Ano", "Receita", "Cresc.", "EBIT", "NOPAT", "FCL"]
        proj_rows = [proj_header]
        for p in projections:
            proj_rows.append([
                f"Ano {p['year']}", format_brl(p["revenue"]), format_pct(p["growth_rate"]),
                format_brl(p["ebit"]), format_brl(p["nopat"]), format_brl(p["fcf"]),
            ])
        proj_table = Table(proj_rows, colWidths=[55, 85, 55, 85, 85, 85])
        proj_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE), ("BACKGROUND", (0, 0), (-1, 0), EMERALD_DARK),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"), ("ALIGN", (0, 0), (0, -1), "LEFT"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, EMERALD_LIGHT]),
            ("BOX", (0, 0), (-1, -1), 1, EMERALD), ("LINEBELOW", (0, 0), (-1, 0), 2, EMERALD),
        ]))
        story.append(proj_table)
    story.append(PageBreak())

    # ═══════ P&L PROJETADO ═══════
    story.append(Paragraph("DRE Projetado (P&L)", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))

    pnl = result.get("pnl_projections", [])
    if pnl:
        pnl_header = ["", "Ano 1", "Ano 2", "Ano 3", "Ano 4", "Ano 5"]
        if len(pnl) > 5:
            pnl_header = [""] + [f"Ano {p['year']}" for p in pnl[:min(len(pnl), 6)]]
        display_pnl = pnl[:min(len(pnl), 6)]
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
        pnl_rows.append(_pnl_row("Lucro Líquido", "net_income"))
        pnl_rows.append(_pnl_row("Margem Líquida", "net_margin", True))

        n_cols = len(pnl_header)
        col_w = [80] + [int(370 / (n_cols - 1))] * (n_cols - 1)
        pnl_table = Table(pnl_rows, colWidths=col_w)
        pnl_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8), ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("BACKGROUND", (0, 0), (-1, 0), EMERALD_DARK),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"), ("ALIGN", (0, 0), (0, -1), "LEFT"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, EMERALD_LIGHT]),
            ("BOX", (0, 0), (-1, -1), 1, EMERALD),
        ]))
        story.append(pnl_table)
    story.append(PageBreak())
    story = __story

    # ═══════ DCF GORDON GROWTH ═══════
    story.append(Paragraph("DCF — Gordon Growth Model", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))
    story.append(Paragraph(
        "O modelo de Gordon calcula o valor terminal assumindo que os fluxos de caixa crescem "
        "a uma taxa constante <b>(g)</b> na perpetuidade. TV = FCL × (1+g) / (WACC - g).", styles["BodyText2"]))

    perp_g = tv_gordon.get("perpetuity_growth", 0.035)
    gordon_data = [
        ["Parâmetro", "Valor"],
        ["Último FCL Projetado", format_brl(projections[-1]["fcf"] if projections else 0)],
        ["Taxa de Crescimento Perpétuo (g)", format_pct(perp_g)],
        ["WACC", format_pct(wacc_val)],
        ["Valor Terminal (Gordon)", format_brl(tv_gordon.get("terminal_value", 0))],
        ["VP do Valor Terminal", format_brl(result.get("pv_terminal_value", 0))],
        ["VP dos FCLs", format_brl(result.get("pv_fcf_total", 0))],
        ["Enterprise Value (Gordon)", format_brl(result.get("enterprise_value_gordon", 0))],
        ["Equity Value (Gordon)", format_brl(result.get("equity_value_gordon", 0))],
    ]
    _build_metrics_table(story, gordon_data)

    for w in tv_gordon.get("warnings", []):
        story.append(Paragraph(f"⚠ {w}", ParagraphStyle("Warn", fontName="Helvetica-Bold", fontSize=9, textColor=AMBER, spaceAfter=4)))
    story.append(PageBreak())

    # ═══════ DCF EXIT ~ SOBREVIVÊNCIA (Profissional+) ═══════
    __story, story = story, story if is_prof else []
    story.append(Paragraph("DCF — Exit Multiple", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))
    story.append(Paragraph(
        "O método Exit Multiple calcula o valor terminal aplicando um múltiplo EV/EBITDA "
        "sobre o EBITDA do último ano projetado. É a abordagem preferida em M&A.", styles["BodyText2"]))

    exit_data = [
        ["Parâmetro", "Valor"],
        ["EBITDA Último Ano", format_brl(pnl[-1]["ebitda"] if pnl else 0)],
        ["Múltiplo de Saída (EV/EBITDA)", f"{tv_exit.get('exit_multiple', 0):.1f}x"],
        ["Valor Terminal (Exit)", format_brl(tv_exit.get("terminal_value", 0))],
        ["Enterprise Value (Exit)", format_brl(result.get("enterprise_value_exit", 0))],
        ["Equity Value (Exit)", format_brl(result.get("equity_value_exit_multiple", 0))],
    ]
    _build_metrics_table(story, exit_data)
    story.append(PageBreak())

    # ═══════ MÚLTIPLOS ═══════
    story.append(Paragraph("Valuation por Múltiplos de Mercado", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))
    story.append(Paragraph(
        f"Múltiplos setoriais de <b>{analysis.sector.capitalize()}</b> extraídos de Damodaran/NYU Stern.", styles["BodyText2"]))

    mult_used = multiples_val.get("multiples_used", {})
    mult_data = [
        ["Método", "Múltiplo", "EV Estimado"],
        ["EV/Receita", f"{mult_used.get('ev_revenue', 0):.1f}x", format_brl(multiples_val.get("ev_by_revenue", 0))],
        ["EV/EBITDA", f"{mult_used.get('ev_ebitda', 0):.1f}x", format_brl(multiples_val.get("ev_by_ebitda", 0))],
        ["Média", "—", format_brl(multiples_val.get("ev_avg_multiples", 0))],
        ["Equity (Múltiplos)", "—", format_brl(multiples_val.get("equity_avg_multiples", 0))],
    ]
    mult_table = Table(mult_data, colWidths=[150, 100, 200])
    mult_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE), ("BACKGROUND", (0, 0), (-1, 0), TEAL),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, EMERALD_LIGHT]),
        ("BOX", (0, 0), (-1, -1), 1, TEAL),
    ]))
    story.append(mult_table)
    story.append(PageBreak())

    # ═══════ TRIANGULAÇÃO (WATERFALL) ═══════
    story.append(Paragraph("Triangulação e Composição do Valor", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))

    story.append(Paragraph(
        f"Peso: <b>DCF {params.get('dcf_weight', 0.6)*100:.0f}%</b> (Gordon 60% / Exit 40%) + "
        f"<b>Múltiplos {(1-params.get('dcf_weight', 0.6))*100:.0f}%</b>", styles["BodyText2"]))

    waterfall = result.get("waterfall", [])
    if waterfall:
        wf_header = ["Componente", "Valor"]
        wf_rows = [wf_header]
        for item in waterfall:
            wf_rows.append([item["label"], format_brl(item["value"])])
        wf_table = Table(wf_rows, colWidths=[300, 150])
        wf_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE), ("BACKGROUND", (0, 0), (-1, 0), EMERALD_DARK),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 7), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, EMERALD_LIGHT]),
            ("BOX", (0, 0), (-1, -1), 1, EMERALD),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"), ("BACKGROUND", (0, -1), (-1, -1), EMERALD),
            ("TEXTCOLOR", (0, -1), (-1, -1), WHITE),
        ]))
        story.append(wf_table)
    story.append(PageBreak())

    # ═══════ DLOM ═══════
    story.append(Paragraph("Desconto de Liquidez (DLOM)", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))
    story.append(Paragraph(
        "O <b>DLOM (Discount for Lack of Marketability)</b> reflete a dificuldade de vender uma "
        "participação em empresa de capital fechado comparado a ações listadas.", styles["BodyText2"]))

    dlom_data = [
        ["Componente", "Valor"],
        ["Desconto Base", format_pct(dlom.get("base_discount", 0.20))],
        ["Ajuste por Porte", f"{dlom.get('size_adjustment', 0)*100:+.0f}%"],
        ["Ajuste por Maturidade", f"{dlom.get('maturity_adjustment', 0)*100:+.0f}%"],
        ["Ajuste Setorial", f"{dlom.get('sector_adjustment', 0)*100:+.0f}%"],
        ["Liquidez do Setor", dlom.get("sector_liquidity", "medium").capitalize()],
        ["DLOM Final", format_pct(dlom.get("dlom_pct", 0))],
    ]
    _build_metrics_table(story, dlom_data)
    story.append(Spacer(1, 8 * mm))

    # ═══════ SOBREVIVÊNCIA ═══════
    story.append(Paragraph("Taxa de Sobrevivência", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))
    story.append(Paragraph(
        "A taxa de sobrevivência empresarial é baseada em dados do <b>SEBRAE/IBGE</b> e reflete "
        "a probabilidade de a empresa continuar operando ao longo do horizonte de projeção.", styles["BodyText2"]))

    surv_data = [
        ["Componente", "Valor"],
        ["Taxa Base (setor/horizonte)", format_pct(survival.get("base_rate", 0))],
        ["Horizonte", survival.get("horizon", "5yr")],
        ["Bônus por Idade", f"+{survival.get('age_bonus', 0)*100:.0f}%"],
        ["Taxa Ajustada", format_pct(survival.get("survival_rate", 0))],
    ]
    _build_metrics_table(story, surv_data)
    story.append(PageBreak())
    story = __story

    # ═══════ AVALIAÇÃO QUALITATIVA (Estratégico) ═══════
    __story, story = story, story if is_strat else []
    story.append(Paragraph("Avaliação Qualitativa", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))

    if qual.get("has_data"):
        story.append(Paragraph(f"Score Qualitativo: <b>{qual.get('score', 50):.0f}/100</b>", styles["SubSection"]))
        story.append(Paragraph(f"Ajuste no valor: <b>{qual.get('adjustment', 0)*100:+.1f}%</b>", styles["BodyText2"]))

        dims = qual.get("dimensions", {})
        dim_labels = {"equipe": "Equipe", "mercado": "Mercado", "produto": "Produto", "tracao": "Tração", "operacao": "Operação"}
        if dims:
            dim_data = [["Dimensão", "Score (1-5)"]]
            for k, v in dims.items():
                dim_data.append([dim_labels.get(k, k.capitalize()), f"{v:.1f}"])
            _build_metrics_table(story, dim_data)
    else:
        story.append(Paragraph(
            "Nenhuma avaliação qualitativa foi preenchida. O score foi mantido neutro (50/100, sem ajuste).",
            styles["BodyText2"]))
    story.append(PageBreak())
    story = __story

    # ═══════ SENSIBILIDADE + BENCHMARK (Profissional+) ═══════
    __story, story = story, story if is_prof else []
    story.append(Paragraph("Análise de Sensibilidade", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))
    story.append(Paragraph(
        "A tabela mostra como o Equity Value varia conforme mudanças na <b>taxa de desconto (WACC)</b> "
        "e na <b>taxa de crescimento</b>.", styles["BodyText2"]))

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
        s_cw = [80] + [int(370 / (n_c - 1))] * (n_c - 1)
        sens_table = Table(sens_rows, colWidths=s_cw)
        sens_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8), ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("BACKGROUND", (0, 0), (-1, 0), EMERALD_DARK), ("BACKGROUND", (0, 1), (0, -1), EMERALD_LIGHT),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOX", (0, 0), (-1, -1), 1, EMERALD),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#e2e8f0")),
        ]))
        # Highlight center cell
        mid = len(wacc_vals) // 2 + 1
        mid_c = len(growth_vals) // 2 + 1
        sens_table.setStyle(TableStyle([("BACKGROUND", (mid_c, mid), (mid_c, mid), EMERALD_LIGHT)]))
        story.append(sens_table)
    story.append(PageBreak())

    # ═══════ BENCHMARK ═══════
    story.append(Paragraph("Benchmark Setorial", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))

    sector_multiples = result.get("sector_multiples", {})
    ev_rev = result.get("enterprise_value", 0) / max(params.get("revenue", 1), 1)
    ev_rev_sector = sector_multiples.get("ev_revenue", 2.0)
    comp = "Acima do setor ▲" if ev_rev > ev_rev_sector * 1.1 else "Abaixo do setor ▼" if ev_rev < ev_rev_sector * 0.9 else "Na média ●"

    bench_data = [
        ["Indicador", "Empresa", "Setor", "Posição"],
        ["EV/Receita", f"{ev_rev:.1f}x", f"{ev_rev_sector:.1f}x", comp],
        ["β Unlevered", f"{result.get('beta_levered', 0):.2f}", f"{result.get('beta_unlevered', 0):.2f}", "—"],
        ["Percentil", f"{result.get('percentile', 0):.0f}%", "50%", f"{'Acima' if result.get('percentile', 50) > 50 else 'Abaixo'}"],
    ]
    bench_table = Table(bench_data, colWidths=[100, 100, 100, 150])
    bench_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE), ("BACKGROUND", (0, 0), (-1, 0), TEAL),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, EMERALD_LIGHT]),
        ("BOX", (0, 0), (-1, -1), 1, TEAL),
    ]))
    story.append(bench_table)
    story.append(Spacer(1, 8 * mm))
    story = __story

    # ═══════ RISCO + MATURIDADE ═══════
    story.append(Paragraph("Risco e Maturidade", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))

    risk_score = result.get("risk_score", 0)
    maturity_idx = result.get("maturity_index", 0)
    risk_label = "Baixo" if risk_score < 30 else "Moderado" if risk_score < 60 else "Alto" if risk_score < 80 else "Muito Alto"
    mat_label = "Inicial" if maturity_idx < 30 else "Em Desenvolvimento" if maturity_idx < 50 else "Consolidada" if maturity_idx < 75 else "Madura"

    rm_data = [
        ["Indicador", "Score", "Nível"],
        ["Score de Risco", f"{risk_score:.1f}/100", risk_label],
        ["Maturidade", f"{maturity_idx:.1f}/100", mat_label],
        ["Percentil de Mercado", f"{result.get('percentile', 0):.1f}%", "—"],
    ]
    _build_metrics_table(story, rm_data)
    story.append(PageBreak())

    # ═══════ RODADA DE INVESTIMENTO (Estratégico) ═══════
    __story, story = story, story if is_strat else []
    story.append(Paragraph("Simulação de Rodada de Investimento", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))
    story.append(Paragraph(
        "Simulação baseada no equity value estimado como <b>pre-money valuation</b>.", styles["BodyText2"]))

    round_data = [
        ["Parâmetro", "Valor"],
        ["Pre-Money Valuation", format_brl(inv_round.get("pre_money_valuation", 0))],
        ["Investimento (simulação)", format_brl(inv_round.get("investment_amount", 0))],
        ["Post-Money Valuation", format_brl(inv_round.get("post_money_valuation", 0))],
        ["Diluição", f"{inv_round.get('dilution_pct', 0):.1f}%"],
        ["Equity Fundador", f"{inv_round.get('founder_equity_pct', 0):.1f}%"],
        ["Equity Investidor", f"{inv_round.get('investor_equity_pct', 0):.1f}%"],
        ["Preço por 1%", format_brl(inv_round.get("price_per_1pct", 0))],
    ]
    _build_metrics_table(story, round_data)
    story.append(PageBreak())
    story = __story

    # ═══════ ANÁLISE IA (Estratégico) ═══════
    if is_strat and analysis.ai_analysis:
        story.append(Paragraph("Análise Estratégica (IA)", styles["SectionTitle"]))
        story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))
        story.append(Paragraph(
            "<i>Análise gerada por inteligência artificial com base nos dados financeiros e resultado do valuation.</i>",
            ParagraphStyle("AINote", fontName="Helvetica-Oblique", fontSize=9, textColor=GRAY, spaceAfter=12)))

        for paragraph in analysis.ai_analysis.split("\n\n"):
            p = paragraph.strip()
            if p:
                # Handle markdown headers
                if p.startswith("## "):
                    story.append(Paragraph(p[3:], styles["SubSection"]))
                elif p.startswith("# "):
                    story.append(Paragraph(p[2:], styles["SubSection"]))
                else:
                    story.append(Paragraph(p.replace("\n", "<br/>"), styles["BodyText2"]))
                story.append(Spacer(1, 3 * mm))
        story.append(PageBreak())

    # ═══════ GLOSSÁRIO ═══════
    story.append(Paragraph("Glossário", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))

    glossary = [
        ("DCF", "Discounted Cash Flow — método de avaliação que desconta fluxos de caixa futuros ao valor presente."),
        ("WACC", "Weighted Average Cost of Capital — custo médio ponderado de capital, taxa de desconto utilizada."),
        ("FCL", "Fluxo de Caixa Livre — caixa gerado pelas operações após investimentos e variações de capital de giro."),
        ("Valor Terminal", "Valor presente dos fluxos de caixa além do período de projeção explícita."),
        ("Gordon Growth", "Modelo de perpetuidade com crescimento constante para calcular o valor terminal."),
        ("Exit Multiple", "Método que aplica um múltiplo (EV/EBITDA) sobre o EBITDA do último ano projetado."),
        ("EBITDA", "Earnings Before Interest, Taxes, Depreciation, and Amortization — lucro operacional antes de juros, impostos, depreciação e amortização."),
        ("EV/Receita", "Enterprise Value dividido pela receita — múltiplo de avaliação por receita."),
        ("EV/EBITDA", "Enterprise Value dividido pelo EBITDA — múltiplo de avaliação por resultado operacional."),
        ("DLOM", "Discount for Lack of Marketability — desconto por falta de liquidez de empresa fechada."),
        ("Beta (β)", "Medida de risco sistemático de um setor em relação ao mercado. β > 1 = mais risco."),
        ("NOPAT", "Net Operating Profit After Tax — lucro operacional líquido de impostos."),
        ("Pre-Money", "Valor estimado da empresa antes de receber um investimento."),
        ("Post-Money", "Valor da empresa após o investimento (pre-money + investimento)."),
        ("Diluição", "Redução percentual na participação dos sócios originais após um investimento."),
    ]
    for term, definition in glossary:
        story.append(Paragraph(term, styles["GlossaryTerm"]))
        story.append(Paragraph(definition, styles["GlossaryDef"]))
    story.append(PageBreak())

    # ═══════ DISCLAIMER ═══════
    story.append(Paragraph("Disclaimer", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=EMERALD_LIGHT, spaceAfter=16))

    disclaimer_paras = [
        "Este relatório foi gerado pela plataforma Quanto Vale com finalidade exclusivamente "
        "informativa e educacional. Os valores apresentados são estimativas baseadas nas metodologias de "
        "Fluxo de Caixa Descontado (DCF Gordon Growth e Exit Multiple), Múltiplos de Mercado "
        "e ajustes de DLOM e Sobrevivência.",
        "Os dados setoriais (betas, múltiplos) são derivados de Aswath Damodaran (NYU Stern) e "
        "estatísticas de sobrevivência do SEBRAE/IBGE. A taxa livre de risco utiliza a Selic "
        "do Banco Central do Brasil.",
        "Este documento NÃO constitui recomendação de investimento, oferta de compra ou venda de "
        "participação societária, nem substitui uma avaliação formal realizada por profissional habilitado.",
        "Os resultados dependem diretamente da qualidade e veracidade dos dados inseridos. Projeções "
        "financeiras são, por natureza, incertas e podem divergir significativamente dos resultados reais.",
        "A Quanto Vale não se responsabiliza por decisões tomadas com base neste relatório. "
        "Recomendamos consultar um assessor financeiro qualificado antes de tomar decisões relevantes.",
        "Todos os direitos reservados. Quanto Vale © 2026.",
    ]
    for para in disclaimer_paras:
        story.append(Paragraph(para, styles["Disclaimer"]))
        story.append(Spacer(1, 3 * mm))

    story.append(Spacer(1, 15 * mm))
    story.append(HRFlowable(width="40%", thickness=0.5, color=EMERALD, spaceAfter=10))
    story.append(Paragraph(f"Relatório #{report_id} • {timestamp}", styles["Footer"]))
    story.append(Paragraph("quantovale.online • Valuation Realizado por QuantoVale", styles["Footer"]))

    # Build PDF with watermark footer
    doc.build(story, onFirstPage=_watermark_footer, onLaterPages=_watermark_footer)
    return filepath


def _build_metrics_table(story, data, col_widths=None):
    """Helper to build a standard 2-column metrics table."""
    if col_widths is None:
        col_widths = [250, 200]
    table = Table(data, colWidths=col_widths)
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE), ("BACKGROUND", (0, 0), (-1, 0), EMERALD_DARK),
        ("TEXTCOLOR", (0, 1), (0, -1), GRAY), ("TEXTCOLOR", (1, 1), (1, -1), NAVY),
        ("FONTNAME", (1, 1), (1, -1), "Helvetica-Bold"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, EMERALD_LIGHT]),
        ("BOX", (0, 0), (-1, -1), 1, EMERALD), ("LINEBELOW", (0, 0), (-1, 0), 2, EMERALD),
    ]))
    story.append(table)
