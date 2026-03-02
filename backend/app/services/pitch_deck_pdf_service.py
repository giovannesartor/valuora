"""
Quanto Vale — Pitch Deck PDF Generator  (LivePlan-inspired)
Design premium, tema esmeralda/navy.
Seções: Capa, Table of Contents, Executive Summary / Opportunity,
        Execution, Company, Financial Plan, Appendix.
"""
import io
import uuid
import logging
import math
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, HRFlowable, KeepTogether, Flowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Circle, Wedge

from app.core.config import settings

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# COLOR PALETTE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NAVY         = HexColor("#0f172a")
NAVY_MID     = HexColor("#1e293b")
NAVY_LIGHT   = HexColor("#334155")
EMERALD      = HexColor("#059669")
EMERALD_DARK = HexColor("#047857")
EMERALD_LIGHT= HexColor("#d1fae5")
EMERALD_PALE = HexColor("#ecfdf5")
TEAL    = HexColor("#0d9488")
WHITE   = HexColor("#ffffff")
BLACK   = HexColor("#000000")
GRAY_900 = HexColor("#111827")
GRAY_700 = HexColor("#374151")
GRAY_600 = HexColor("#4b5563")
GRAY_500 = HexColor("#6b7280")
GRAY_400 = HexColor("#9ca3af")
GRAY_300 = HexColor("#d1d5db")
GRAY_200 = HexColor("#e5e7eb")
GRAY_100 = HexColor("#f3f4f6")
GRAY_50  = HexColor("#f9fafb")
GREEN  = HexColor("#16a34a")
RED    = HexColor("#dc2626")
AMBER  = HexColor("#d97706")
PURPLE = HexColor("#8b5cf6")
BLUE   = HexColor("#3b82f6")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STYLES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _get_styles():
    styles = getSampleStyleSheet()
    # Cover
    styles.add(ParagraphStyle("CoverCompany", fontName="Helvetica-Bold", fontSize=42,
        textColor=WHITE, alignment=TA_LEFT, leading=48, spaceAfter=8))
    styles.add(ParagraphStyle("CoverSlogan", fontName="Helvetica", fontSize=16,
        textColor=HexColor("#94a3b8"), alignment=TA_LEFT, leading=22, spaceAfter=6))
    styles.add(ParagraphStyle("CoverLabel", fontName="Helvetica-Bold", fontSize=11,
        textColor=EMERALD, alignment=TA_LEFT, spaceAfter=4))
    styles.add(ParagraphStyle("CoverMeta", fontName="Helvetica", fontSize=9,
        textColor=HexColor("#64748b"), alignment=TA_LEFT, leading=14, spaceAfter=2))
    # Chapter / Section
    styles.add(ParagraphStyle("ChapterTitle", fontName="Helvetica-Bold", fontSize=24,
        textColor=NAVY, spaceBefore=2, spaceAfter=10, leading=30))
    styles.add(ParagraphStyle("SectionTitle", fontName="Helvetica-Bold", fontSize=16,
        textColor=EMERALD_DARK, spaceBefore=12, spaceAfter=6, leading=20))
    styles.add(ParagraphStyle("SubSection", fontName="Helvetica-Bold", fontSize=12,
        textColor=NAVY, spaceBefore=8, spaceAfter=4, leading=16))
    # Body
    styles.add(ParagraphStyle("Body", fontName="Helvetica", fontSize=10,
        textColor=GRAY_600, alignment=TA_JUSTIFY, leading=16, spaceAfter=8))
    styles.add(ParagraphStyle("BodySmall", fontName="Helvetica", fontSize=8.5,
        textColor=GRAY_500, alignment=TA_JUSTIFY, leading=13, spaceAfter=5))
    # Values
    styles.add(ParagraphStyle("ValueHero", fontName="Helvetica-Bold", fontSize=32,
        textColor=EMERALD_DARK, alignment=TA_CENTER, spaceBefore=8, spaceAfter=6, leading=38))
    styles.add(ParagraphStyle("ValueLabel", fontName="Helvetica", fontSize=10,
        textColor=GRAY_500, alignment=TA_CENTER, spaceBefore=2, spaceAfter=14))
    # Footer / Disclaimer
    styles.add(ParagraphStyle("Footer", fontName="Helvetica", fontSize=7.5,
        textColor=GRAY_400, alignment=TA_CENTER))
    styles.add(ParagraphStyle("Disclaimer", fontName="Helvetica", fontSize=7.5,
        textColor=GRAY_500, alignment=TA_JUSTIFY, leading=11, spaceAfter=4))
    # TOC
    styles.add(ParagraphStyle("TOCItem", fontName="Helvetica", fontSize=12,
        textColor=GRAY_700, leading=20, spaceBefore=6, spaceAfter=6, leftIndent=10))
    # Team
    styles.add(ParagraphStyle("TeamName", fontName="Helvetica-Bold", fontSize=12,
        textColor=NAVY, alignment=TA_LEFT, leading=16, spaceAfter=1))
    styles.add(ParagraphStyle("TeamRole", fontName="Helvetica-Bold", fontSize=9,
        textColor=EMERALD_DARK, alignment=TA_LEFT, leading=13, spaceAfter=3))
    styles.add(ParagraphStyle("TeamBio", fontName="Helvetica", fontSize=8.5,
        textColor=GRAY_600, alignment=TA_LEFT, leading=12, spaceAfter=2))
    styles.add(ParagraphStyle("TeamLinkedin", fontName="Helvetica", fontSize=8,
        textColor=BLUE, alignment=TA_LEFT, leading=12))
    return styles


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# HELPERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _format_brl(value):
    if value is None:
        return "\u2014"
    if abs(value) >= 1_000_000:
        return f"R$ {value/1_000_000:,.2f}M"
    elif abs(value) >= 1_000:
        return f"R$ {value/1_000:,.1f}K"
    return f"R$ {value:,.2f}"


