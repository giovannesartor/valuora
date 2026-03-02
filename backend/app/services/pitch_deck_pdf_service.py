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

from reportlab.lib.pagesizes import A4, landscape as _landscape
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
# PAGE SIZE — Landscape A4 for presentation-style layout
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAGE_SIZE = _landscape(A4)          # ~841.9 × 595.3 pt
PAGE_W, PAGE_H = PAGE_SIZE
CONTENT_W = int(PAGE_W - 5 * cm)   # ≈ 700 pt usable width
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NAVY         = HexColor("#0f172a")
NAVY_MID     = HexColor("#1e293b")
NAVY_LIGHT   = HexColor("#334155")
EMERALD      = HexColor("#10b981")       # emerald-500 — brand green claro
EMERALD_DARK = HexColor("#059669")       # emerald-600
EMERALD_BRIGHT = HexColor("#34d399")     # emerald-400 — destaques/charts
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
        textColor=EMERALD_DARK, spaceBefore=8, spaceAfter=4, leading=16))
    # Body
    styles.add(ParagraphStyle("Body", fontName="Helvetica", fontSize=10,
        textColor=GRAY_600, alignment=TA_JUSTIFY, leading=16, spaceAfter=8))
    styles.add(ParagraphStyle("BodySmall", fontName="Helvetica", fontSize=8.5,
        textColor=GRAY_500, alignment=TA_JUSTIFY, leading=13, spaceAfter=5))
    # Values
    styles.add(ParagraphStyle("ValueHero", fontName="Helvetica-Bold", fontSize=32,
        textColor=EMERALD, alignment=TA_CENTER, spaceBefore=8, spaceAfter=6, leading=38))
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
    # Impact slide (1-sentence big text)
    styles.add(ParagraphStyle("ImpactTitle", fontName="Helvetica-Bold", fontSize=26,
        textColor=WHITE, alignment=TA_CENTER, leading=34, spaceBefore=0, spaceAfter=0))
    styles.add(ParagraphStyle("ImpactLabel", fontName="Helvetica-Bold", fontSize=9,
        textColor=EMERALD, alignment=TA_CENTER, leading=13, spaceBefore=0, spaceAfter=6))
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
    pw, ph = doc.pagesize
    # Double-line footer for visual depth
    canvas.setStrokeColor(EMERALD)
    canvas.setLineWidth(1.5)
    canvas.line(2.5 * cm, 19 * mm, pw - 2.5 * cm, 19 * mm)
    canvas.setStrokeColor(EMERALD_LIGHT)
    canvas.setLineWidth(0.5)
    canvas.line(2.5 * cm, 18 * mm, pw - 2.5 * cm, 18 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(GRAY_400)
    canvas.drawString(2.5 * cm, 12 * mm, "quantovale.online  \u00b7  Pitch Deck")
    canvas.drawRightString(pw - 2.5 * cm, 12 * mm, f"P\u00e1gina {doc.page}")
    canvas.setFillColor(EMERALD_BRIGHT)
    canvas.circle(pw / 2, 12 * mm + 1, 2, fill=1, stroke=0)
    canvas.restoreState()


def _cover_page(canvas, doc):
    canvas.saveState()
    pw, ph = doc.pagesize
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, pw, ph, fill=1, stroke=0)
    canvas.setFillColor(EMERALD)
    canvas.rect(0, 0, 6 * mm, ph, fill=1, stroke=0)
    canvas.setFillColor(HexColor("#1e293b"))
    canvas.circle(pw - 30 * mm, ph - 35 * mm, 70 * mm, fill=1, stroke=0)
    canvas.setFillColor(HexColor("#1a2332"))
    canvas.circle(pw - 15 * mm, ph - 55 * mm, 40 * mm, fill=1, stroke=0)
    canvas.setFillColor(NAVY_MID)
    canvas.rect(0, 0, pw, 24 * mm, fill=1, stroke=0)
    canvas.setFillColor(EMERALD)
    canvas.rect(0, 0, pw, 3 * mm, fill=1, stroke=0)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(EMERALD_BRIGHT)
    canvas.drawCentredString(pw / 2, 10 * mm, "quantovale.online  \u00b7  Pitch Deck para Investidores")
    canvas.restoreState()


