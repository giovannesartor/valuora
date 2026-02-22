"""
Quanto Vale — PDF Report Generator
Gerador de relatório premium usando ReportLab Platypus.
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
    PageBreak, Image, HRFlowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from app.core.config import settings

# Colors
NAVY = HexColor("#0f172a")
BLUE = HexColor("#2563eb")
BLUE_LIGHT = HexColor("#dbeafe")
GRAY = HexColor("#475569")
GRAY_LIGHT = HexColor("#f1f5f9")
GREEN = HexColor("#16a34a")
GREEN_LIGHT = HexColor("#f0fdf4")
RED = HexColor("#dc2626")
WHITE = HexColor("#ffffff")
BLACK = HexColor("#000000")


def get_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        "CoverTitle",
        fontName="Helvetica-Bold",
        fontSize=36,
        textColor=WHITE,
        alignment=TA_CENTER,
        spaceAfter=10,
    ))
    styles.add(ParagraphStyle(
        "CoverSubtitle",
        fontName="Helvetica",
        fontSize=14,
        textColor=HexColor("#94a3b8"),
        alignment=TA_CENTER,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        "SectionTitle",
        fontName="Helvetica-Bold",
        fontSize=18,
        textColor=NAVY,
        spaceBefore=20,
        spaceAfter=12,
    ))
    styles.add(ParagraphStyle(
        "SubSection",
        fontName="Helvetica-Bold",
        fontSize=13,
        textColor=BLUE,
        spaceBefore=14,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        "BodyText2",
        fontName="Helvetica",
        fontSize=10,
        textColor=GRAY,
        alignment=TA_JUSTIFY,
        leading=16,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        "ValueBig",
        fontName="Helvetica-Bold",
        fontSize=28,
        textColor=NAVY,
        alignment=TA_CENTER,
        spaceBefore=10,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        "ValueLabel",
        fontName="Helvetica",
        fontSize=10,
        textColor=GRAY,
        alignment=TA_CENTER,
        spaceAfter=16,
    ))
    styles.add(ParagraphStyle(
        "Disclaimer",
        fontName="Helvetica",
        fontSize=8,
        textColor=HexColor("#94a3b8"),
        alignment=TA_JUSTIFY,
        leading=12,
    ))
    styles.add(ParagraphStyle(
        "Footer",
        fontName="Helvetica",
        fontSize=8,
        textColor=HexColor("#94a3b8"),
        alignment=TA_CENTER,
    ))

    return styles


def format_brl(value: float) -> str:
    if value >= 1_000_000:
        return f"R$ {value/1_000_000:,.2f}M"
    elif value >= 1_000:
        return f"R$ {value/1_000:,.1f}K"
    return f"R$ {value:,.2f}"


def format_pct(value: float) -> str:
    return f"{value*100:.1f}%"


def generate_report_pdf(analysis) -> str:
    """Gera PDF premium para uma análise de valuation."""
    report_id = str(uuid.uuid4())[:8].upper()
    timestamp = datetime.now().strftime("%d/%m/%Y %H:%M")

    # Ensure output directory
    output_dir = Path(settings.REPORTS_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = f"quantovale-{analysis.id}-{report_id}.pdf"
    filepath = str(output_dir / filename)

    styles = get_styles()
    doc = SimpleDocTemplate(
        filepath,
        pagesize=A4,
        topMargin=2*cm,
        bottomMargin=2*cm,
        leftMargin=2.5*cm,
        rightMargin=2.5*cm,
    )

    story = []
    result = analysis.valuation_result or {}
    params = result.get("parameters", {})

    # ════════════════════════════════════════════════════════
    # 1. CAPA
    # ════════════════════════════════════════════════════════
    story.append(Spacer(1, 60*mm))
    story.append(Paragraph("QUANTO VALE", styles["CoverTitle"]))
    story.append(Paragraph("Relatório de Valuation Empresarial", styles["CoverSubtitle"]))
    story.append(Spacer(1, 30*mm))

    story.append(HRFlowable(width="60%", thickness=1, color=HexColor("#334155"), spaceAfter=20, spaceBefore=20))

    story.append(Paragraph(f"<b>{analysis.company_name}</b>", ParagraphStyle(
        "CompanyName", fontName="Helvetica-Bold", fontSize=22, textColor=NAVY, alignment=TA_CENTER, spaceAfter=8,
    )))
    story.append(Paragraph(f"Setor: {analysis.sector.capitalize()}", styles["CoverSubtitle"]))
    story.append(Spacer(1, 20*mm))

    # Metadata table
    meta_data = [
        ["ID do Relatório", report_id],
        ["Data", timestamp],
        ["Versão", "1.0"],
        ["Metodologia", "DCF — Fluxo de Caixa Descontado"],
    ]
    meta_table = Table(meta_data, colWidths=[120, 200])
    meta_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, -1), GRAY),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 20*mm))
    story.append(Paragraph("quantovalehoje@gmail.com", styles["Footer"]))

    story.append(PageBreak())

    # ════════════════════════════════════════════════════════
    # 2. RESUMO EXECUTIVO
    # ════════════════════════════════════════════════════════
    story.append(Paragraph("Resumo Executivo", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=BLUE_LIGHT, spaceAfter=16))

    equity = result.get("equity_value", 0)
    val_range = result.get("valuation_range", {})

    story.append(Paragraph(format_brl(equity), styles["ValueBig"]))
    story.append(Paragraph("Valor estimado do equity", styles["ValueLabel"]))

    # Range
    range_data = [
        ["Cenário Conservador", "Cenário Base", "Cenário Otimista"],
        [format_brl(val_range.get("low", 0)), format_brl(val_range.get("mid", 0)), format_brl(val_range.get("high", 0))],
    ]
    range_table = Table(range_data, colWidths=[150, 150, 150])
    range_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, 1), 12),
        ("TEXTCOLOR", (0, 0), (-1, 0), GRAY),
        ("TEXTCOLOR", (0, 1), (0, 1), HexColor("#dc2626")),
        ("TEXTCOLOR", (1, 1), (1, 1), NAVY),
        ("TEXTCOLOR", (2, 1), (2, 1), GREEN),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("BOX", (0, 0), (-1, -1), 1, HexColor("#e2e8f0")),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    story.append(range_table)
    story.append(Spacer(1, 10*mm))

    # Key metrics
    story.append(Paragraph("Indicadores-Chave", styles["SubSection"]))
    metrics_data = [
        ["Métrica", "Valor"],
        ["Receita Anual", format_brl(params.get("revenue", 0))],
        ["Margem Líquida", format_pct(params.get("net_margin", 0))],
        ["Taxa de Crescimento", format_pct(params.get("growth_rate", 0))],
        ["WACC", format_pct(result.get("wacc", 0))],
        ["Beta Setorial", f"{result.get('beta', 1.0):.2f}"],
        ["Enterprise Value", format_brl(result.get("enterprise_value", 0))],
        ["Score de Risco", f"{result.get('risk_score', 0):.1f}/100"],
        ["Índice de Maturidade", f"{result.get('maturity_index', 0):.1f}/100"],
        ["Percentil de Mercado", f"{result.get('percentile', 0):.1f}%"],
    ]
    if params.get("founder_dependency", 0) > 0:
        metrics_data.append(["Desconto Fundador", f"{result.get('founder_discount', 0):.1f}%"])

    metrics_table = Table(metrics_data, colWidths=[250, 200])
    metrics_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 1), (0, -1), GRAY),
        ("TEXTCOLOR", (1, 1), (1, -1), NAVY),
        ("FONTNAME", (1, 1), (1, -1), "Helvetica-Bold"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("BOX", (0, 0), (-1, -1), 1, HexColor("#e2e8f0")),
        ("LINEBELOW", (0, 0), (-1, 0), 2, BLUE),
    ]))
    story.append(metrics_table)

    story.append(PageBreak())

    # ════════════════════════════════════════════════════════
    # 3. METODOLOGIA DCF
    # ════════════════════════════════════════════════════════
    story.append(Paragraph("Metodologia", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=BLUE_LIGHT, spaceAfter=16))

    dcf_text = """O método de <b>Fluxo de Caixa Descontado (DCF)</b> é o padrão ouro para avaliação de empresas. 
    Ele estima o valor presente dos fluxos de caixa futuros que a empresa deverá gerar, descontados por uma taxa 
    que reflete o risco do investimento (WACC)."""
    story.append(Paragraph(dcf_text, styles["BodyText2"]))

    steps = [
        "1. Projeção do Fluxo de Caixa Livre (FCL) para 5 anos",
        "2. Cálculo do WACC com beta setorial e prêmio de microempresa",
        "3. Cálculo do Valor Terminal (perpetuidade)",
        "4. Desconto dos fluxos ao valor presente",
        "5. Ajuste por caixa, dívida e dependência do fundador",
    ]
    for step in steps:
        story.append(Paragraph(step, ParagraphStyle(
            "Step", fontName="Helvetica", fontSize=10, textColor=NAVY, leftIndent=20, spaceAfter=4, leading=16,
        )))

    story.append(Spacer(1, 10*mm))

    wacc_text = f"""<b>WACC calculado:</b> {format_pct(result.get('wacc', 0))}<br/>
    <b>Fórmula:</b> Ke × (E/(D+E)) + Kd × (1-t) × (D/(D+E))<br/>
    <b>Ke:</b> Rf + β × (Rm - Rf) + Prêmio PME<br/>
    <b>Beta setorial ({analysis.sector.capitalize()}):</b> {result.get('beta', 1.0):.2f}"""
    story.append(Paragraph(wacc_text, styles["BodyText2"]))

    story.append(PageBreak())

    # ════════════════════════════════════════════════════════
    # 4. PROJEÇÃO 5 ANOS
    # ════════════════════════════════════════════════════════
    story.append(Paragraph("Projeção de 5 Anos", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=BLUE_LIGHT, spaceAfter=16))

    projections = result.get("fcf_projections", [])
    if projections:
        proj_header = ["Ano", "Receita", "Cresc.", "EBIT", "NOPAT", "FCL"]
        proj_rows = [proj_header]
        for p in projections:
            proj_rows.append([
                f"Ano {p['year']}",
                format_brl(p["revenue"]),
                format_pct(p["growth_rate"]),
                format_brl(p["ebit"]),
                format_brl(p["nopat"]),
                format_brl(p["fcf"]),
            ])

        proj_table = Table(proj_rows, colWidths=[60, 85, 55, 85, 85, 85])
        proj_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("ALIGN", (0, 0), (0, -1), "LEFT"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
            ("BOX", (0, 0), (-1, -1), 1, HexColor("#e2e8f0")),
            ("LINEBELOW", (0, 0), (-1, 0), 2, BLUE),
        ]))
        story.append(proj_table)

    story.append(Spacer(1, 8*mm))

    # Terminal value info
    tv_text = f"""<b>Valor Terminal:</b> {format_brl(result.get('terminal_value', 0))}<br/>
    <b>VP do Valor Terminal:</b> {format_brl(result.get('pv_terminal_value', 0))}<br/>
    <b>VP dos FCLs:</b> {format_brl(result.get('pv_fcf_total', 0))}"""
    story.append(Paragraph(tv_text, styles["BodyText2"]))

    story.append(PageBreak())

    # ════════════════════════════════════════════════════════
    # 5. TIMELINE DE VALORIZAÇÃO
    # ════════════════════════════════════════════════════════
    story.append(Paragraph("Linha do Tempo de Valorização", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=BLUE_LIGHT, spaceAfter=16))

    pv_fcfs = result.get("pv_fcf", [])
    if pv_fcfs:
        cumulative = 0
        timeline_header = ["Ano", "VP do FCL", "Acumulado"]
        timeline_rows = [timeline_header]
        for i, pv in enumerate(pv_fcfs):
            cumulative += pv
            timeline_rows.append([f"Ano {i+1}", format_brl(pv), format_brl(cumulative)])

        timeline_rows.append(["Terminal", format_brl(result.get("pv_terminal_value", 0)),
                              format_brl(cumulative + result.get("pv_terminal_value", 0))])

        tl_table = Table(timeline_rows, colWidths=[100, 150, 150])
        tl_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("BACKGROUND", (0, -1), (-1, -1), GREEN_LIGHT),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, GRAY_LIGHT]),
            ("BOX", (0, 0), (-1, -1), 1, HexColor("#e2e8f0")),
        ]))
        story.append(tl_table)

    story.append(PageBreak())

    # ════════════════════════════════════════════════════════
    # 6. BENCHMARK SETORIAL
    # ════════════════════════════════════════════════════════
    story.append(Paragraph("Benchmark Setorial", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=BLUE_LIGHT, spaceAfter=16))

    multiples = result.get("sector_multiples", {})
    story.append(Paragraph(f"Setor: <b>{analysis.sector.capitalize()}</b>", styles["BodyText2"]))

    bench_data = [
        ["Múltiplo", "Setor", "Empresa", "Comparativo"],
        ["EV/Receita", f"{multiples.get('ev_revenue', 0):.1f}x",
         f"{result.get('enterprise_value', 0) / max(params.get('revenue', 1), 1):.1f}x", ""],
        ["EV/EBITDA", f"{multiples.get('ev_ebitda', 0):.1f}x", "—", ""],
    ]

    # Add comparativo
    ev_rev_company = result.get("enterprise_value", 0) / max(params.get("revenue", 1), 1)
    ev_rev_sector = multiples.get("ev_revenue", 2.0)
    if ev_rev_company > ev_rev_sector * 1.1:
        bench_data[1][3] = "Acima do setor ▲"
    elif ev_rev_company < ev_rev_sector * 0.9:
        bench_data[1][3] = "Abaixo do setor ▼"
    else:
        bench_data[1][3] = "Na média do setor ●"

    bench_table = Table(bench_data, colWidths=[100, 100, 100, 150])
    bench_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("BOX", (0, 0), (-1, -1), 1, HexColor("#e2e8f0")),
    ]))
    story.append(bench_table)

    story.append(Spacer(1, 8*mm))
    story.append(Paragraph(f"<b>Percentil de mercado estimado:</b> {result.get('percentile', 0):.1f}%", styles["BodyText2"]))

    story.append(PageBreak())

    # ════════════════════════════════════════════════════════
    # 7. ÍNDICE DE MATURIDADE
    # ════════════════════════════════════════════════════════
    story.append(Paragraph("Índice de Maturidade", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=BLUE_LIGHT, spaceAfter=16))

    maturity = result.get("maturity_index", 0)
    mat_level = "Inicial" if maturity < 30 else "Em Desenvolvimento" if maturity < 50 else "Consolidada" if maturity < 75 else "Madura"

    story.append(Paragraph(f"{maturity:.1f}/100", styles["ValueBig"]))
    story.append(Paragraph(f"Nível: {mat_level}", styles["ValueLabel"]))

    mat_text = """O Índice de Maturidade avalia a solidez e sustentabilidade do negócio considerando 
    escala de receita, consistência de margens, sustentabilidade do crescimento, 
    independência dos fundadores e profundidade dos dados disponíveis."""
    story.append(Paragraph(mat_text, styles["BodyText2"]))

    # ════════════════════════════════════════════════════════
    # 8. ANÁLISE ESTRATÉGICA IA
    # ════════════════════════════════════════════════════════
    if analysis.ai_analysis:
        story.append(PageBreak())
        story.append(Paragraph("Análise Estratégica", styles["SectionTitle"]))
        story.append(HRFlowable(width="100%", thickness=1, color=BLUE_LIGHT, spaceAfter=16))
        story.append(Paragraph("<i>Análise gerada por inteligência artificial com base nos dados financeiros fornecidos.</i>",
                               ParagraphStyle("AINote", fontName="Helvetica-Oblique", fontSize=9, textColor=GRAY, spaceAfter=12)))

        for paragraph in analysis.ai_analysis.split("\n\n"):
            if paragraph.strip():
                story.append(Paragraph(paragraph.strip(), styles["BodyText2"]))
                story.append(Spacer(1, 4*mm))

    # ════════════════════════════════════════════════════════
    # 9. DISCLAIMER
    # ════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(Paragraph("Disclaimer", styles["SectionTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=BLUE_LIGHT, spaceAfter=16))

    disclaimer = """Este relatório foi gerado pela plataforma Quanto Vale com finalidade exclusivamente 
    informativa e educacional. Os valores apresentados são estimativas baseadas na metodologia de 
    Fluxo de Caixa Descontado (DCF) e nos dados fornecidos pelo usuário. 
    
    Este documento NÃO constitui recomendação de investimento, oferta de compra ou venda de participação 
    societária, nem substitui uma avaliação formal realizada por profissional habilitado.
    
    Os resultados dependem diretamente da qualidade e veracidade dos dados inseridos. Projeções 
    financeiras são, por natureza, incertas e podem divergir significativamente dos resultados reais.
    
    A Quanto Vale não se responsabiliza por decisões tomadas com base neste relatório. Recomendamos 
    consultar um assessor financeiro qualificado antes de tomar decisões relevantes.
    
    Todos os direitos reservados. Quanto Vale © 2026."""

    for para in disclaimer.split("\n\n"):
        if para.strip():
            story.append(Paragraph(para.strip(), styles["Disclaimer"]))
            story.append(Spacer(1, 3*mm))

    story.append(Spacer(1, 20*mm))
    story.append(HRFlowable(width="40%", thickness=0.5, color=HexColor("#cbd5e1"), spaceAfter=10))
    story.append(Paragraph(f"Relatório #{report_id} • {timestamp}", styles["Footer"]))
    story.append(Paragraph("quantovale.online • quantovalehoje@gmail.com", styles["Footer"]))

    # Build PDF
    doc.build(story)
    return filepath