class _SectionDivider(Flowable):
    """Thin horizontal rule."""
    def __init__(self, width=None, color=EMERALD, thickness=1.5):
        super().__init__()
        self._width = width
        self._color = color
        self._thickness = thickness

    def wrap(self, aW, aH):
        self.availWidth = aW
        return (aW, self._thickness + 8 * mm)

    def draw(self):
        w = self._width or self.availWidth
        self.canv.setStrokeColor(self._color)
        self.canv.setLineWidth(self._thickness)
        self.canv.line(0, 4 * mm, w, 4 * mm)


def _footer(canvas, doc):
    canvas.saveState()
    w, _ = A4
    canvas.setStrokeColor(EMERALD)
    canvas.setLineWidth(0.8)
    canvas.line(2.5 * cm, 18 * mm, w - 2.5 * cm, 18 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(GRAY_400)
    canvas.drawString(2.5 * cm, 12 * mm, "quantovale.online  \u00b7  Pitch Deck")
    canvas.drawRightString(w - 2.5 * cm, 12 * mm, f"P\u00e1gina {doc.page}")
    canvas.setFillColor(EMERALD)
    canvas.circle(w / 2, 12 * mm + 1, 1.5, fill=1, stroke=0)
    canvas.restoreState()


def _cover_page(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)
    canvas.setFillColor(EMERALD)
    canvas.rect(0, 0, 6 * mm, h, fill=1, stroke=0)
    canvas.setFillColor(HexColor("#1e293b"))
    canvas.circle(w - 30 * mm, h - 35 * mm, 60 * mm, fill=1, stroke=0)
    canvas.setFillColor(HexColor("#1a2332"))
    canvas.circle(w - 15 * mm, h - 55 * mm, 35 * mm, fill=1, stroke=0)
    canvas.setFillColor(EMERALD_DARK)
    canvas.rect(0, 0, w, 24 * mm, fill=1, stroke=0)
    canvas.setFillColor(EMERALD)
    canvas.rect(0, 0, w, 3 * mm, fill=1, stroke=0)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(HexColor("#a7f3d0"))
    canvas.drawCentredString(w / 2, 10 * mm, "quantovale.online  \u00b7  Pitch Deck para Investidores")
    canvas.restoreState()


def _chapter_header(story, chapter_num, title, styles):
    story.append(Spacer(1, 4 * mm))
    num_para = Paragraph(
        f'<font color="{EMERALD.hexval()}" size="14">{chapter_num:02d}</font>'
        f'<font color="{GRAY_300.hexval()}" size="14">  |  </font>'
        f'<font color="{NAVY.hexval()}" size="20"><b>{title}</b></font>',
        ParagraphStyle("ChapterHead", fontName="Helvetica-Bold", fontSize=20,
                        textColor=NAVY, leading=26, spaceBefore=2, spaceAfter=4)
    )
    story.append(num_para)
    story.append(_SectionDivider())


def _section_title(story, title, styles):
    story.append(Paragraph(title, styles["SectionTitle"]))
    story.append(Spacer(1, 2 * mm))


def _subsection(story, title, styles):
    story.append(Paragraph(title, styles["SubSection"]))


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
    if not projections:
        return
    W, H = 450, 200
    d = Drawing(W, H + 30)
    d.add(String(0, H + 15, "Proje\u00e7\u00f5es Financeiras",
                 fontName="Helvetica-Bold", fontSize=10, fillColor=NAVY))

    n = len(projections)
    ml, mr, mb = 65, 20, 30
    cw = W - ml - mr
    ch = H - mb - 10

    all_vals = []
    for p in projections:
        all_vals.extend([p.get("revenue", 0), p.get("expenses", 0), abs(p.get("profit", 0))])
    mx = max(all_vals) if all_vals else 1
    if mx == 0:
        mx = 1

    bgw = cw / n
    bw = bgw * 0.22

    for i in range(5):
        y = mb + (ch * i / 4)
        d.add(Line(ml, y, W - mr, y, strokeColor=GRAY_200, strokeWidth=0.5))
        d.add(String(2, y - 3, _format_brl(mx * i / 4),
                     fontName="Helvetica", fontSize=5.5, fillColor=GRAY_500))

    d.add(Line(ml, mb, W - mr, mb, strokeColor=GRAY_300, strokeWidth=1))

    for i, p in enumerate(projections):
        rev = p.get("revenue", 0)
        exp = p.get("expenses", 0)
        profit = p.get("profit", 0)
        xc = ml + bgw * i + bgw / 2

        d.add(Rect(xc - bw * 1.5, mb, bw, max((rev / mx) * ch, 0.5),
                    fillColor=EMERALD, strokeColor=None))
        d.add(Rect(xc - bw * 0.3, mb, bw, max((exp / mx) * ch, 0.5),
                    fillColor=AMBER, strokeColor=None))
        ph = max((abs(profit) / mx) * ch, 0.5)
        d.add(Rect(xc + bw * 0.9, mb, bw, ph,
                    fillColor=TEAL if profit >= 0 else RED, strokeColor=None))
        d.add(String(xc - 10, mb - 12, str(p.get("year", i + 1)),
                      fontName="Helvetica", fontSize=7, fillColor=GRAY_600))

    lx = ml
    d.add(Rect(lx, H + 5, 8, 8, fillColor=EMERALD, strokeColor=None))
    d.add(String(lx + 11, H + 5, "Receita", fontName="Helvetica", fontSize=7, fillColor=GRAY_600))
    d.add(Rect(lx + 55, H + 5, 8, 8, fillColor=AMBER, strokeColor=None))
    d.add(String(lx + 66, H + 5, "Despesas", fontName="Helvetica", fontSize=7, fillColor=GRAY_600))
    d.add(Rect(lx + 120, H + 5, 8, 8, fillColor=TEAL, strokeColor=None))
    d.add(String(lx + 131, H + 5, "Lucro", fontName="Helvetica", fontSize=7, fillColor=GRAY_600))

    story.append(d)
    story.append(Spacer(1, 6 * mm))


def _draw_milestone_timeline(story, milestones, styles):
    if not milestones:
        return
    for m in milestones[:12]:
        status = m.get("status", "upcoming")
        icon = "\u2713" if status == "completed" else "\u25cf" if status == "in_progress" else "\u25cb"
        sc = EMERALD.hexval() if status == "completed" else AMBER.hexval() if status == "in_progress" else GRAY_400.hexval()
        date_str = m.get("date", "")
        title = m.get("title", "")
        desc = m.get("description", "")
        date_part = f'<font color="{GRAY_500.hexval()}" size="8">{date_str}</font>  ' if date_str else ""
        story.append(Paragraph(
            f'<font color="{sc}" size="12">{icon}</font>  '
            f'{date_part}'
            f'<font color="{NAVY.hexval()}"><b>{title}</b></font>'
            f'{("  \u2014  " + desc) if desc else ""}',
            ParagraphStyle("MS", fontName="Helvetica", fontSize=9.5,
                           textColor=GRAY_600, leading=15, spaceBefore=6, spaceAfter=6, leftIndent=8)
        ))


def _draw_funding_breakdown(story, funding):
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
    d.add(String(0, H + 2, "Destina\u00e7\u00e3o dos Recursos",
                 fontName="Helvetica-Bold", fontSize=10, fillColor=NAVY))

    cx, cy = 100, H / 2 - 5
    outer_r, inner_r = 65, 38
    colors = [EMERALD, TEAL, BLUE, PURPLE, AMBER, RED, GREEN, GRAY_600]

    start = 90
    for i, item in enumerate(breakdown[:8]):
        val = item.get("value", 0)
        if val <= 0:
            continue
        sweep = (val / total) * 360
        d.add(Wedge(cx, cy, outer_r, start, start + sweep,
                     fillColor=colors[i % len(colors)], strokeColor=WHITE, strokeWidth=1.5))
        start += sweep

    d.add(Circle(cx, cy, inner_r, fillColor=WHITE, strokeColor=None))
    d.add(String(cx - 18, cy + 4, "Total", fontName="Helvetica", fontSize=7, fillColor=GRAY_500))
    d.add(String(cx - 25, cy - 8, _format_brl(total),
                  fontName="Helvetica-Bold", fontSize=8, fillColor=NAVY))

    lx = 190
    for i, item in enumerate(breakdown[:8]):
        val = item.get("value", 0)
        if val <= 0:
            continue
        pct = val / total * 100
        ly = H / 2 + 50 - i * 20
        c = colors[i % len(colors)]
        d.add(Rect(lx, ly, 10, 10, fillColor=c, strokeColor=None))
        d.add(String(lx + 14, ly + 1, item.get("label", f"Item {i+1}")[:25],
                      fontName="Helvetica-Bold", fontSize=7, fillColor=GRAY_700))
        d.add(String(lx + 14, ly - 9, f"{_format_brl(val)} ({pct:.0f}%)",
                      fontName="Helvetica", fontSize=6.5, fillColor=GRAY_500))

    story.append(d)
    story.append(Spacer(1, 6 * mm))


def _try_load_image(url_or_path, max_w=30*mm, max_h=30*mm):
    if not url_or_path:
        return None
    try:
        if url_or_path.startswith("http"):
            import httpx
            resp = httpx.get(url_or_path, timeout=5, follow_redirects=True)
            if resp.status_code == 200:
                return Image(io.BytesIO(resp.content), width=max_w, height=max_h, kind='proportional')
        else:
            p = Path(settings.UPLOADS_DIR) / url_or_path
            if p.exists():
                return Image(str(p), width=max_w, height=max_h, kind='proportional')
    except Exception as e:
        logger.debug(f"[PitchDeckPDF] Could not load image {url_or_path!r}: {e!r}")
    return None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MAIN GENERATOR
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def generate_pitch_deck_pdf(deck, analysis_data=None):
    """
    Generate a LivePlan-inspired Pitch Deck PDF.

    Chapters:
      Cover -> TOC -> Executive Summary -> Opportunity
      -> Execution -> Company -> Financial Plan -> Disclaimer
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
        title=f"Pitch Deck \u2014 {deck.company_name}",
        author="Quanto Vale",
        subject="Pitch Deck para Investidores",
    )

    story = []

    # ═══════════════════════════════════════════════════
    # COVER PAGE
    # ═══════════════════════════════════════════════════
    logo_spacer = 65
    if deck.logo_path:
        try:
            lp = Path(settings.UPLOADS_DIR) / deck.logo_path
            if lp.exists():
                li = Image(str(lp), width=55 * mm, height=55 * mm, kind='proportional')
                li.hAlign = 'LEFT'
                story.append(Spacer(1, 25 * mm))
                story.append(li)
                story.append(Spacer(1, 8 * mm))
                logo_spacer = 5
        except Exception as e:
            logger.debug(f"[PitchDeckPDF] Could not load cover logo {deck.logo_path!r}: {e!r}")

    story.append(Spacer(1, logo_spacer * mm))
    story.append(Paragraph("PITCH DECK", styles["CoverLabel"]))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(deck.company_name, styles["CoverCompany"]))
    story.append(Spacer(1, 4 * mm))

    if deck.slogan:
        story.append(Paragraph(deck.slogan, styles["CoverSlogan"]))
        story.append(Spacer(1, 4 * mm))
    if deck.sector:
        story.append(Paragraph(f"Setor: {deck.sector.capitalize()}", styles["CoverSlogan"]))

    story.append(Spacer(1, 18 * mm))

    meta = []
    if deck.contact_email:
        meta.append(f"E-mail: {deck.contact_email}")
    if deck.contact_phone:
        meta.append(f"Telefone: {deck.contact_phone}")
    if deck.website:
        meta.append(f"Website: {deck.website}")
    meta.append(f"Documento #{report_id}  \u00b7  {timestamp}")
    meta.append("Gerado por Quanto Vale \u00b7 quantovale.online")
    for line in meta:
        story.append(Paragraph(line, styles["CoverMeta"]))
    story.append(PageBreak())

    # ─── Pre-compute text fields ──────────────────────
    headline_text = deck.ai_headline or deck.headline
    problem_text = deck.ai_problem or deck.problem
    solution_text = deck.ai_solution or deck.solution
    bm_text = deck.ai_business_model or deck.business_model
    sales_text = deck.ai_sales_channels or deck.sales_channels
    marketing_text = deck.ai_marketing or deck.marketing_activities
    target = deck.target_market
    competitors = deck.competitive_landscape
    projections = deck.financial_projections
    funding = deck.funding_needs
    milestones = deck.milestones
    team = deck.team
    partners = deck.partners_resources

    # ═══════════════════════════════════════════════════
    # TABLE OF CONTENTS
    # ═══════════════════════════════════════════════════
    toc = []
    ch = 1
    toc.append((ch, "Resumo Executivo")); ch += 1
    if problem_text or solution_text or target or competitors:
        toc.append((ch, "A Oportunidade")); ch += 1
    if bm_text or sales_text or marketing_text or milestones:
        toc.append((ch, "Execu\u00e7\u00e3o")); ch += 1
    if team or partners:
        toc.append((ch, "A Empresa")); ch += 1
    if projections or funding or analysis_data:
        toc.append((ch, "Plano Financeiro")); ch += 1
    toc.append((ch, "Disclaimer Legal"))

    story.append(Paragraph("\u00cdndice", styles["ChapterTitle"]))
    story.append(_SectionDivider())
    story.append(Spacer(1, 6 * mm))

    for num, label in toc:
        story.append(Paragraph(
            f'<font color="{EMERALD_DARK.hexval()}"><b>{num:02d}</b></font>'
            f'<font color="{GRAY_300.hexval()}">  \u00b7  </font>'
            f'<font color="{GRAY_700.hexval()}">{label}</font>',
            styles["TOCItem"]
        ))
    story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # CH 1 — RESUMO EXECUTIVO
    # ═══════════════════════════════════════════════════
    ch_num = 1
    _chapter_header(story, ch_num, "Resumo Executivo", styles)

    if headline_text:
        story.append(Spacer(1, 4 * mm))
        qt = Table(
            [[Paragraph(
                f'<i>"{headline_text}"</i>',
                ParagraphStyle("QI", fontName="Helvetica-BoldOblique", fontSize=13,
                               textColor=EMERALD_DARK, leading=19, alignment=TA_LEFT)
            )]],
            colWidths=[430]
        )
        qt.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 16),
            ("TOPPADDING", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ("LINEBEFORE", (0, 0), (0, -1), 4, EMERALD),
            ("BACKGROUND", (0, 0), (-1, -1), EMERALD_PALE),
        ]))
        story.append(qt)
        story.append(Spacer(1, 6 * mm))

    sd = [["Informa\u00e7\u00e3o", "Detalhe"]]
    sd.append(["Empresa", deck.company_name])
    if deck.sector:
        sd.append(["Setor", deck.sector.capitalize()])
    if deck.website:
        sd.append(["Website", deck.website])
    if deck.contact_email:
        sd.append(["E-mail", deck.contact_email])
    if deck.contact_phone:
        sd.append(["Telefone", deck.contact_phone])
    if analysis_data and analysis_data.get("equity_value"):
        sd.append(["Valuation Estimado", _format_brl(analysis_data["equity_value"])])
    if funding and funding.get("amount"):
        sd.append(["Capital Buscado", _format_brl(funding["amount"])])
    if len(sd) > 1:
        _build_table(story, sd)
        story.append(Spacer(1, 8 * mm))

    if analysis_data and analysis_data.get("equity_value"):
        story.append(Paragraph(_format_brl(analysis_data["equity_value"]), styles["ValueHero"]))
        story.append(Paragraph("Valuation Estimado (DCF)", styles["ValueLabel"]))

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # CH 2 — A OPORTUNIDADE
    # ═══════════════════════════════════════════════════
    has_opp = problem_text or solution_text or target or competitors
    if has_opp:
        ch_num += 1
        _chapter_header(story, ch_num, "A Oportunidade", styles)

        if problem_text:
            _section_title(story, "O Problema", styles)
            story.append(Paragraph(problem_text, styles["Body"]))
            story.append(Spacer(1, 6 * mm))

        if solution_text:
            _section_title(story, "Nossa Solu\u00e7\u00e3o", styles)
            story.append(Paragraph(solution_text, styles["Body"]))
            story.append(Spacer(1, 6 * mm))

        if target:
            _section_title(story, "Mercado-Alvo", styles)
            if target.get("description"):
                story.append(Paragraph(target["description"], styles["Body"]))
                story.append(Spacer(1, 3 * mm))

            md = [["M\u00e9trica", "Valor"]]
            if target.get("tam"):
                md.append(["TAM (Mercado Total)", target["tam"]])
            if target.get("sam"):
                md.append(["SAM (Mercado Endere\u00e7\u00e1vel)", target["sam"]])
            if target.get("som"):
                md.append(["SOM (Mercado Ating\u00edvel)", target["som"]])
            if len(md) > 1:
                _build_table(story, md)

            segs = target.get("segments", [])
            if segs:
                story.append(Spacer(1, 4 * mm))
                _subsection(story, "Segmentos-alvo", styles)
                for s in segs[:10]:
                    story.append(Paragraph(f"  \u25cf  {s}", styles["Body"]))
            story.append(Spacer(1, 6 * mm))

        if competitors:
            _section_title(story, "Cen\u00e1rio Competitivo", styles)
            cd = [["Concorrente", "Nossa Vantagem"]]
            for c in competitors[:8]:
                cd.append([c.get("competitor", ""), c.get("advantage", "")])
            _build_table(story, cd)
            story.append(Spacer(1, 6 * mm))

        story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # CH 3 — EXECUÇÃO
    # ═══════════════════════════════════════════════════
    has_exec = bm_text or sales_text or marketing_text or milestones
    if has_exec:
        ch_num += 1
        _chapter_header(story, ch_num, "Execu\u00e7\u00e3o", styles)

        if bm_text:
            _section_title(story, "Modelo de Neg\u00f3cios", styles)
            story.append(Paragraph(bm_text, styles["Body"]))
            story.append(Spacer(1, 6 * mm))

        if sales_text:
            _section_title(story, "Canais de Vendas", styles)
            story.append(Paragraph(sales_text, styles["Body"]))
            story.append(Spacer(1, 6 * mm))

        if marketing_text:
            _section_title(story, "Marketing & Crescimento", styles)
            story.append(Paragraph(marketing_text, styles["Body"]))
            story.append(Spacer(1, 6 * mm))

        if milestones:
            _section_title(story, "Roadmap \u2014 Marcos Estrat\u00e9gicos", styles)
            _draw_milestone_timeline(story, milestones, styles)
            story.append(Spacer(1, 6 * mm))

        story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # CH 4 — A EMPRESA  (Team + Partners)
    # ═══════════════════════════════════════════════════
    has_company = team or partners
    if has_company:
        ch_num += 1
        _chapter_header(story, ch_num, "A Empresa", styles)

        if team:
            _section_title(story, "Equipe", styles)
            story.append(Paragraph(
                "As pessoas por tr\u00e1s da empresa \u2014 a equipe que vai executar a vis\u00e3o.",
                styles["BodySmall"]))
            story.append(Spacer(1, 4 * mm))

            for member in team[:10]:
                name = member.get("name", "")
                role = member.get("role", "")
                bio = member.get("bio", "")
                linkedin = member.get("linkedin", "")
                photo_url = member.get("photo_url", "") or member.get("photo_path", "")

                text_parts = []
                text_parts.append(Paragraph(name, styles["TeamName"]))
                text_parts.append(Paragraph(role, styles["TeamRole"]))
                if bio:
                    text_parts.append(Paragraph(bio, styles["TeamBio"]))
                if linkedin:
                    disp = linkedin
                    if "linkedin.com/" in linkedin:
                        disp = linkedin.split("linkedin.com/")[-1].strip("/")
                        if len(disp) > 40:
                            disp = disp[:40] + "\u2026"
                    text_parts.append(Paragraph(
                        f'<font color="{BLUE.hexval()}">\U0001F517 linkedin.com/{disp}</font>',
                        styles["TeamLinkedin"]))

                photo_img = _try_load_image(photo_url, max_w=24*mm, max_h=24*mm)

                if photo_img:
                    row_data = [[photo_img, text_parts]]
                    ct = Table(row_data, colWidths=[30*mm, 400])
                else:
                    initials = "".join(w[0].upper() for w in name.split()[:2]) if name else "?"
                    init_d = Drawing(24*mm, 24*mm)
                    init_d.add(Circle(12*mm, 12*mm, 12*mm, fillColor=EMERALD_DARK, strokeColor=None))
                    init_d.add(String(12*mm - 7, 12*mm - 5, initials,
                                      fontName="Helvetica-Bold", fontSize=14, fillColor=WHITE))
                    row_data = [[init_d, text_parts]]
                    ct = Table(row_data, colWidths=[30*mm, 400])

                ct.setStyle(TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("BACKGROUND", (0, 0), (-1, -1), GRAY_50),
                    ("BOX", (0, 0), (-1, -1), 0.5, GRAY_200),
                ]))
                story.append(KeepTogether([ct, Spacer(1, 3*mm)]))

            story.append(Spacer(1, 6 * mm))

        if partners:
            _section_title(story, "Parceiros & Recursos Estrat\u00e9gicos", styles)
            for p in partners[:8]:
                story.append(Paragraph(
                    f'\u25cf  <b>{p.get("name", "")}</b>',
                    ParagraphStyle("PI", fontName="Helvetica", fontSize=10,
                                   textColor=GRAY_700, leading=16, spaceAfter=4)))
            story.append(Spacer(1, 6 * mm))

        story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # CH 5 — PLANO FINANCEIRO
    # ═══════════════════════════════════════════════════
    has_fin = projections or funding or analysis_data
    if has_fin:
        ch_num += 1
        _chapter_header(story, ch_num, "Plano Financeiro", styles)

        if projections:
            _section_title(story, "Proje\u00e7\u00f5es Financeiras", styles)
            _draw_revenue_chart(story, projections)
            pd = [["Ano", "Receita", "Despesas", "Lucro"]]
            for p in projections:
                pd.append([
                    str(p.get("year", "")),
                    _format_brl(p.get("revenue", 0)),
                    _format_brl(p.get("expenses", 0)),
                    _format_brl(p.get("profit", 0)),
                ])
            _build_table(story, pd, col_widths=[80, 130, 130, 130])
            story.append(Spacer(1, 8 * mm))
        elif analysis_data:
            vr = analysis_data.get("valuation_result", {})
            fcf = vr.get("fcf_projections", [])
            if fcf:
                _section_title(story, "Proje\u00e7\u00f5es Financeiras (DCF)", styles)
                fd = [["Ano", "Receita", "FCFE"]]
                for p in fcf[:10]:
                    fd.append([f"Ano {p.get('year', '')}", _format_brl(p.get("revenue", 0)),
                               _format_brl(p.get("fcf", 0))])
                _build_table(story, fd, col_widths=[100, 175, 175])
                story.append(Spacer(1, 8 * mm))

        if funding:
            _section_title(story, "Necessidade de Capital", styles)
            amt = funding.get("amount", 0)
            if amt:
                story.append(Paragraph(_format_brl(amt), styles["ValueHero"]))
                story.append(Paragraph("Capital buscado", styles["ValueLabel"]))

            desc = deck.ai_funding_use or funding.get("description", "")
            if desc:
                story.append(Paragraph(desc, styles["Body"]))
                story.append(Spacer(1, 4 * mm))

            _draw_funding_breakdown(story, funding)

            bd = funding.get("breakdown", [])
            if bd:
                bdt = [["Destina\u00e7\u00e3o", "Valor"]]
                for item in bd:
                    bdt.append([item.get("label", ""), _format_brl(item.get("value", 0))])
                _build_table(story, bdt)
            story.append(Spacer(1, 8 * mm))

        if analysis_data:
            _section_title(story, "Valuation \u2014 Resumo Executivo", styles)
            eq = analysis_data.get("equity_value")
            if eq:
                story.append(Paragraph(_format_brl(eq), styles["ValueHero"]))
                story.append(Paragraph("Valor Estimado do Equity (DCF)", styles["ValueLabel"]))

            vr = analysis_data.get("valuation_result", {})
            vd = [["Indicador", "Valor"]]
            if analysis_data.get("revenue"):
                vd.append(["Receita Anual", _format_brl(analysis_data["revenue"])])
            if analysis_data.get("net_margin"):
                vd.append(["Margem L\u00edquida", f"{analysis_data['net_margin'] * 100:.1f}%"])
            if analysis_data.get("growth_rate"):
                vd.append(["Crescimento", f"{analysis_data['growth_rate'] * 100:.1f}%"])
            if analysis_data.get("ebitda"):
                vd.append(["EBITDA", _format_brl(analysis_data["ebitda"])])
            if vr.get("wacc"):
                vd.append(["Ke (Custo de Capital)", f"{vr['wacc'] * 100:.1f}%"])
            if analysis_data.get("risk_score"):
                vd.append(["Score de Risco", f"{analysis_data['risk_score']:.0f}/100"])
            if len(vd) > 1:
                _build_table(story, vd)
            story.append(Spacer(1, 6 * mm))

            vrange = vr.get("valuation_range", {})
            if vrange:
                rd = [["Cen\u00e1rio", "Valor"]]
                if vrange.get("low"):
                    rd.append(["Conservador", _format_brl(vrange["low"])])
                if vrange.get("mid"):
                    rd.append(["Base", _format_brl(vrange["mid"])])
                if vrange.get("high"):
                    rd.append(["Otimista", _format_brl(vrange["high"])])
                if len(rd) > 1:
                    _build_table(story, rd)

        story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # DISCLAIMER
    # ═══════════════════════════════════════════════════
    ch_num += 1
    _chapter_header(story, ch_num, "Disclaimer Legal", styles)
    story.append(Paragraph(
        "Este Pitch Deck foi gerado pela plataforma Quanto Vale (quantovale.online) com base "
        "em informa\u00e7\u00f5es fornecidas pelo usu\u00e1rio. As proje\u00e7\u00f5es financeiras s\u00e3o estimativas e n\u00e3o "
        "constituem garantia de resultados futuros. Dados de valuation, quando presentes, s\u00e3o "
        "baseados em metodologia DCF (Discounted Cash Flow) com par\u00e2metros setoriais p\u00fablicos. "
        "Este documento n\u00e3o substitui parecer jur\u00eddico, cont\u00e1bil ou de assessoria financeira "
        "profissional. A Quanto Vale n\u00e3o se responsabiliza por decis\u00f5es de investimento baseadas "
        "neste material. Todos os dados s\u00e3o confidenciais.", styles["Disclaimer"]))

    story.append(Spacer(1, 15 * mm))
    story.append(_SectionDivider(color=GRAY_300, thickness=0.5))
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(
        f'Gerado por <b>Quanto Vale</b> \u00b7 quantovale.online  \u00b7  {timestamp}',
        ParagraphStyle("FN", fontName="Helvetica", fontSize=9,
                       textColor=EMERALD_DARK, alignment=TA_CENTER, leading=14)))

    doc.build(story, onFirstPage=_cover_page, onLaterPages=_footer)
    return filepath