def _chapter_header(story, chapter_num, title, styles, accent_color=None):
    if accent_color is None:
        accent_color = EMERALD
    story.append(Spacer(1, 4 * mm))
    num_para = Paragraph(
        f'<font color="{accent_color.hexval()}" size="14">{chapter_num:02d}</font>'
        f'<font color="{GRAY_300.hexval()}" size="14">  |  </font>'
        f'<font color="{NAVY.hexval()}" size="20"><b>{title}</b></font>',
        ParagraphStyle("ChapterHead", fontName="Helvetica-Bold", fontSize=20,
                        textColor=NAVY, leading=26, spaceBefore=2, spaceAfter=4)
    )
    story.append(num_para)
    story.append(_SectionDivider(color=accent_color))


def _section_title(story, title, styles):
    story.append(Paragraph(title, styles["SectionTitle"]))
    story.append(Spacer(1, 2 * mm))


def _subsection(story, title, styles):
    story.append(Paragraph(title, styles["SubSection"]))


def _build_table(story, data, col_widths=None, accent_color=None):
    if col_widths is None:
        col_widths = [int(CONTENT_W * 0.52), int(CONTENT_W * 0.44)]
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


def _callout_box(story, title, bullets, accent=None, bg=None):
    """Renders a highlight box with a left accent bar, title and bullet points."""
    if accent is None:
        accent = EMERALD_DARK
    if bg is None:
        bg = HexColor("#ecfdf5")
    rows = []
    title_para = Paragraph(
        f'<font face="Helvetica-Bold">{title}</font>',
        ParagraphStyle("PdCalloutTitle", fontName="Helvetica-Bold", fontSize=9,
                       textColor=accent, leading=13, spaceAfter=4))
    rows.append([title_para])
    for bullet in bullets:
        bp = Paragraph(
            f'\u00b7\u2009{bullet}',
            ParagraphStyle("PdCalloutBullet", fontName="Helvetica", fontSize=9,
                           textColor=GRAY_700, leading=14, leftIndent=6, spaceAfter=2))
        rows.append([bp])
    table = Table(rows, colWidths=[CONTENT_W])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LINEAFTER", (0, 0), (0, -1), 3, accent),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#a7f3d0")),
    ]))
    story.append(table)
    story.append(Spacer(1, 4 * mm))


def _impact_slide(story, text, label, styles, accent_color=None):
    """Full-width dark panel with one large impact sentence."""
    if accent_color is None:
        accent_color = EMERALD
    panel = Table(
        [[Paragraph(label.upper(), styles["ImpactLabel"]),
          Paragraph(text, styles["ImpactTitle"])]],
        colWidths=[CONTENT_W]
    )
    # Actually use a single-cell layout
    panel = Table(
        [[Paragraph(
            f'<font size="8" color="{accent_color.hexval()}"><b>{label.upper()}</b></font>'
            f'<br/><br/>'
            f'<font size="24" color="{WHITE.hexval()}"><b>{text}</b></font>',
            ParagraphStyle("ImpactInner", fontName="Helvetica-Bold", fontSize=24,
                           textColor=WHITE, alignment=TA_CENTER, leading=30, spaceBefore=0, spaceAfter=0)
        )]],
        colWidths=[CONTENT_W]
    )
    panel.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("TOPPADDING", (0, 0), (-1, -1), 24),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 24),
        ("LEFTPADDING", (0, 0), (-1, -1), 20),
        ("RIGHTPADDING", (0, 0), (-1, -1), 20),
        ("LINEBELOW", (0, -1), (-1, -1), 3, accent_color),
    ]))
    story.append(KeepTogether([panel, Spacer(1, 6 * mm)]))


def _draw_revenue_chart(story, projections):
    if not projections:
        return
    W, H = CONTENT_W - 20, 200
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
    """Improved timeline with filled/outline status circles."""
    if not milestones:
        return
    for m in milestones[:12]:
        status = m.get("status", "upcoming")
        date_str = m.get("date", "")
        title = m.get("title", "")
        desc = m.get("description", "")

        # Draw circle + text side by side
        circle_d = Drawing(16, 16)
        if status == "completed":
            circle_d.add(Circle(8, 8, 7, fillColor=EMERALD, strokeColor=None))
            circle_d.add(String(4, 4, "\u2713", fontName="Helvetica-Bold", fontSize=10, fillColor=WHITE))
        elif status == "in_progress":
            circle_d.add(Circle(8, 8, 7, fillColor=AMBER, strokeColor=None))
            circle_d.add(Circle(8, 8, 3, fillColor=WHITE, strokeColor=None))
        else:  # upcoming
            circle_d.add(Circle(8, 8, 7, fillColor=None, strokeColor=GRAY_400, strokeWidth=1.5))

        date_part = f'<font color="{GRAY_500.hexval()}" size="8">{date_str}</font>  ' if date_str else ""
        text_para = Paragraph(
            f'{date_part}'
            f'<font color="{NAVY.hexval()}"><b>{title}</b></font>'
            f'{("  \u2014  " + desc) if desc else ""}',
            ParagraphStyle("MSText", fontName="Helvetica", fontSize=9.5,
                           textColor=GRAY_600, leading=15, spaceAfter=0))

        row = Table([[circle_d, text_para]], colWidths=[22, CONTENT_W - 30])
        row.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(row)
        story.append(Spacer(1, 1 * mm))


def _draw_funding_breakdown(story, funding):
    if not funding:
        return
    breakdown = funding.get("breakdown", [])
    if not breakdown:
        return
    total = sum(item.get("value", 0) for item in breakdown)
    if total <= 0:
        return

    W, H = 620, 200
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
# A — TAM/SAM/SOM CONCENTRIC CIRCLES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _draw_tam_sam_som(story, target, styles):
    """Render TAM/SAM/SOM as concentric circles with labels."""
    if not target:
        return
    tam = target.get("tam", "")
    sam = target.get("sam", "")
    som = target.get("som", "")
    if not (tam or sam or som):
        return

    W, H = CONTENT_W, 200
    cx, cy = W // 2, H // 2
    d = Drawing(W, H)

    # Background subtle grid dots
    for xi in range(6):
        for yi in range(4):
            d.add(Circle(cx - 230 + xi * 90, cy - 70 + yi * 50, 1.5,
                         fillColor=GRAY_200, strokeColor=None))

    # Concentric circles: TAM → SAM → SOM
    d.add(Circle(cx, cy, 90, fillColor=HexColor("#dbeafe"), strokeColor=HexColor("#93c5fd"), strokeWidth=1))
    d.add(Circle(cx, cy, 62, fillColor=HexColor("#d1fae5"), strokeColor=EMERALD, strokeWidth=1.2))
    d.add(Circle(cx, cy, 36, fillColor=EMERALD, strokeColor=EMERALD_DARK, strokeWidth=1.5))

    # SOM value in center
    d.add(String(cx, cy + 4, "SOM", fontName="Helvetica-Bold", fontSize=7,
                 fillColor=WHITE, textAnchor="middle"))
    if som:
        d.add(String(cx, cy - 8, str(som)[:16], fontName="Helvetica-Bold", fontSize=6.5,
                     fillColor=WHITE, textAnchor="middle"))

    # SAM ring label (right side)
    d.add(String(cx + 70, cy + 4, "SAM", fontName="Helvetica-Bold", fontSize=7.5,
                 fillColor=EMERALD_DARK, textAnchor="start"))
    if sam:
        d.add(String(cx + 70, cy - 8, str(sam)[:18], fontName="Helvetica", fontSize=6.5,
                     fillColor=GRAY_600, textAnchor="start"))

    # TAM outer label
    d.add(String(cx + 96, cy + 4, "TAM", fontName="Helvetica-Bold", fontSize=7.5,
                 fillColor=HexColor("#1d4ed8"), textAnchor="start"))
    if tam:
        d.add(String(cx + 96, cy - 8, str(tam)[:20], fontName="Helvetica", fontSize=6.5,
                     fillColor=GRAY_500, textAnchor="start"))

    # Legend bottom
    d.add(Circle(30, 12, 6, fillColor=HexColor("#dbeafe"), strokeColor=HexColor("#93c5fd"), strokeWidth=1))
    d.add(String(40, 8, "TAM — Mercado Total Endereçável", fontName="Helvetica", fontSize=7, fillColor=GRAY_600))
    d.add(Circle(240, 12, 6, fillColor=HexColor("#d1fae5"), strokeColor=EMERALD, strokeWidth=1))
    d.add(String(250, 8, "SAM — Mercado Endereçável", fontName="Helvetica", fontSize=7, fillColor=GRAY_600))
    d.add(Circle(430, 12, 6, fillColor=EMERALD, strokeColor=None))
    d.add(String(440, 8, "SOM — Alvo Real", fontName="Helvetica", fontSize=7, fillColor=GRAY_600))

    story.append(d)
    story.append(Spacer(1, 4 * mm))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# B — COMPETITIVE MATRIX 2×2
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _draw_competitive_matrix(story, company_name, competitors, styles):
    """2×2 positioning quadrant: Price (x) vs. Value (y)."""
    if not competitors:
        return

    W, H = min(CONTENT_W, 520), 220
    ml, mb = 40, 30
    cw, ch = W - ml - 20, H - mb - 20
    d = Drawing(W, H)

    # Axes background quadrants
    half_x, half_y = ml + cw // 2, mb + ch // 2
    d.add(Rect(ml, mb, cw // 2, ch // 2, fillColor=HexColor("#fef9c3"), strokeColor=None))  # low price low val
    d.add(Rect(ml + cw // 2, mb, cw - cw // 2, ch // 2, fillColor=HexColor("#fce7f3"), strokeColor=None))  # high price low val
    d.add(Rect(ml, mb + ch // 2, cw // 2, ch - ch // 2, fillColor=HexColor("#f0fdf4"), strokeColor=None))  # low price high val
    d.add(Rect(ml + cw // 2, mb + ch // 2, cw - cw // 2, ch - ch // 2,
               fillColor=HexColor("#ecfdf5"), strokeColor=None))  # high price high val — ideal

    # Grid lines
    d.add(Line(ml, half_y, ml + cw, half_y, strokeColor=GRAY_300, strokeWidth=0.8))
    d.add(Line(half_x, mb, half_x, mb + ch, strokeColor=GRAY_300, strokeWidth=0.8))

    # Axes
    d.add(Line(ml, mb, ml + cw, mb, strokeColor=GRAY_400, strokeWidth=1.2))
    d.add(Line(ml, mb, ml, mb + ch, strokeColor=GRAY_400, strokeWidth=1.2))

    # Axis labels
    d.add(String(ml + cw // 2 - 20, 6, "← Preço →", fontName="Helvetica", fontSize=7, fillColor=GRAY_500))
    d.add(String(4, mb + ch // 2 - 8, "Valor", fontName="Helvetica", fontSize=7, fillColor=GRAY_500))
    d.add(String(ml + cw + 2, mb + ch // 2, "↑", fontName="Helvetica", fontSize=8, fillColor=GRAY_500))

    # Quadrant labels
    d.add(String(ml + 5, mb + ch - 14, "Alto Valor\nBaixo Preço", fontName="Helvetica", fontSize=6, fillColor=GRAY_500))
    d.add(String(ml + cw // 2 + 5, mb + ch - 14, "Alto Valor\nAlto Preço ✓", fontName="Helvetica", fontSize=6, fillColor=EMERALD_DARK))
    d.add(String(ml + 5, mb + 4, "Baixo Valor\nBaixo Preço", fontName="Helvetica", fontSize=6, fillColor=GRAY_400))
    d.add(String(ml + cw // 2 + 5, mb + 4, "Baixo Valor\nAlto Preço", fontName="Helvetica", fontSize=6, fillColor=GRAY_400))

    # Plot competitors (spread them out)
    positions = [
        (0.22, 0.32), (0.55, 0.28), (0.72, 0.58), (0.35, 0.65),
        (0.15, 0.55), (0.80, 0.42), (0.60, 0.72), (0.45, 0.45),
    ]
    colors = [GRAY_400, GRAY_500, AMBER, HexColor("#8b5cf6"),
              HexColor("#3b82f6"), GRAY_400, AMBER, GRAY_500]

    for i, comp in enumerate(competitors[:8]):
        name = comp.get("competitor", f"Comp.{i+1}")[:18]
        px = ml + positions[i % len(positions)][0] * cw
        py = mb + positions[i % len(positions)][1] * ch
        c = colors[i % len(colors)]
        d.add(Circle(px, py, 5, fillColor=c, strokeColor=WHITE, strokeWidth=1))
        d.add(String(px + 7, py - 3, name, fontName="Helvetica", fontSize=6, fillColor=GRAY_600))

    # Plot main company — top right (high value, moderate-high price)
    mx_pos = ml + 0.70 * cw
    my_pos = mb + 0.82 * ch
    d.add(Circle(mx_pos, my_pos, 7, fillColor=EMERALD, strokeColor=WHITE, strokeWidth=1.5))
    d.add(String(mx_pos - 3, my_pos - 3, "★", fontName="Helvetica-Bold", fontSize=8, fillColor=WHITE))
    short_name = (company_name or "Você")[:14]
    d.add(String(mx_pos + 10, my_pos, short_name, fontName="Helvetica-Bold", fontSize=7, fillColor=EMERALD_DARK))

    story.append(d)
    story.append(Spacer(1, 4 * mm))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# C — REVENUE WATERFALL CHART
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _draw_revenue_waterfall(story, projections):
    """Waterfall/cascade bar chart showing year-over-year revenue growth."""
    if not projections or len(projections) < 2:
        return

    W, H = CONTENT_W - 20, 180
    d = Drawing(W, H + 40)
    d.add(String(0, H + 26, "Crescimento de Receita — Cascata",
                 fontName="Helvetica-Bold", fontSize=9, fillColor=NAVY))

    n = min(len(projections), 8)
    ml, mb = 60, 30
    cw, ch = W - ml - 20, H - mb - 10

    all_revs = [p.get("revenue", 0) for p in projections[:n]]
    mx = max(all_revs) if all_revs else 1
    if mx == 0:
        mx = 1

    bar_w = (cw / n) * 0.6
    gap = cw / n

    # Y grid lines
    for i in range(5):
        y = mb + (ch * i / 4)
        d.add(Line(ml, y, W - 20, y, strokeColor=GRAY_100, strokeWidth=0.5))
        d.add(String(2, y - 3, _format_brl(mx * i / 4),
                     fontName="Helvetica", fontSize=5, fillColor=GRAY_500))
    d.add(Line(ml, mb, W - 20, mb, strokeColor=GRAY_300, strokeWidth=1))

    prev_rev = 0
    for i, p in enumerate(projections[:n]):
        rev = p.get("revenue", 0)
        xc = ml + gap * i + gap / 2
        bar_h = max((rev / mx) * ch, 2)
        bar_x = xc - bar_w / 2

        if i == 0:
            # Base bar — solid emerald
            d.add(Rect(bar_x, mb, bar_w, bar_h, fillColor=EMERALD, strokeColor=None))
        else:
            delta = rev - prev_rev
            prev_h = max((prev_rev / mx) * ch, 2)
            # Base (continuation) — lighter
            d.add(Rect(bar_x, mb, bar_w, prev_h, fillColor=HexColor("#d1fae5"), strokeColor=None))
            # Delta (growth portion) — emerald or red
            delta_h = max((abs(delta) / mx) * ch, 2)
            d.add(Rect(bar_x, mb + prev_h, bar_w, delta_h,
                       fillColor=EMERALD if delta >= 0 else RED, strokeColor=None))
            # Delta arrow label
            delta_label = f"+{_format_brl(delta)}" if delta >= 0 else _format_brl(delta)
            d.add(String(xc, mb + bar_h + 3, delta_label,
                         fontName="Helvetica-Bold", fontSize=5.5,
                         fillColor=EMERALD if delta >= 0 else RED, textAnchor="middle"))

        # Revenue value on top
        d.add(String(xc, mb + bar_h + (12 if i > 0 else 3), _format_brl(rev),
                     fontName="Helvetica-Bold", fontSize=6,
                     fillColor=NAVY, textAnchor="middle"))
        d.add(String(xc, mb - 12, str(p.get("year", i + 1)),
                     fontName="Helvetica", fontSize=7,
                     fillColor=GRAY_600, textAnchor="middle"))

        prev_rev = rev

    # Legend
    d.add(Rect(ml, H + 12, 8, 8, fillColor=EMERALD, strokeColor=None))
    d.add(String(ml + 11, H + 12, "Receita Base", fontName="Helvetica", fontSize=7, fillColor=GRAY_600))
    d.add(Rect(ml + 85, H + 12, 8, 8, fillColor=HexColor("#d1fae5"), strokeColor=None))
    d.add(String(ml + 96, H + 12, "Crescimento YoY", fontName="Helvetica", fontSize=7, fillColor=GRAY_600))

    story.append(d)
    story.append(Spacer(1, 4 * mm))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# D — CHAPTER DIVIDER SLIDE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _chapter_divider(story, chapter_num, title, styles, accent_color=None, subtitle=None):
    """Full-width NAVY divider slide — visual break between chapters."""
    if accent_color is None:
        accent_color = EMERALD

    num_str = f"{chapter_num:02d}"
    inner = Paragraph(
        f'<font size="11" color="{accent_color.hexval()}"><b>{num_str}</b></font>'
        f'<font size="11" color="{GRAY_500.hexval()}">  ——  </font><br/><br/>'
        f'<font size="28" color="{WHITE.hexval()}"><b>{title}</b></font>'
        + (f'<br/><font size="11" color="{GRAY_500.hexval()}">{subtitle}</font>' if subtitle else ""),
        ParagraphStyle("ChDiv", fontName="Helvetica-Bold", fontSize=28,
                       textColor=WHITE, alignment=TA_LEFT, leading=36,
                       spaceBefore=0, spaceAfter=0)
    )
    t = Table([[inner]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("TOPPADDING", (0, 0), (-1, -1), 28),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 28),
        ("LEFTPADDING", (0, 0), (-1, -1), 28),
        ("RIGHTPADDING", (0, 0), (-1, -1), 28),
        ("LINEBEFORE", (0, 0), (0, -1), 6, accent_color),
    ]))
    story.append(t)
    story.append(Spacer(1, 8 * mm))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# F — 3-SCENARIO TABLE (Conservador / Base / Otimista)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _draw_scenarios(story, projections, styles):
    """3-scenario financial table with colored columns."""
    if not projections:
        return

    # Build Conservative (-25%), Base (as-is), Optimistic (+35%)
    FACTORS = [("Conservador ↓", 0.75, HexColor("#fef2f2"), RED),
               ("Base",           1.00, HexColor("#f0fdf4"), EMERALD_DARK),
               ("Otimista ↑",     1.35, HexColor("#ecfdf5"), EMERALD)]

    # Use last projected year for the snapshot
    last = projections[-1]
    rev_base = last.get("revenue", 0)
    exp_base = last.get("expenses", 0)
    profit_base = last.get("profit", 0)

    cw1 = int(CONTENT_W * 0.22)
    cw2 = int((CONTENT_W - cw1) / 3)

    # Header row
    header = ["", "Conservador", "Base", "Otimista"]
    rows = [header]
    for label, rev_val, exp_val, profit_val in [
        ("Receita",  _format_brl(rev_base * 0.75), _format_brl(rev_base), _format_brl(rev_base * 1.35)),
        ("Despesas", _format_brl(exp_base * 1.10), _format_brl(exp_base), _format_brl(exp_base * 0.90)),
        ("Lucro",    _format_brl(profit_base * 0.50), _format_brl(profit_base), _format_brl(profit_base * 1.55)),
    ]:
        rows.append([label, rev_val, exp_val, profit_val])

    t = Table(rows, colWidths=[cw1, cw2, cw2, cw2])
    t.setStyle(TableStyle([
        # Header
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, 0), 8.5),
        ("TEXTCOLOR",  (0, 0), (0, 0), GRAY_500),
        ("BACKGROUND", (1, 0), (1, -1), HexColor("#fff1f2")),
        ("BACKGROUND", (2, 0), (2, -1), HexColor("#f0fdf4")),
        ("BACKGROUND", (3, 0), (3, -1), HexColor("#ecfdf5")),
        ("TEXTCOLOR",  (1, 0), (1, 0), RED),
        ("TEXTCOLOR",  (2, 0), (2, 0), EMERALD_DARK),
        ("TEXTCOLOR",  (3, 0), (3, 0), EMERALD),
        # Body
        ("FONTNAME",   (0, 1), (0, -1), "Helvetica"),
        ("FONTNAME",   (1, 1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 1), (-1, -1), 9),
        ("TEXTCOLOR",  (0, 1), (0, -1), GRAY_600),
        ("TEXTCOLOR",  (1, 1), (1, -1), RED),
        ("TEXTCOLOR",  (2, 1), (2, -1), EMERALD_DARK),
        ("TEXTCOLOR",  (3, 1), (3, -1), EMERALD),
        ("ALIGN",      (1, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (0, -1), 12),
        ("LINEBELOW",  (0, 0), (-1, 0), 1.5, GRAY_200),
        ("LINEBELOW",  (0, 1), (-1, -2), 0.5, GRAY_100),
        ("BOX",        (0, 0), (-1, -1), 0.5, GRAY_200),
        ("GRID",       (1, 0), (-1, -1), 0.5, GRAY_200),
        ("ROWBACKGROUNDS", (0, 1), (0, -1), [WHITE, GRAY_50]),
    ]))
    year_label = f"Ano {last.get('year', 'Final')} — 3 Cenários"
    story.append(Paragraph(year_label,
        ParagraphStyle("ScenarioLabel", fontName="Helvetica-Bold", fontSize=8.5,
                       textColor=GRAY_500, spaceAfter=4)))
    story.append(t)
    story.append(Spacer(1, 6 * mm))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# G — KPI TRACTION PANEL
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _draw_kpi_panel(story, kpis):
    """Horizontal row of KPI metric cards — rendered inline in Exec Summary."""
    if not kpis:
        return

    # kpis: list of {label, value, unit?, change?, up?}
    max_kpis = min(len(kpis), 5)
    kpis = kpis[:max_kpis]
    cw = int(CONTENT_W / max_kpis)

    cells = []
    for kpi in kpis:
        label = kpi.get("label", "")
        value = kpi.get("value", "—")
        unit = kpi.get("unit", "")
        change = kpi.get("change", "")
        up = kpi.get("up", None)

        val_text = f'<font size="18" color="{EMERALD_DARK.hexval()}"><b>{value}</b></font>'
        if unit:
            val_text += f'<font size="9" color="{GRAY_500.hexval()}"> {unit}</font>'
        change_text = ""
        if change:
            arrow = "↑ " if up else ("↓ " if up is False else "")
            color = EMERALD.hexval() if up else (RED.hexval() if up is False else GRAY_500.hexval())
            change_text = f'<br/><font size="8" color="{color}">{arrow}{change}</font>'

        cell_para = Paragraph(
            f'{val_text}{change_text}<br/>'
            f'<font size="7.5" color="{GRAY_500.hexval()}">{label}</font>',
            ParagraphStyle("KPICell", fontName="Helvetica-Bold", fontSize=18,
                           textColor=EMERALD_DARK, alignment=TA_CENTER, leading=22,
                           spaceBefore=0, spaceAfter=0)
        )
        cells.append(cell_para)

    t = Table([cells], colWidths=[cw] * max_kpis)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_50),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY_200),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LINEABOVE", (0, 0), (-1, 0), 2.5, EMERALD),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t)
    story.append(Spacer(1, 6 * mm))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# H — FOOTER FACTORY (company name + chapter tracking)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _make_footer(company_name=""):
    """Return a footer callback that includes the company name."""
    def _footer_fn(canvas, doc):
        canvas.saveState()
        pw, ph = doc.pagesize
        canvas.setStrokeColor(EMERALD)
        canvas.setLineWidth(0.8)
        canvas.line(2.5 * cm, 18 * mm, pw - 2.5 * cm, 18 * mm)
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(GRAY_400)
        left_text = f"{company_name}  ·  Pitch Deck  ·  quantovale.online" if company_name else "Pitch Deck · quantovale.online"
        canvas.drawString(2.5 * cm, 12 * mm, left_text)
        canvas.drawRightString(pw - 2.5 * cm, 12 * mm, f"Página {doc.page}")
        canvas.setFillColor(EMERALD)
        canvas.circle(pw / 2, 12 * mm + 1, 1.5, fill=1, stroke=0)
        canvas.restoreState()
    return _footer_fn


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
        filepath, pagesize=PAGE_SIZE,
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
    _chapter_divider(story, ch_num, "Resumo Executivo", styles, subtitle="Visão geral · Valuation · Destaques")

    if headline_text:
        story.append(Spacer(1, 4 * mm))
        qt = Table(
            [[Paragraph(
                f'<i>"{headline_text}"</i>',
                ParagraphStyle("QI", fontName="Helvetica-BoldOblique", fontSize=13,
                               textColor=EMERALD_DARK, leading=19, alignment=TA_LEFT)
            )]],
            colWidths=[int(CONTENT_W * 0.85)]
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

    # G — KPI Traction Panel
    if analysis_data:
        _kpis = []
        if analysis_data.get("revenue"):
            _kpis.append({"label": "Receita Anual", "value": _format_brl(analysis_data["revenue"])})
        if analysis_data.get("net_margin") is not None:
            up_m = analysis_data["net_margin"] > 0.10
            _kpis.append({"label": "Margem Líquida", "value": f"{analysis_data['net_margin']*100:.1f}%", "up": up_m})
        if analysis_data.get("growth_rate"):
            _kpis.append({"label": "Crescimento", "value": f"{analysis_data['growth_rate']*100:.0f}% a.a.", "up": True})
        if analysis_data.get("risk_score"):
            _kpis.append({"label": "Score de Risco", "value": f"{analysis_data['risk_score']:.0f}/100"})
        if analysis_data.get("equity_value"):
            _kpis.append({"label": "Valuation DCF", "value": _format_brl(analysis_data["equity_value"])})
        if _kpis:
            _draw_kpi_panel(story, _kpis)

    if analysis_data and analysis_data.get("equity_value"):
        story.append(Paragraph(_format_brl(analysis_data["equity_value"]), styles["ValueHero"]))
        story.append(Paragraph("Valuation Estimado (DCF)", styles["ValueLabel"]))
        story.append(Spacer(1, 4 * mm))
        # Key callout: funding ask + valuation context
        pitch_insights = [f"Empresa do setor de {deck.sector.capitalize()}" if deck.sector else "Empresa em fase de crescimento"]
        if funding and funding.get("amount"):
            pitch_insights.append(f"Capital buscado: {_format_brl(funding['amount'])} para expans\u00e3o")
        if analysis_data.get("risk_score"):
            pitch_insights.append(f"Score de risco: {analysis_data['risk_score']:.0f}/100 \u00b7 Maturidade: {analysis_data.get('maturity_index', 0):.0f}/100")
        _callout_box(story, "DESTAQUES DA OPORTUNIDADE", pitch_insights)

    story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # CH 2 — A OPORTUNIDADE
    # ═══════════════════════════════════════════════════
    has_opp = problem_text or solution_text or target or competitors
    if has_opp:
        ch_num += 1
        _chapter_divider(story, ch_num, "A Oportunidade", styles, accent_color=EMERALD, subtitle="Problema · Solução · Mercado · Concorrência")

        if problem_text:
            _impact_slide(story, problem_text[:180] + ("…" if len(problem_text) > 180 else ""),
                          "O PROBLEMA", styles, accent_color=EMERALD)
            _section_title(story, "O Problema", styles)
            story.append(Paragraph(problem_text, styles["Body"]))
            story.append(Spacer(1, 6 * mm))

        if solution_text:
            _impact_slide(story, solution_text[:180] + ("…" if len(solution_text) > 180 else ""),
                          "NOSSA SOLUÇÃO", styles, accent_color=TEAL)
            _section_title(story, "Nossa Solu\u00e7\u00e3o", styles)
            story.append(Paragraph(solution_text, styles["Body"]))
            story.append(Spacer(1, 6 * mm))

        if target:
            _section_title(story, "Mercado-Alvo", styles)
            if target.get("description"):
                story.append(Paragraph(target["description"], styles["Body"]))
                story.append(Spacer(1, 3 * mm))

            _draw_tam_sam_som(story, target, styles)
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
            _draw_competitive_matrix(story, deck.company_name, competitors, styles)
            story.append(Spacer(1, 6 * mm))

        story.append(PageBreak())

    # ═══════════════════════════════════════════════════
    # CH 3 — EXECUÇÃO
    # ═══════════════════════════════════════════════════
    has_exec = bm_text or sales_text or marketing_text or milestones
    if has_exec:
        ch_num += 1
        _chapter_divider(story, ch_num, "Execução", styles, accent_color=TEAL, subtitle="Modelo · Vendas · Marketing · Roadmap")

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
        _chapter_divider(story, ch_num, "A Empresa", styles, accent_color=NAVY_LIGHT, subtitle="Equipe · Parceiros")

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
        else:
            team_placeholder = Table([[Paragraph(
                "<b>⊕  Adicione os membros da equipe</b><br/>"
                "<font size='9' color='#6b7280'>Inclua nome, cargo, bio e LinkedIn de cada co-fundador e executivo. "
                "Investidores valorizam muito a qualidade da equipe.</font>",
                ParagraphStyle("TeamPH", fontName="Helvetica", fontSize=10,
                               textColor=GRAY_700, leading=16)
            )]], colWidths=[CONTENT_W])
            team_placeholder.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), GRAY_50),
                ("BOX", (0, 0), (-1, -1), 1.5, EMERALD_DARK),
                ("TOPPADDING", (0, 0), (-1, -1), 18),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 18),
                ("LEFTPADDING", (0, 0), (-1, -1), 16),
                ("RIGHTPADDING", (0, 0), (-1, -1), 16),
            ]))
            story.append(team_placeholder)
            story.append(Spacer(1, 8 * mm))

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
        _chapter_divider(story, ch_num, "Plano Financeiro", styles, accent_color=EMERALD, subtitle="Projeções · Cenários · Capital")

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
            story.append(Spacer(1, 6 * mm))
            _draw_revenue_waterfall(story, projections)
            _draw_scenarios(story, projections, styles)
            story.append(Spacer(1, 6 * mm))
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
    # ASK / O QUE BUSCAMOS
    # ═══════════════════════════════════════════════════
    if funding and funding.get("amount"):
        ch_num += 1
        _chapter_header(story, ch_num, "O Que Buscamos", styles, accent_color=EMERALD_DARK)
        story.append(Paragraph(_format_brl(funding["amount"]), styles["ValueHero"]))
        story.append(Paragraph("Capital buscado nesta rodada", styles["ValueLabel"]))
        story.append(Spacer(1, 4 * mm))
        if funding.get("equity_offered"):
            story.append(Paragraph(
                f'{funding["equity_offered"]}% de equity oferecido',
                styles["ValueLabel"]))
            story.append(Spacer(1, 3 * mm))
        ask_bullets = ["Entre em contato para agendar uma reunião de apresentação"]
        if deck.contact_email:
            ask_bullets.append(f"E-mail de contato: {deck.contact_email}")
        if deck.contact_phone:
            ask_bullets.append(f"Telefone: {deck.contact_phone}")
        _callout_box(story, "PRÓXIMOS PASSOS", ask_bullets, accent=EMERALD_DARK)
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

    doc.build(story, onFirstPage=_cover_page, onLaterPages=_make_footer(deck.company_name))
    return filepath
