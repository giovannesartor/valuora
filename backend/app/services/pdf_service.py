"""
Valuora \u2014 PDF Report Generator v4
Premium report, executive design, emerald/navy theme.
"""
import os
import uuid
import logging
import math
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, HRFlowable, KeepTogether, Frame, PageTemplate,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Circle, Polygon, Wedge
from reportlab.graphics import renderPDF

from app.core.config import settings

# Premium Color Palette
NAVY = HexColor("#0f172a")
NAVY_MID = HexColor("#1e293b")
NAVY_LIGHT = HexColor("#334155")
EMERALD = HexColor("#10b981")        # emerald-500 — brand light green
EMERALD_DARK = HexColor("#059669")    # emerald-600
EMERALD_BRIGHT = HexColor("#34d399")  # emerald-400 — highlights/charts
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
    styles.add(ParagraphStyle("CoverTarget", fontName="Helvetica", fontSize=9,
        textColor=HexColor("#64748b"), alignment=TA_LEFT, leading=14, spaceAfter=3))
    styles.add(ParagraphStyle("SectionTitle", fontName="Helvetica-Bold", fontSize=16,
        textColor=EMERALD_DARK, spaceBefore=4, spaceAfter=4, leading=20))
    styles.add(ParagraphStyle("SubSection", fontName="Helvetica-Bold", fontSize=12,
        textColor=EMERALD_DARK, spaceBefore=14, spaceAfter=6, leading=16))
    styles.add(ParagraphStyle("Body", fontName="Helvetica", fontSize=9.5,
        textColor=GRAY_700, alignment=TA_JUSTIFY, leading=16, spaceAfter=6))
    styles.add(ParagraphStyle("BodySmall", fontName="Helvetica", fontSize=8.5,
        textColor=GRAY_600, alignment=TA_JUSTIFY, leading=14, spaceAfter=5))
    styles.add(ParagraphStyle("ValueHero", fontName="Helvetica-Bold", fontSize=30,
        textColor=EMERALD, alignment=TA_CENTER, spaceBefore=10, spaceAfter=8, leading=36))
    styles.add(ParagraphStyle("ValueLabel", fontName="Helvetica", fontSize=9,
        textColor=GRAY_500, alignment=TA_CENTER, spaceBefore=2, spaceAfter=14))
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
    """Format value as USD currency (kept function name for backward compat)."""
    if value is None:
        return "\u2014"
    if abs(value) >= 1_000_000:
        return f"$ {value/1_000_000:,.2f}M"
    elif abs(value) >= 1_000:
        return f"$ {value/1_000:,.1f}K"
    return f"$ {value:,.2f}"


def format_pct(value):
    if value is None:
        return "\u2014"
    return f"{value*100:.1f}%"


def _premium_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    # Gradient-like double line footer
    canvas.setStrokeColor(EMERALD)
    canvas.setLineWidth(2)
    canvas.line(2.5 * cm, 21 * mm, w - 2.5 * cm, 21 * mm)
    canvas.setStrokeColor(EMERALD_LIGHT)
    canvas.setLineWidth(0.5)
    canvas.line(2.5 * cm, 20 * mm, w - 2.5 * cm, 20 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(GRAY_400)
    canvas.drawString(2.5 * cm, 14 * mm, "Valuora  \u00b7  valuora.online")
    canvas.drawRightString(w - 2.5 * cm, 14 * mm, f"Page {doc.page}")
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
    canvas.setFillColor(NAVY_MID)
    canvas.rect(0, 0, w, 28 * mm, fill=1, stroke=0)
    canvas.setFillColor(EMERALD)
    canvas.rect(0, 0, w, 3 * mm, fill=1, stroke=0)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(EMERALD_BRIGHT)
    canvas.drawCentredString(w / 2, 12 * mm, "valuora.online  \u00b7  Intelligent Business Valuation")
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


def _callout_box(story, title, bullets, accent=None, bg=None):
    """Renders a rounded highlight box with a title and bullet list."""
    if accent is None:
        accent = EMERALD_DARK
    if bg is None:
        bg = EMERALD_PALE
    rows = []
    title_para = Paragraph(
        f'<font face="Helvetica-Bold" color="{accent.hexval()}">{title}</font>',
        ParagraphStyle("CalloutTitle", fontName="Helvetica-Bold", fontSize=9,
                       textColor=accent, leading=13, spaceAfter=4))
    rows.append([title_para])
    for bullet in bullets:
        bullet_para = Paragraph(
            f'· {bullet}',
            ParagraphStyle("CalloutBullet", fontName="Helvetica", fontSize=9,
                           textColor=GRAY_700, leading=14, leftIndent=6, spaceAfter=2))
        rows.append([bullet_para])
    table = Table(rows, colWidths=[450])
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


# ─── PDF CHART HELPERS ─────────────────────────────────────

def _draw_bar_chart(story, projections, title="Revenue and FCFE Projection"):
    """Draw a dual bar chart (revenue + FCF) using ReportLab Drawing primitives."""
    if not projections:
        return
    W, H = 450, 200
    d = Drawing(W, H + 30)

    # Title
    d.add(String(0, H + 15, title, fontName="Helvetica-Bold", fontSize=9, fillColor=NAVY))

    n = len(projections)
    margin_l, margin_r, margin_b = 65, 20, 30
    chart_w = W - margin_l - margin_r
    chart_h = H - margin_b - 10

    # Calculate max value for scale
    all_vals = [p.get("revenue", 0) for p in projections] + [abs(p.get("fcf", 0)) for p in projections]
    max_val = max(all_vals) if all_vals else 1
    if max_val == 0:
        max_val = 1

    bar_group_w = chart_w / n
    bar_w = bar_group_w * 0.3

    # Y-axis gridlines and labels
    for i in range(5):
        y = margin_b + (chart_h * i / 4)
        d.add(Line(margin_l, y, W - margin_r, y, strokeColor=GRAY_200, strokeWidth=0.5))
        label_val = max_val * i / 4
        if label_val >= 1_000_000:
            label = f"${label_val/1_000_000:.1f}M"
        elif label_val >= 1_000:
            label = f"${label_val/1_000:.0f}K"
        else:
            label = f"${label_val:.0f}"
        d.add(String(2, y - 3, label, fontName="Helvetica", fontSize=6, fillColor=GRAY_500))

    # Baseline
    d.add(Line(margin_l, margin_b, W - margin_r, margin_b, strokeColor=GRAY_300, strokeWidth=1))

    for i, p in enumerate(projections):
        rev = p.get("revenue", 0)
        fcf = p.get("fcf", 0)
        x_center = margin_l + bar_group_w * i + bar_group_w / 2

        # Revenue bar (emerald)
        rev_h = (rev / max_val) * chart_h if max_val > 0 else 0
        d.add(Rect(x_center - bar_w - 1, margin_b, bar_w, max(rev_h, 0.5),
                    fillColor=EMERALD, strokeColor=None, strokeWidth=0))

        # FCF bar (teal if positive, red if negative)
        fcf_h = (abs(fcf) / max_val) * chart_h if max_val > 0 else 0
        fcf_color = TEAL if fcf >= 0 else RED
        d.add(Rect(x_center + 1, margin_b, bar_w, max(fcf_h, 0.5),
                    fillColor=fcf_color, strokeColor=None, strokeWidth=0))

        # X label
        d.add(String(x_center - 10, margin_b - 12, f"Year {p.get('year', i+1)}",
                      fontName="Helvetica", fontSize=6.5, fillColor=GRAY_600))

    # Legend
    lx = margin_l
    d.add(Rect(lx, H + 5, 8, 8, fillColor=EMERALD, strokeColor=None, strokeWidth=0))
    d.add(String(lx + 11, H + 5, "Revenue", fontName="Helvetica", fontSize=7, fillColor=GRAY_600))
    d.add(Rect(lx + 55, H + 5, 8, 8, fillColor=TEAL, strokeColor=None, strokeWidth=0))
    d.add(String(lx + 66, H + 5, "FCFE", fontName="Helvetica", fontSize=7, fillColor=GRAY_600))

    story.append(d)
    story.append(Spacer(1, 4 * mm))


def _draw_waterfall_chart(story, waterfall):
    """Draw a horizontal waterfall chart for equity composition."""
    if not waterfall:
        return
    W, H = 450, max(len(waterfall) * 28 + 40, 120)
    d = Drawing(W, H + 15)

    d.add(String(0, H + 2, "Equity Value Composition", fontName="Helvetica-Bold", fontSize=9, fillColor=NAVY))

    margin_l, margin_r = 130, 30
    chart_w = W - margin_l - margin_r
    bar_h = 16
    spacing = 24

    # Find max absolute value for scale
    abs_vals = [abs(item.get("value", 0)) for item in waterfall]
    max_abs = max(abs_vals) if abs_vals else 1
    if max_abs == 0:
        max_abs = 1

    for i, item in enumerate(waterfall):
        y = H - 15 - (i * spacing) - bar_h
        value = item.get("value", 0)
        label = item.get("label", "")
        item_type = item.get("type", "positive")

        # Label
        d.add(String(2, y + 4, label[:18], fontName="Helvetica", fontSize=7.5, fillColor=GRAY_700))

        # Bar
        bar_len = (abs(value) / max_abs) * chart_w
        if item_type == "total":
            color = HexColor("#8b5cf6")  # purple
        elif item_type == "subtotal":
            color = EMERALD_DARK
        elif value >= 0:
            color = EMERALD
        else:
            color = RED

        d.add(Rect(margin_l, y, max(bar_len, 2), bar_h,
                    fillColor=color, strokeColor=None, strokeWidth=0))

        # Value label on bar
        val_text = format_brl(value)
        d.add(String(margin_l + bar_len + 5, y + 4, val_text,
                      fontName="Helvetica-Bold", fontSize=7, fillColor=GRAY_600))

    story.append(d)
    story.append(Spacer(1, 4 * mm))


def _draw_radar_chart(story, dimensions, dim_labels):
    """Draw a radar/spider chart for qualitative dimensions."""
    if not dimensions:
        return
    W, H = 250, 220
    d = Drawing(W, H + 15)

    d.add(String(0, H + 2, "Qualitative Assessment — Radar", fontName="Helvetica-Bold", fontSize=9, fillColor=NAVY))

    cx, cy = W / 2, (H - 10) / 2 + 5
    radius = 80
    items = list(dimensions.items())
    n = len(items)
    if n < 3:
        return

    # Draw concentric pentagons/polygons (grid)
    for ring in range(1, 6):
        r = radius * ring / 5
        points = []
        for j in range(n):
            angle = math.pi / 2 + (2 * math.pi * j / n)
            px = cx + r * math.cos(angle)
            py = cy + r * math.sin(angle)
            points.append((px, py))
        for j in range(n):
            nx = (j + 1) % n
            d.add(Line(points[j][0], points[j][1], points[nx][0], points[nx][1],
                        strokeColor=GRAY_200, strokeWidth=0.5))

    # Axis lines
    for j in range(n):
        angle = math.pi / 2 + (2 * math.pi * j / n)
        ex = cx + radius * math.cos(angle)
        ey = cy + radius * math.sin(angle)
        d.add(Line(cx, cy, ex, ey, strokeColor=GRAY_200, strokeWidth=0.5))

    # Data polygon
    data_points = []
    for j, (key, val) in enumerate(items):
        angle = math.pi / 2 + (2 * math.pi * j / n)
        r = radius * (val / 5)
        px = cx + r * math.cos(angle)
        py = cy + r * math.sin(angle)
        data_points.append((px, py))

    # Fill polygon with semi-transparent emerald
    from reportlab.graphics.shapes import Polygon
    poly_coords = []
    for pt in data_points:
        poly_coords.extend([pt[0], pt[1]])
    poly = Polygon(poly_coords, fillColor=Color(5/255, 150/255, 105/255, 0.2),
                   strokeColor=EMERALD, strokeWidth=1.5)
    d.add(poly)

    # Data points (dots)
    for pt in data_points:
        d.add(Circle(pt[0], pt[1], 3, fillColor=EMERALD, strokeColor=WHITE, strokeWidth=1))

    # Labels
    for j, (key, val) in enumerate(items):
        angle = math.pi / 2 + (2 * math.pi * j / n)
        lbl_r = radius + 18
        lx = cx + lbl_r * math.cos(angle)
        ly = cy + lbl_r * math.sin(angle)
        label_text = dim_labels.get(key, key.capitalize())
        d.add(String(lx - len(label_text) * 2.2, ly - 3, f"{label_text} ({val:.0f})",
                      fontName="Helvetica", fontSize=6.5, fillColor=GRAY_600))

    story.append(d)
    story.append(Spacer(1, 4 * mm))


def _draw_scenario_bar(story, val_range, equity):
    """Draw a visual range bar showing conservative / base / optimistic."""
    if not val_range:
        return
    W, H = 450, 60
    d = Drawing(W, H)

    low = val_range.get("low", 0)
    mid = val_range.get("mid", 0)
    high = val_range.get("high", 0)
    if high <= 0:
        return

    margin = 40
    bar_w = W - margin * 2
    bar_y = 25
    bar_h = 14

    # Background bar
    d.add(Rect(margin, bar_y, bar_w, bar_h,
               fillColor=GRAY_100, strokeColor=GRAY_300, strokeWidth=0.5))

    # Gradient effect: red → green sections
    third = bar_w / 3
    d.add(Rect(margin, bar_y, third, bar_h, fillColor=HexColor("#fecaca"), strokeColor=None))
    d.add(Rect(margin + third, bar_y, third, bar_h, fillColor=EMERALD_LIGHT, strokeColor=None))
    d.add(Rect(margin + third * 2, bar_y, third, bar_h, fillColor=HexColor("#bbf7d0"), strokeColor=None))

    # Mid marker
    mid_x = margin + bar_w / 2
    d.add(Line(mid_x, bar_y - 3, mid_x, bar_y + bar_h + 3,
               strokeColor=NAVY, strokeWidth=2))

    # Labels
    d.add(String(margin, bar_y + bar_h + 6, format_brl(low),
                  fontName="Helvetica", fontSize=7, fillColor=RED))
    d.add(String(mid_x - 15, bar_y + bar_h + 6, format_brl(mid),
                  fontName="Helvetica-Bold", fontSize=7.5, fillColor=NAVY))
    d.add(String(margin + bar_w - 40, bar_y + bar_h + 6, format_brl(high),
                  fontName="Helvetica", fontSize=7, fillColor=GREEN))

    # Bottom labels
    d.add(String(margin + 5, bar_y - 12, "Conservative",
                  fontName="Helvetica", fontSize=6, fillColor=GRAY_500))
    d.add(String(mid_x - 8, bar_y - 12, "Base",
                  fontName="Helvetica-Bold", fontSize=6, fillColor=GRAY_700))
    d.add(String(margin + bar_w - 35, bar_y - 12, "Optimistic",
                  fontName="Helvetica", fontSize=6, fillColor=GRAY_500))

    story.append(d)
    story.append(Spacer(1, 2 * mm))


def _draw_sensitivity_heatmap(story, sensitivity, styles):
    """P1: Draw a color-coded heatmap for the sensitivity matrix (red→yellow→green)."""
    wacc_vals = sensitivity.get("wacc_values", [])
    growth_vals = sensitivity.get("growth_values", [])
    matrix = sensitivity.get("equity_matrix", [])
    if not wacc_vals or not growth_vals or not matrix:
        return

    n_rows = len(wacc_vals)
    n_cols = len(growth_vals)
    cell_w = 68
    cell_h = 22
    label_w = 65
    label_h = 20
    W = label_w + n_cols * cell_w + 10
    H = label_h + n_rows * cell_h + 35
    d = Drawing(W, H)

    d.add(String(0, H - 5, "Sensitivity: Ke × Growth (Heatmap)",
                  fontName="Helvetica-Bold", fontSize=9, fillColor=NAVY))

    # Flatten to find min/max for color scale
    all_vals = [v for row in matrix for v in row if v is not None]
    if not all_vals:
        return
    min_val = min(all_vals)
    max_val = max(all_vals)
    val_range_span = max_val - min_val if max_val != min_val else 1

    # Column headers (growth rates)
    for j, g in enumerate(growth_vals):
        x = label_w + j * cell_w
        y = H - label_h - 8
        d.add(String(x + cell_w/2 - 12, y, f"{g:.1f}%",
                      fontName="Helvetica-Bold", fontSize=7, fillColor=GRAY_600))

    # Row headers + cells
    mid_row = n_rows // 2
    mid_col = n_cols // 2
    for i, w in enumerate(wacc_vals):
        y = H - label_h - 22 - i * cell_h
        d.add(String(2, y + 6, f"Ke {w:.1f}%",
                      fontName="Helvetica-Bold", fontSize=6.5, fillColor=GRAY_700))
        for j, val in enumerate(matrix[i]):
            x = label_w + j * cell_w
            # Color: red (low) → yellow (mid) → green (high)
            t = (val - min_val) / val_range_span if val_range_span else 0.5
            if t < 0.5:
                r = 0.9
                g_c = 0.3 + t * 1.2
                b = 0.3
            else:
                r = 0.9 - (t - 0.5) * 1.4
                g_c = 0.7 + (t - 0.5) * 0.3
                b = 0.3
            color = Color(min(r, 1), min(g_c, 1), min(b, 1), 0.75)
            # Highlight center cell
            stroke = NAVY if (i == mid_row and j == mid_col) else None
            sw = 2 if (i == mid_row and j == mid_col) else 0
            d.add(Rect(x, y, cell_w - 2, cell_h - 2,
                        fillColor=color, strokeColor=stroke, strokeWidth=sw))
            d.add(String(x + 4, y + 6, format_brl(val),
                          fontName="Helvetica-Bold" if (i == mid_row and j == mid_col) else "Helvetica",
                          fontSize=6.5, fillColor=WHITE if t < 0.4 else NAVY))

    story.append(d)
    story.append(Spacer(1, 4 * mm))


def _draw_ev_donut_chart(story, result):
    """P2: Draw a donut chart showing EV composition by method."""
    ev_gordon = result.get("enterprise_value_gordon", 0)
    ev_exit = result.get("enterprise_value_exit", 0)
    ev_mult = result.get("multiples_valuation", {}).get("ev_avg_multiples", 0)
    total = ev_gordon + ev_exit + ev_mult
    if total <= 0:
        return

    W, H = 250, 180
    d = Drawing(W, H + 15)
    d.add(String(0, H + 2, "DCF Value Composition",
                  fontName="Helvetica-Bold", fontSize=9, fillColor=NAVY))

    cx, cy = 90, H / 2 - 5
    outer_r = 60
    inner_r = 35

    slices = [
        ("DCF Gordon", ev_gordon / total * 100, EMERALD),
        ("DCF Exit", ev_exit / total * 100, TEAL),
        ("Multiples", ev_mult / total * 100, HexColor("#8b5cf6")),
    ]

    start_angle = 90
    for label, pct, color in slices:
        if pct <= 0:
            continue
        sweep = pct * 3.6  # 360 degrees per 100%
        # Outer wedge
        w = Wedge(cx, cy, outer_r, start_angle, start_angle + sweep,
                  fillColor=color, strokeColor=WHITE, strokeWidth=1.5)
        d.add(w)
        # Inner white circle to make donut
        start_angle += sweep

    # White center (donut hole)
    d.add(Circle(cx, cy, inner_r, fillColor=WHITE, strokeColor=None))
    # Center text
    d.add(String(cx - 18, cy + 4, "DCF Total",
                  fontName="Helvetica", fontSize=7, fillColor=GRAY_500))
    d.add(String(cx - 22, cy - 8, format_brl(total),
                  fontName="Helvetica-Bold", fontSize=8, fillColor=NAVY))

    # Legend
    lx = 170
    for i, (label, pct, color) in enumerate(slices):
        if pct <= 0:
            continue
        ly = H / 2 + 20 - i * 22
        d.add(Rect(lx, ly, 10, 10, fillColor=color, strokeColor=None))
        d.add(String(lx + 14, ly + 1, f"{label}",
                      fontName="Helvetica-Bold", fontSize=7, fillColor=GRAY_700))
        d.add(String(lx + 14, ly - 10, f"{pct:.0f}%",
                      fontName="Helvetica", fontSize=6.5, fillColor=GRAY_500))

    story.append(d)
    story.append(Spacer(1, 4 * mm))


def _draw_ebitda_bars(story, pnl):
    """P3: Mini EBITDA bar chart next to P&L."""
    if not pnl:
        return
    W, H = 450, 130
    d = Drawing(W, H + 25)
    d.add(String(0, H + 12, "EBITDA by Year",
                  fontName="Helvetica-Bold", fontSize=9, fillColor=NAVY))

    n = len(pnl)
    margin_l, margin_b = 60, 25
    chart_w = W - margin_l - 20
    chart_h = H - margin_b - 5
    bar_w = min(chart_w / n * 0.6, 50)

    ebitda_vals = [p.get("ebitda", 0) for p in pnl]
    max_val = max(abs(v) for v in ebitda_vals) if ebitda_vals else 1
    if max_val == 0:
        max_val = 1

    # Gridlines
    for i in range(5):
        y = margin_b + chart_h * i / 4
        d.add(Line(margin_l, y, W - 20, y, strokeColor=GRAY_200, strokeWidth=0.5))
        lv = max_val * i / 4
        d.add(String(2, y - 3, format_brl(lv), fontName="Helvetica", fontSize=5.5, fillColor=GRAY_500))

    d.add(Line(margin_l, margin_b, W - 20, margin_b, strokeColor=GRAY_300, strokeWidth=1))

    for i, p in enumerate(pnl):
        ebitda = p.get("ebitda", 0)
        x = margin_l + (chart_w / n) * i + (chart_w / n - bar_w) / 2
        h = (abs(ebitda) / max_val) * chart_h
        color = EMERALD if ebitda >= 0 else RED
        d.add(Rect(x, margin_b, bar_w, max(h, 1), fillColor=color, strokeColor=None))
        # Value on top
        d.add(String(x, margin_b + h + 3, format_brl(ebitda),
                      fontName="Helvetica-Bold", fontSize=5.5, fillColor=color))
        d.add(String(x + bar_w/2 - 8, margin_b - 12, f"Year {p.get('year', i+1)}",
                      fontName="Helvetica", fontSize=6, fillColor=GRAY_600))

    story.append(d)
    story.append(Spacer(1, 4 * mm))


def _build_infographic_page(story, analysis, result, styles):
    """P5: Visual infographic summary page with 8 key numbers in card layout."""
    story.append(Spacer(1, 5 * mm))
    bar = HRFlowable(width="100%", thickness=3, color=EMERALD, spaceAfter=0, spaceBefore=0)
    story.append(bar)
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("Overview — Infographic", styles["SectionTitle"]))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        f"Visual summary of key indicators for <b>{analysis.company_name}</b>.",
        styles["Body"]))
    story.append(Spacer(1, 6 * mm))

    params = result.get("parameters", {})
    equity = result.get("equity_value", 0)
    ev = result.get("enterprise_value", 0)
    risk = result.get("risk_score", 0)
    maturity = result.get("maturity_index", 0)
    wacc_val = result.get("wacc", 0)
    dlom_pct = result.get("dlom", {}).get("dlom_pct", 0)
    survival_rate = result.get("survival", {}).get("survival_rate", 0)
    percentile = result.get("percentile", 0)

    cards = [
        ("Equity Value", format_brl(equity), EMERALD, "Equity value after adjustments"),
        ("DCF Value", format_brl(ev), TEAL, "PV of FCFEs + Terminal PV"),
        ("Annual Revenue", format_brl(params.get("revenue", 0)), HexColor("#3b82f6"), "Reported Revenue"),
        ("Ke (Cost of Equity)", format_pct(wacc_val), HexColor("#8b5cf6"), "Cost of equity (Valuora)"),
        ("Risk Score", f"{risk:.0f}/100", RED if risk > 60 else AMBER if risk > 30 else GREEN, "Lower is better"),
        ("Maturity", f"{maturity:.0f}/100", EMERALD if maturity > 60 else AMBER, "Development level"),
        ("DLOM", format_pct(dlom_pct), AMBER, "Liquidity discount"),
        ("Survival", format_pct(survival_rate), GREEN if survival_rate and survival_rate > 0.7 else AMBER, "Embedded in Terminal Value"),
    ]

    # Build as 2-column, 4-row table of cards
    card_rows = []
    for row_idx in range(4):
        left_idx = row_idx * 2
        right_idx = row_idx * 2 + 1
        left = cards[left_idx] if left_idx < len(cards) else None
        right = cards[right_idx] if right_idx < len(cards) else None

        def _card_content(card):
            if not card:
                return ""
            title, value, color, desc = card
            hex_color = color.hexval() if hasattr(color, 'hexval') else '#059669'
            return Paragraph(
                f'<font face="Helvetica" size="7" color="#6b7280">{title}</font><br/>'
                f'<font face="Helvetica-Bold" size="16" color="{hex_color}">{value}</font><br/>'
                f'<font face="Helvetica" size="6" color="#9ca3af">{desc}</font>',
                ParagraphStyle("InfoCard", alignment=TA_CENTER, leading=18, spaceBefore=4, spaceAfter=4)
            )

        card_rows.append([_card_content(left), _card_content(right)])

    card_table = Table(card_rows, colWidths=[225, 225], rowHeights=[70] * 4)
    card_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAY_300),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, GRAY_200),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_50),
    ]))
    story.append(card_table)
    story.append(Spacer(1, 6 * mm))

    # Bottom bar with percentile
    story.append(Paragraph(
        f'Market percentile: <b>{percentile:.0f}%</b> — '
        f'Sector: <b>{analysis.sector.capitalize()}</b> — '
        f'Margin: <b>{format_pct(params.get("net_margin", 0))}</b> — '
        f'Growth: <b>{format_pct(params.get("growth_rate", 0))}</b>',
        ParagraphStyle("InfoFooter", fontName="Helvetica", fontSize=8,
                       textColor=GRAY_600, alignment=TA_CENTER, leading=14)))
    story.append(PageBreak())


def _scenario_table(story, val_range, styles):
    data = [
        [
            Paragraph("<b>Conservative</b>", ParagraphStyle("sc", fontName="Helvetica-Bold", fontSize=8, textColor=GRAY_600, alignment=TA_CENTER)),
            Paragraph("<b>Base</b>", ParagraphStyle("sc2", fontName="Helvetica-Bold", fontSize=8, textColor=WHITE, alignment=TA_CENTER)),
            Paragraph("<b>Optimistic</b>", ParagraphStyle("sc3", fontName="Helvetica-Bold", fontSize=8, textColor=GRAY_600, alignment=TA_CENTER)),
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


# ─── Strategic — helper functions ────────────────────────────────────────

def _risk_label(score):
    if score >= 15: return "HIGH"
    if score >= 8:  return "MEDIUM"
    return "LOW"


def _risk_color(label):
    if label == "HIGH":   return HexColor("#dc2626")
    if label == "MEDIUM":  return HexColor("#d97706")
    return HexColor("#16a34a")


def _draw_tornado_chart(story, result, params, styles):
    """Tornado chart: horizontal bars showing each variable's impact on equity value."""
    equity = result.get("equity_value", 0)
    if not equity:
        return

    sensitivity = result.get("sensitivity_table", {})
    matrix = sensitivity.get("equity_matrix", [])
    n_rows = len(matrix)
    n_cols = len(matrix[0]) if matrix else 0
    mid_r = n_rows // 2
    mid_c = n_cols // 2

    variables = []

    # 1. Growth rate: center-row, min col vs max col
    if matrix and n_cols >= 3:
        low_g  = matrix[mid_r][0]
        high_g = matrix[mid_r][-1]
        variables.append(("Growth Rate", low_g, high_g))

    # 2. Ke (cost of capital): min row vs max row, center col
    if n_rows >= 3 and matrix:
        low_ke  = matrix[-1][mid_c]   # high Ke → low value
        high_ke = matrix[0][mid_c]    # low  Ke → high value
        variables.append(("Cost of Capital (Ke)", low_ke, high_ke))

    # 3. Net margin: ±25% of net_margin → roughly ±20% of equity (conservative)
    nm = params.get("net_margin", 0.15)
    margin_swing = equity * 0.20 * min(0.25 / max(nm, 0.05), 2.0)
    variables.append(("Net Margin", equity - margin_swing, equity + margin_swing))

    # 4. Founder dependency: each full point of founder_dep adds ~kp_premium to Ke
    fd = params.get("founder_dependency", 0.50)
    fd_raw = result.get("founder_discount", 0)          # kp premium % added to Ke
    # Reducing fd to near zero removes kp_premium — use row delta of sensitivity as proxy
    ke_row_delta = 0
    if n_rows >= 2 and matrix:
        ke_row_delta = abs(matrix[0][mid_c] - matrix[-1][mid_c]) / max(n_rows - 1, 1)
    kp_rows = fd_raw / 2.0 if fd_raw else fd * 2       # approximate rows of Ke improvement
    fd_gain = ke_row_delta * min(kp_rows, (n_rows - 1) / 2)
    variables.append(("Founder Dependency", equity - fd_gain * 0.5, equity + fd_gain))

    # 5. Revenue recurrence: impacts DLOM; each +10pp recurrence → ~2pp DLOM drop
    dlom_d = result.get("dlom", {})
    dlom_pct = dlom_d.get("dlom_pct", 0.20)
    recurrence = params.get("recurring_revenue_pct", 0.40)
    potential_dlom_reduction = max(0, (0.80 - recurrence) * 0.03)   # headroom × 3pp per 10pp
    rec_gain = equity / (1 - dlom_pct) * potential_dlom_reduction
    rec_loss  = equity * dlom_pct * 0.10                              # downside: worse recurrence
    variables.append(("Revenue Recurrence", equity - rec_loss, equity + rec_gain))

    # Sort by total swing descending
    variables.sort(key=lambda x: abs(x[2] - x[1]), reverse=True)

    # Build drawing
    pad_left = 155
    chart_w  = 360
    bar_h    = 22
    gap      = 5
    n        = len(variables)
    H        = n * (bar_h + gap) + 65
    W        = pad_left + chart_w + 20

    all_lows  = [v[1] for v in variables]
    all_highs = [v[2] for v in variables]
    g_min = min(all_lows)  * 0.93
    g_max = max(all_highs) * 1.07
    span  = max(g_max - g_min, 1)

    def xpos(val):
        return pad_left + chart_w * (val - g_min) / span

    cx = xpos(equity)

    d = Drawing(W, H)
    d.add(String(0, H - 14, "Value Drivers — Impact on Equity Value",
                 fontName="Helvetica-Bold", fontSize=9, fillColor=NAVY))
    d.add(String(pad_left + 2, H - 28, "Pessimistic Scenario",
                 fontName="Helvetica", fontSize=6.5, fillColor=RED))
    d.add(String(pad_left + chart_w - 85, H - 28, "Optimistic Scenario",
                 fontName="Helvetica", fontSize=6.5, fillColor=HexColor("#16a34a")))

    # Center line
    d.add(Line(cx, 15, cx, H - 32, strokeColor=GRAY_400, strokeWidth=0.8))

    colors = [EMERALD_DARK, TEAL, HexColor("#0891b2"), HexColor("#7c3aed"), HexColor("#db2777")]
    for i, (name, low, high) in enumerate(variables):
        y   = 20 + (n - 1 - i) * (bar_h + gap)
        xl  = xpos(low)
        xh  = xpos(high)
        bar_color = colors[i % len(colors)]

        d.add(Rect(xl, y + 3, xh - xl, bar_h - 6,
                   fillColor=bar_color, strokeColor=None, strokeWidth=0))

        swing_pct = (high - low) / max(abs(equity), 1) * 100
        d.add(String(xh + 3, y + bar_h / 2 - 3,
                     f"±{swing_pct/2:.0f}%",
                     fontName="Helvetica-Bold", fontSize=6.5, fillColor=EMERALD_DARK))

        d.add(String(2, y + bar_h / 2 - 3, name,
                     fontName="Helvetica", fontSize=7.5, fillColor=GRAY_700))

    story.append(d)
    story.append(Spacer(1, 3 * mm))

    # Explanation table
    rows = [["Variable", "Pessimistic Impact", "Equity Base", "Optimistic Impact", "Range"]]
    for name, low, high in variables:
        rows.append([
            name,
            format_brl(low),
            format_brl(equity),
            format_brl(high),
            f"±{(high-low)/max(abs(equity),1)*50:.0f}%",
        ])
    _build_wide_table(story, rows, col_widths=[130, 80, 80, 80, 70])
    story.append(Spacer(1, 2 * mm))


def _build_risk_matrix_section(story, result, params, analysis, styles):
    """Structured risk matrix: category / risk / probability / impact / level / mitigator."""
    fd      = params.get("founder_dependency", 0.50)
    growth  = params.get("growth_rate", 0.15)
    nm      = params.get("net_margin", 0.15)
    rec     = params.get("recurring_revenue_pct", 0.40)
    debt    = params.get("debt", 0)
    rev     = params.get("revenue", 1_000_000)
    years   = params.get("years_in_business", 3)
    sector  = str(getattr(analysis, "sector", "Services"))

    fd_prob     = 4 if fd > 0.60 else (3 if fd > 0.35 else 2)
    margin_prob = 3 if nm < 0.10 else 2
    rec_prob    = 4 if rec < 0.25 else (2 if rec > 0.55 else 3)
    debt_ratio  = debt / max(rev, 1)
    debt_prob   = 4 if debt_ratio > 0.50 else (2 if debt_ratio < 0.15 else 3)
    grow_prob   = 3 if growth > 0.25 else 2
    conc_impact = 5

    def _lbl(p, i): return _risk_label(p * i)

    risks = [
        ("Operational",  "Founder and key-person dependency",
         fd_prob, 5, _lbl(fd_prob, 5),
         "Documented succession plan + C-Level hiring + operational manuals"),
        ("Market",      "Revenue concentration — few anchor clients",
         3, conc_impact, _lbl(3, conc_impact),
         "Diversify base; target: no client > 15% of revenue"),
        ("Financial",   "Margin compression with scale increase",
         margin_prob, 4, _lbl(margin_prob, 4),
         "Process automation, pricing review, and strict CAC/LTV control"),
        ("Financial",   "Capital needs and excessive leverage",
         debt_prob, 4, _lbl(debt_prob, 4),
         "Conservative structure; maintain D/E < 0.5x; prioritize cash generation"),
        ("Market",      "Entry of well-capitalized competitor",
         2, 5, _lbl(2, 5),
         "Build moat via long-term contracts, deep integration, and loyalty"),
        ("Regulatory",  "Tax or regulatory changes in the sector",
         3, 3, _lbl(3, 3),
         "Preventive tax planning and proper corporate structuring"),
        ("Technology",   "Product obsolescence or critical system failure",
         2, 4, _lbl(2, 4),
         "Continuous innovation roadmap + redundant infrastructure (SLA 99.9%)"),
        ("Execution",     f"Sustaining {growth*100:.0f}% YoY growth",
         grow_prob, 4, _lbl(grow_prob, 4),
         "Quarterly milestone gates + sales/operations team reinforcement"),
        ("Recurrence",  f"Low revenue predictability (current recurrence {rec*100:.0f}%)",
         rec_prob, 3, _lbl(rec_prob, 3),
         "Migrate clients to annual/monthly contracts; target: >60% MRR"),
    ]

    # Header
    header = [
        Paragraph("<b>Category</b>", ParagraphStyle("rh", fontName="Helvetica-Bold", fontSize=7.5, textColor=WHITE, alignment=TA_CENTER)),
        Paragraph("<b>Risk</b>", ParagraphStyle("rh2", fontName="Helvetica-Bold", fontSize=7.5, textColor=WHITE, alignment=TA_CENTER)),
        Paragraph("<b>Prob.</b>", ParagraphStyle("rh3", fontName="Helvetica-Bold", fontSize=7.5, textColor=WHITE, alignment=TA_CENTER)),
        Paragraph("<b>Imp.</b>", ParagraphStyle("rh4", fontName="Helvetica-Bold", fontSize=7.5, textColor=WHITE, alignment=TA_CENTER)),
        Paragraph("<b>Level</b>", ParagraphStyle("rh5", fontName="Helvetica-Bold", fontSize=7.5, textColor=WHITE, alignment=TA_CENTER)),
        Paragraph("<b>Suggested Mitigator</b>", ParagraphStyle("rh6", fontName="Helvetica-Bold", fontSize=7.5, textColor=WHITE, alignment=TA_CENTER)),
    ]
    data = [header]
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [GRAY_50, WHITE]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (2, 0), (4, -1), "CENTER"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 7.5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY_300),
    ]
    for idx, (cat, risk, prob, impact, level, mit) in enumerate(risks, start=1):
        lbl_color = _risk_color(level)
        data.append([
            Paragraph(cat, ParagraphStyle("rc", fontName="Helvetica-Bold", fontSize=7.5, textColor=NAVY)),
            Paragraph(risk, ParagraphStyle("rr", fontName="Helvetica", fontSize=7.5, textColor=GRAY_700, leading=11)),
            Paragraph(f"{prob}/5", ParagraphStyle("rp", fontName="Helvetica-Bold", fontSize=7.5, textColor=NAVY, alignment=TA_CENTER)),
            Paragraph(f"{impact}/5", ParagraphStyle("ri", fontName="Helvetica-Bold", fontSize=7.5, textColor=NAVY, alignment=TA_CENTER)),
            Paragraph(f"<b>{level}</b>", ParagraphStyle("rl", fontName="Helvetica-Bold", fontSize=7.5, textColor=lbl_color, alignment=TA_CENTER)),
            Paragraph(mit, ParagraphStyle("rm", fontName="Helvetica", fontSize=7, textColor=GRAY_600, leading=10)),
        ])

    t = Table(data, colWidths=[58, 120, 28, 28, 38, 168])
    t.setStyle(TableStyle(style_cmds))
    story.append(t)
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        "Prob. = Probability of occurrence (1=Rare, 5=Near certain)  ·  "
        "Imp. = Financial impact (1=Insignificant, 5=Critical)  ·  "
        "Level = Prob × Imp  ·  HIGH ≥ 15  ·  MEDIUM ≥ 8",
        ParagraphStyle("rfoot", fontName="Helvetica-Oblique", fontSize=7, textColor=GRAY_400, leading=10)))


def _build_exit_strategy_section(story, result, params, analysis, styles):
    """Exit Strategy: timing, buyer profile, M&A multiples, optimal window."""
    equity    = result.get("equity_value", 0)
    maturity  = result.get("maturity_index", 50)
    ev        = result.get("enterprise_value", equity)
    ebitda    = params.get("ebitda", 0) or (params.get("revenue", 0) * params.get("net_margin", 0.15) * 0.7)
    revenue   = params.get("revenue", 1_000_000)
    growth    = params.get("growth_rate", 0.15)
    years_biz = params.get("years_in_business", 3)
    sector    = str(getattr(analysis, "sector", "Services"))
    s_mults   = result.get("sector_multiples", {})
    ev_ebitda = s_mults.get("ev_ebitda", 7.0)
    ev_rev    = s_mults.get("ev_revenue", 1.5)

    # Timing recommendation
    if maturity >= 72:
        timing = "Short term (12–24 months) — mature company, attractive multiples, favorable window."
        timing_label = "12–24 months"
    elif maturity >= 52:
        timing = "Medium term (2–4 years) — execute professionalization plan before exit to maximize value."
        timing_label = "2–4 years"
    else:
        timing = "Long term (4–6 years) — build fundamentals, scale, and governance first."
        timing_label = "4–6 years"

    # M&A premium
    strategic_premium = 0.30 if growth > 0.25 else 0.20
    financial_discount = -0.10
    strategic_val  = equity * (1 + strategic_premium)
    financial_val  = equity * (1 + financial_discount)
    ma_ev_ebitda   = ev_ebitda * 1.25   # M&A transactions typically 20-30% above public comps

    # EV/Revenue implied
    ev_rev_implied = ev / max(revenue, 1)

    # Strategic vs Financial
    profile_rows = [
        ["Parameter", "Strategic Buyer", "Financial Buyer (PE/VC)"],
        ["Profile", "Competitor, larger sector player, consolidator", "PE fund, family office, angel investor"],
        ["Motivation", "Synergies, market share, competitor elimination", "Financial return, exit multiple in 4–7 years"],
        ["Typical Premium", f"+{strategic_premium*100:.0f}% over DCF value", f"{financial_discount*100:.0f}% at parity over DCF"],
        ["Estimated Value", format_brl(strategic_val), format_brl(financial_val)],
        ["Negotiation", "Exclusivity contract + earn-out", "Term sheet + rigorous due diligence"],
        ["Average Timing", "3–6 months (M&A)", "4–8 months (VC/PE fundraising)"],
    ]
    _build_wide_table(story, profile_rows, col_widths=[110, 175, 175], accent_color=TEAL)
    story.append(Spacer(1, 5 * mm))

    # Multiples comparison
    mult_rows = [
        ["Metric", "Enterprise Value (DCF)", "Sector M&A (estimate)", "Difference"],
        ["EV/EBITDA",
         f"{ev/max(ebitda,1):.1f}×",
         f"{ma_ev_ebitda:.1f}×",
         f"{(ma_ev_ebitda - ev/max(ebitda,1)):+.1f}×"],
        ["EV/Revenue",
         f"{ev_rev_implied:.2f}×",
         f"{ev_rev*1.20:.2f}×",
         f"{(ev_rev*1.20 - ev_rev_implied):+.2f}×"],
        ["Equity Value (M&A estimate)",
         format_brl(equity),
         format_brl(strategic_val),
         f"+{strategic_premium*100:.0f}%"],
    ]
    _build_wide_table(story, mult_rows, col_widths=[120, 110, 130, 100], accent_color=NAVY)
    story.append(Spacer(1, 5 * mm))

    # Optimal window callout
    _callout_box(story, "RECOMMENDED EXIT WINDOW", [
        f"Suggested horizon: {timing_label}",
        timing,
        f"Priority buyer profile: {'Strategic (' + sector + ')' if growth > 0.20 else 'Financial (PE/Family Office)'}",
        "Recommended preparation: data room, audit, normalized EBITDA, formalized contracts.",
        "Exit structure: consider earn-out of 20–30% of EV tied to post-M&A revenue targets.",
    ])


def _build_value_increase_plan(story, result, params, analysis, styles):
    """Action plan with estimated equity impact for each lever."""
    equity   = result.get("equity_value", 0)
    fd       = params.get("founder_dependency", 0.50)
    growth   = params.get("growth_rate", 0.15)
    nm       = params.get("net_margin", 0.15)
    rec      = params.get("recurring_revenue_pct", 0.40)
    debt     = params.get("debt", 0)
    rev      = params.get("revenue", 1_000_000)
    years    = params.get("years_in_business", 3)
    maturity = result.get("maturity_index", 50)

    # --- Sensitivity matrix extraction for growth/Ke (high precision) ---
    sensitivity = result.get("sensitivity_table", {})
    matrix      = sensitivity.get("equity_matrix", [])
    n_r = len(matrix); n_c = len(matrix[0]) if matrix else 0
    mid_r = n_r // 2;  mid_c = n_c // 2

    def _col_delta(col_step=1):
        """Equity delta for +1 step in growth rate (1 column right)."""
        if matrix and mid_c + col_step < n_c:
            return matrix[mid_r][mid_c + col_step] - matrix[mid_r][mid_c]
        return equity * 0.10

    def _row_delta(row_step=1):
        """Equity delta for -1 step in Ke (1 row up = lower Ke = higher equity)."""
        if matrix and mid_r - row_step >= 0:
            return matrix[mid_r - row_step][mid_c] - matrix[mid_r][mid_c]
        return equity * 0.10

    # Impact calculations
    growth_impact  = _col_delta(1)                                          # +2pp growth
    margin_impact  = equity * 0.18 * (0.03 / max(nm, 0.01))                # +3pp margin
    margin_impact  = min(margin_impact, equity * 0.25)
    fd_ke_rows     = result.get("founder_discount", 0) / 2.0               # rows of Ke drop
    fd_impact      = _row_delta(1) * min(max(fd_ke_rows, 0.5), 2.0) * (fd / 0.5)
    rec_dlom       = result.get("dlom", {}).get("dlom_pct", 0.20)
    rec_impact     = equity / (1 - rec_dlom) * min(max(0, 0.60 - rec) * 0.04, 0.10)
    gov_impact     = equity * 0.06 if maturity < 60 else equity * 0.03     # governance
    invest_impact  = equity * 0.08                                          # pitch / data room
    debt_ratio     = debt / max(rev, 1)
    debt_impact    = equity * min(debt_ratio * 0.15, 0.12)

    # Actions table
    actions = [
        (
            "Reduce founder dependency",
            f"{fd*100:.0f}%",
            "< 25%",
            abs(fd_impact),
            f"{abs(fd_impact)/max(equity,1)*100:.0f}%",
            "Hire C-Level (COO/CFO), document processes, delegate operational areas",
        ),
        (
            "Formalize corporate governance",
            f"Maturity {maturity:.0f}/100",
            "> 70/100",
            abs(gov_impact),
            f"{abs(gov_impact)/max(equity,1)*100:.0f}%",
            "Create advisory board, monthly financials, reviewed contracts, and basic data room",
        ),
        (
            "Increase recurring revenue",
            f"{rec*100:.0f}%",
            "> 60%",
            abs(rec_impact),
            f"{abs(rec_impact)/max(equity,1)*100:.0f}%",
            "Migrate to annual/monthly contracts, service bundling, subscription model",
        ),
        (
            "Sustain revenue growth",
            f"{growth*100:.0f}% YoY",
            f"{(growth+0.05)*100:.0f}%+ YoY",
            abs(growth_impact),
            f"{abs(growth_impact)/max(equity,1)*100:.0f}%",
            "Channel expansion, structured Inside Sales, digital marketing investment",
        ),
        (
            "Expand net margin",
            f"{nm*100:.0f}%",
            f"{(nm+0.04)*100:.0f}%",
            abs(margin_impact),
            f"{abs(margin_impact)/max(equity,1)*100:.0f}%",
            "Operational automation, pricing review, CAC/LTV ratio reduction",
        ),
        (
            "Prepare data room and pitch for M&A",
            "Not structured",
            "M&A-ready",
            abs(invest_impact),
            f"{abs(invest_impact)/max(equity,1)*100:.0f}%",
            "Audits, formalized contracts, IFRS-ready financials, NDA and teaser prepared",
        ),
    ]
    if debt_ratio > 0.15:
        actions.append((
            "Reduce financial leverage",
            f"D/Revenue {debt_ratio*100:.0f}%",
            "< 15%",
            abs(debt_impact),
            f"{abs(debt_impact)/max(equity,1)*100:.0f}%",
            "Amortize debt with FCF, avoid costly new loans, review capital structure",
        ))

    # Sort by impact descending
    actions.sort(key=lambda x: x[3], reverse=True)

    total_impact = sum(a[3] for a in actions)

    header = [
        Paragraph("<b>Action</b>", ParagraphStyle("vah", fontName="Helvetica-Bold", fontSize=7.5, textColor=WHITE)),
        Paragraph("<b>Current Status</b>", ParagraphStyle("vah2", fontName="Helvetica-Bold", fontSize=7.5, textColor=WHITE, alignment=TA_CENTER)),
        Paragraph("<b>Target</b>", ParagraphStyle("vah3", fontName="Helvetica-Bold", fontSize=7.5, textColor=WHITE, alignment=TA_CENTER)),
        Paragraph("<b>Impact (+Value)</b>", ParagraphStyle("vah4", fontName="Helvetica-Bold", fontSize=7.5, textColor=WHITE, alignment=TA_CENTER)),
        Paragraph("<b>%</b>", ParagraphStyle("vah5", fontName="Helvetica-Bold", fontSize=7.5, textColor=WHITE, alignment=TA_CENTER)),
        Paragraph("<b>How to Execute</b>", ParagraphStyle("vah6", fontName="Helvetica-Bold", fontSize=7.5, textColor=WHITE, alignment=TA_CENTER)),
    ]
    rows = [header]
    for i, (act, curr, target, impact, pct, how) in enumerate(actions):
        rows.append([
            Paragraph(f"<b>{act}</b>", ParagraphStyle("var", fontName="Helvetica-Bold", fontSize=7.5, textColor=NAVY, leading=11)),
            Paragraph(curr, ParagraphStyle("vac", fontName="Helvetica", fontSize=7.5, textColor=GRAY_600, alignment=TA_CENTER)),
            Paragraph(f"<b>{target}</b>", ParagraphStyle("vat", fontName="Helvetica-Bold", fontSize=7.5, textColor=EMERALD_DARK, alignment=TA_CENTER)),
            Paragraph(f"<b>{format_brl(impact)}</b>", ParagraphStyle("vai", fontName="Helvetica-Bold", fontSize=7.5, textColor=GREEN, alignment=TA_CENTER)),
            Paragraph(f"<b>+{pct}</b>", ParagraphStyle("vap", fontName="Helvetica-Bold", fontSize=7, textColor=EMERALD_DARK, alignment=TA_CENTER)),
            Paragraph(how, ParagraphStyle("vahow", fontName="Helvetica", fontSize=6.8, textColor=GRAY_600, leading=10)),
        ])

    t = Table(rows, colWidths=[100, 65, 55, 70, 32, 118])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [EMERALD_PALE, WHITE]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, GRAY_300),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t)
    story.append(Spacer(1, 4 * mm))

    _callout_box(story, "TOTAL VALUE INCREASE POTENTIAL (CUMULATIVE EXECUTION)", [
        f"Current equity value: {format_brl(equity)}",
        f"Total cumulative estimated equity boost: +{format_brl(total_impact)} ({total_impact/max(equity,1)*100:.0f}%)",
        f"Potential value after execution: {format_brl(equity + total_impact)}",
        "Note: impacts are conservative, independent estimates. Combined effects may be greater.",
    ], accent=GREEN)


def _build_opinion_letter(story, result, params, analysis, styles, report_id, timestamp):
    """Formal Letter of Opinion — investment-bank style."""
    from reportlab.platypus import KeepTogether
    equity      = result.get("equity_value", 0)
    val_range   = result.get("valuation_range", {})
    low         = val_range.get("low", equity * 0.75)
    high        = val_range.get("high", equity * 1.25)
    company     = getattr(analysis, "company_name", "Evaluated Company")
    sector      = str(getattr(analysis, "sector", "—")).capitalize()
    cnpj        = getattr(analysis, "cnpj", "—") or "—"
    ref_date    = datetime.now().strftime("%B %d, %Y")

    # Decorative border box
    W_page = 460
    border = Table([[""]], colWidths=[W_page])
    border.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 2,   EMERALD_DARK),
        ("LINEABOVE",     (0, 0), (-1, 0),  0.5, NAVY),
        ("BACKGROUND",    (0, 0), (-1, -1), EMERALD_PALE),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    # Header bar
    hdr = Table([[
        Paragraph("VALUORA — VALUATION ADVISORY",
                  ParagraphStyle("oh", fontName="Helvetica-Bold", fontSize=10, textColor=WHITE)),
        Paragraph(f"Ref. #{report_id}  ·  {timestamp}",
                  ParagraphStyle("oh2", fontName="Helvetica", fontSize=8, textColor=EMERALD_BRIGHT, alignment=TA_RIGHT)),
    ]], colWidths=[320, 140])
    hdr.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), NAVY),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(hdr)
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("VALUE OPINION LETTER", ParagraphStyle(
        "olt", fontName="Helvetica-Bold", fontSize=16, textColor=EMERALD_DARK,
        alignment=TA_CENTER, spaceBefore=4, spaceAfter=2)))
    story.append(Paragraph("Value Opinion Letter — Fairness & Valuation Advisory",
        ParagraphStyle("ols", fontName="Helvetica-Oblique", fontSize=9,
                       textColor=GRAY_500, alignment=TA_CENTER, spaceAfter=8)))
    story.append(HRFlowable(width="100%", thickness=1.5, color=EMERALD, spaceAfter=8))

    story.append(Paragraph(f"<b>Company evaluated:</b> {company}", styles["Body"]))
    story.append(Paragraph(f"<b>Tax ID:</b> {cnpj}  ·  <b>Sector:</b> {sector}", styles["Body"]))
    story.append(Paragraph(f"<b>Valuation reference date:</b> {ref_date}", styles["Body"]))
    story.append(Paragraph(f"<b>Report number:</b> {report_id}", styles["Body"]))
    story.append(Spacer(1, 5 * mm))

    body_text = (
        "A <b>Valuora \u2014 Valuation Advisory</b> (\u201cValuora\u201d), headquartered at its registered address, "
        "was requested to perform an independent economic-financial valuation of the company identified above, "
        f"as of the reference date of <b>{ref_date}</b>."
        "<br/><br/>"
        "Based on the <b>FCFE/Ke v7</b> (Free Cash Flow to Equity / Gordon Growth + Exit Multiple), "
        "calibrated with public sector benchmark data (Damodaran/NYU, FRED/US Treasury) and adjusted by "
        "multidimensional qualitative analysis, Valuora reached the following conclusion:"
    )
    story.append(Paragraph(body_text, styles["Body"]))
    story.append(Spacer(1, 5 * mm))

    # Value box
    val_tbl = Table([
        [Paragraph("FAIR EQUITY VALUE — BASE SCENARIO",
                   ParagraphStyle("vbt", fontName="Helvetica-Bold", fontSize=8, textColor=GRAY_500, alignment=TA_CENTER))],
        [Paragraph(f"<b>{format_brl(equity)}</b>",
                   ParagraphStyle("vbv", fontName="Helvetica-Bold", fontSize=26, textColor=EMERALD_DARK, alignment=TA_CENTER))],
        [Paragraph(f"Value range: {format_brl(low)} to {format_brl(high)}",
                   ParagraphStyle("vbr", fontName="Helvetica", fontSize=8, textColor=GRAY_600, alignment=TA_CENTER))],
    ], colWidths=[460])
    val_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), EMERALD_PALE),
        ("BOX",           (0, 0), (-1, -1), 2, EMERALD_DARK),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(val_tbl)
    story.append(Spacer(1, 5 * mm))

    conclusion = (
        "This value opinion reflects Valuora's independent judgment based on the information "
        "provided by the requesting party and on publicly available market data as of the reference date. "
        "The indicated value represents the <b>fair equity value</b> of the evaluated company, "
        "after applying DLOM (Discount for Lack of Marketability) and qualitative adjustment, and is intended "
        "to serve as a reference for investment fundraising, corporate negotiations, "
        "mergers and acquisitions, succession planning, and strategic management."
        "<br/><br/>"
        "Valuora declares that: <b>(i)</b> it has no conflict of interest with the evaluated company; "
        "<b>(ii)</b> the analysis was conducted with independence and objectivity; <b>(iii)</b> compensation "
        "for the work is not contingent upon the conclusions of this opinion; and <b>(iv)</b> the results "
        "were obtained using internationally recognized methodology."
    )
    story.append(Paragraph(conclusion, styles["Body"]))
    story.append(Spacer(1, 6 * mm))

    # Signature block
    sig_tbl = Table([
        [
            Paragraph("Valuora Valuation Advisory<br/><b>FCFE/Ke v7 Engine · Damodaran Methodology</b>",
                      ParagraphStyle("sig1", fontName="Helvetica", fontSize=8, textColor=GRAY_700, leading=13)),
            Paragraph(f"Issued on: {ref_date}<br/><b>Report #{report_id}</b>",
                      ParagraphStyle("sig2", fontName="Helvetica", fontSize=8, textColor=GRAY_700, leading=13, alignment=TA_RIGHT)),
        ]
    ], colWidths=[230, 230])
    sig_tbl.setStyle(TableStyle([
        ("LINEABOVE",     (0, 0), (-1, 0),  1.5, EMERALD),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(sig_tbl)
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph(
        "This document constitutes a technical value opinion and does not represent a guarantee of future "
        "financial results. Actual market values may diverge due to macroeconomic conditions, "
        "negotiation between parties, and factors unforeseen at the reference date. "
        "This letter does not replace valuation reports required by law for regulatory filing purposes.",
        ParagraphStyle("oldisc", fontName="Helvetica-Oblique", fontSize=7, textColor=GRAY_400,
                       alignment=TA_JUSTIFY, leading=10)))


def generate_report_pdf(analysis):
    from app.models.models import PlanType
    plan_type = analysis.plan
    is_prof = plan_type in (PlanType.PROFISSIONAL, PlanType.ESTRATEGICO) if plan_type else False
    is_strat = plan_type == PlanType.ESTRATEGICO if plan_type else False
    _plan_labels = {PlanType.ESSENCIAL: "Essential", PlanType.PROFISSIONAL: "Professional", PlanType.ESTRATEGICO: "Strategic"}
    _plan_label = _plan_labels.get(plan_type, "Premium")

    report_id = str(uuid.uuid4())[:8].upper()
    timestamp = datetime.now().strftime("%b %d, %Y %H:%M")

    output_dir = Path(settings.REPORTS_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = f"valuora-{analysis.id}-{report_id}.pdf"
    filepath = str(output_dir / filename)

    styles = get_styles()
    doc = SimpleDocTemplate(
        filepath, pagesize=A4,
        topMargin=2 * cm, bottomMargin=2.5 * cm,
        leftMargin=2.5 * cm, rightMargin=2.5 * cm,
        title=f"Valuation Report — {analysis.company_name}",
        author="Valuora · valuora.online",
        subject="Business Valuation — Valuora",
        creator="Valuora (valuora.online)",
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
        except Exception as e:
            logger.debug(f"[PDFService] Could not load logo {analysis.logo_path!r}: {e!r}")

    story.append(Spacer(1, logo_spacer * mm))
    story.append(Paragraph("VALUATION REPORT", ParagraphStyle(
        "CoverLabel", fontName="Helvetica-Bold", fontSize=10, textColor=EMERALD,
        alignment=TA_LEFT, spaceAfter=6)))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(analysis.company_name, styles["CoverTitle"]))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(f"Sector: {analysis.sector.capitalize()}", styles["CoverSubtitle"]))
    story.append(Spacer(1, 20 * mm))

    meta_lines = [
        f"Report #{report_id}  \u00b7  {timestamp}",
        f"Plan {_plan_label}",
        "Methodology: DCF FCFE/Ke v7 (Gordon + Exit Multiple) + Damodaran Multiples",
        "Sources: Damodaran/NYU  \u00b7  FRED/US Treasury  \u00b7  Sector Benchmarks",
        "Engine: Valuora Engine v7.0",
    ]
    for line in meta_lines:
        story.append(Paragraph(line, styles["CoverTarget"]))
    story.append(PageBreak())

    # TABLE OF CONTENTS
    _section_header(story, "Table of Contents", styles)

    toc_items = ["Executive Summary"]
    if is_prof:
        toc_items.append("Assumptions and Input Data")
    toc_items.append("Valuation Methodology")
    if is_prof:
        toc_items += ["Revenue and FCFE Projection", "Projected P&L"]
    toc_items.append("DCF \u2014 Gordon Growth Model")
    if is_prof:
        toc_items += ["DCF \u2014 Exit Multiple", "Market Multiples (informational)", "Value Composition (Waterfall)"]
        toc_items += ["Liquidity Discount (DLOM)", "Survival (embedded in TV)"]
    if is_strat:
        toc_items.append("Qualitative Assessment")
    if is_prof:
        toc_items += ["Sensitivity Analysis", "Sector Benchmark"]
    toc_items.append("Risk and Maturity")
    if is_prof:
        toc_items += ["Ke Detailed \u2014 Engine v7", "TV Fade (Convergence)", "Peer Comparison", "Control Premium"]
    if is_strat:
        toc_items.append("Monte Carlo Simulation")
        toc_items.append("Tornado Chart \u2014 Value Drivers")
        toc_items.append("Investment Round Simulation")
        toc_items.append("Exit Strategy Analysis")
        toc_items.append("Structured Risk Matrix")
        toc_items.append("Value Increase Plan")
        if analysis.ai_analysis:
            toc_items.append("AI Strategic Analysis")
        toc_items.append("Value Opinion Letter")
    toc_items += ["Glossary", "Legal Disclaimer"]

    for i, item in enumerate(toc_items, 1):
        story.append(Paragraph(
            f'<font face="Helvetica-Bold" color="#059669">{i:02d}</font>'
            f'<font face="Helvetica" color="#374151">    {item}</font>',
            styles["TOCEntry"]))
    story.append(PageBreak())

    # INFOGRAPHIC PAGE (P5) — before detailed content
    if is_prof:
        _build_infographic_page(story, analysis, result, styles)

    # EXECUTIVE SUMMARY
    _section_header(story, "Executive Summary", styles)
    equity = result.get("equity_value", 0)
    val_range = result.get("valuation_range", {})

    _value_card(story, format_brl(equity), "Estimated Equity Value (after all adjustments)", styles)
    story.append(Spacer(1, 4 * mm))

    # Key insights callout
    risk_score = result.get("risk_score", 0)
    maturity_idx = result.get("maturity_index", 0)
    qual_adj = qual.get("adjustment_pct", 0) if qual else 0
    dlom_pct = dlom.get("dlom_pct", 0) if dlom else 0
    insights = [
        f"Annual revenue of {format_brl(params.get('revenue', 0))} with net margin of {format_pct(params.get('net_margin', 0))}",
        f"Risk score {risk_score:.0f}/100 \u00b7 Maturity index {maturity_idx:.0f}/100",
        f"Liquidity discount (DLOM) of {format_pct(dlom_pct)} applied to final value",
    ]
    if qual_adj:
        sign = "+" if qual_adj >= 0 else ""
        answers_count = len(qual.get("answers", {})) if qual else 0
        insights.append(f"Qualitative adjustment of {sign}{format_pct(qual_adj)} based on {answers_count} answers")
    _callout_box(story, "EXECUTIVE HIGHLIGHTS", insights)
    story.append(Spacer(1, 2 * mm))

    _draw_scenario_bar(story, val_range, equity)
    story.append(Spacer(1, 4 * mm))
    _scenario_table(story, val_range, styles)
    story.append(Spacer(1, 8 * mm))

    key_metrics = [
        ["Indicator", "Value"],
        ["Annual Revenue", format_brl(params.get("revenue", 0))],
        ["Net Margin", format_pct(params.get("net_margin", 0))],
        ["Growth", format_pct(params.get("growth_rate", 0))],
        ["Ke (Cost of Equity)", format_pct(wacc_val)],
        ["DCF Value", format_brl(result.get("enterprise_value", 0))],
        ["Risk Score", f"{result.get('risk_score', 0):.1f}/100"],
        ["Maturity", f"{result.get('maturity_index', 0):.1f}/100"],
        ["DLOM (Liquidity Discount)", format_pct(dlom.get("dlom_pct", 0))],
        ["Survival (embedded in TV)", format_pct(survival.get("survival_rate", 0))],
    ]
    _build_premium_table(story, key_metrics)
    story.append(PageBreak())

    # ASSUMPTIONS (Prof+)
    if is_prof:
        _section_header(story, "Assumptions and Input Data", styles)
        story.append(Paragraph(
            "The parameters below were used as the basis for all valuation calculations "
            "presented in this report.", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        assumptions = [
            ["Parameter", "Value"],
            ["Revenue ($)", format_brl(params.get("revenue", 0))],
            ["Net Margin", format_pct(params.get("net_margin", 0))],
            ["EBIT Margin (calculated)", format_pct(params.get("ebit_margin", 0))],
            ["Reported Growth", format_pct(params.get("growth_rate", 0))],
            ["Debt ($)", format_brl(params.get("debt", 0))],
            ["Cash ($)", format_brl(params.get("cash", 0))],
            ["Founder Dependency", format_pct(params.get("founder_dependency", 0))],
            ["Projected Years", str(params.get("projection_years", 10))],
            ["Years in Operation", str(params.get("years_in_business", 3))],
            ["Recurring Revenue", format_pct(params.get("recurring_revenue_pct", 0))],
            ["Employees", str(params.get("num_employees", 0))],
            ["Risk-Free Rate (Rf)", format_pct(params.get("risk_free_rate", params.get("selic_rate", 0)))],
            ["Gordon Weight / Exit Multiple", f"{params.get('dcf_weight', 0.5)*100:.0f}% / {params.get('exit_weight', params.get('multiples_weight', 0.5))*100:.0f}%"],
            ["Data Source", params.get("data_source", "Damodaran/NYU")],
            ["Effective Rate (ETR)", format_pct(params.get("effective_tax_rate", 0.25))],
            ["Tax Regime", params.get("tax_regime", "\u2014").replace("_", " ").title()],
            ["Sector CapEx", format_pct(params.get("capex_ratio", 0.05))],
            ["Sector NWC", format_pct(params.get("nwc_ratio", 0.05))],
            ["Sector D&A", format_pct(params.get("depreciation_ratio", 0.03))],
        ]
        _build_premium_table(story, assumptions)
        story.append(PageBreak())

    # METHODOLOGY
    _section_header(story, "Valuation Methodology", styles)
    story.append(Paragraph("<b>FCFE/Ke Approach (Valuora)</b>", styles["SubSection"]))
    story.append(Paragraph(
        ""
        ""
        ""
        ""
        "This report uses the FCFE/Ke v7 methodology (Free Cash Flow to Equity / Cost of Equity), "
        "aligned with international best practices (Goldman Sachs, McKinsey, Big 4). "
        "Includes Mid-Year Convention, automatic ETR, 5-Factor Beta with dynamic CRP, "
        "competitive TV Fade, and Monte Carlo (2000 simulations). The weighting between Gordon and Exit Multiple is "
        "determined by the company's maturity stage:", styles["Body"]))

    methods = [
        ["Method", "Weight", "Description"],
        ["DCF Gordon Growth (LTG)", f"{params.get('dcf_weight', 0.5)*100:.0f}%", "FCFE projection + terminal value by perpetuity"],
        ["DCF Exit Multiple", f"{params.get('exit_weight', params.get('multiples_weight', 0.5))*100:.0f}%", "FCFE projection + terminal value by EV/EBITDA multiple"],
        ["Market Multiples", "Informational", "EV/Revenue and EV/EBITDA comparables (Damodaran) \u2014 not included in blend"],
    ]
    _build_wide_table(story, methods, col_widths=[130, 50, 270], accent_color=NAVY)
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("<b>Post-DCF Adjustments</b>", styles["SubSection"]))
    for a in [
        "DLOM \u2014 Discount for Lack of Marketability / illiquidity (12-35%)",
        "Qualitative Score \u2014 \u00b115% adjustment based on qualitative assessment (15 questions, 7 dimensions)",
    ]:
        story.append(Paragraph(f"  \u00b7  {a}", styles["BodySmall"]))

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("<b>Cost of Equity (Ke) \u2014 Valuora v7</b>", styles["SubSection"]))
    story.append(Paragraph(
        f"Ke calculated: <b>{format_pct(wacc_val)}</b>  |  "
        f"Beta unlevered ({analysis.sector}): <b>{result.get('beta_unlevered', 0):.2f}</b>  |  "
        f"Beta 5-factor: <b>{result.get('cost_of_equity_detail', {}).get('beta_5factor', result.get('beta_levered', 0)):.2f}</b>  |  "
        f"Beta relevered: <b>{result.get('beta_levered', 0):.2f}</b>", styles["Body"]))
    story.append(Paragraph(
        "Formula: Ke = Rf + \u03b2\u2085f \u00d7 (ERP + CRP) + Key-Person  |  "
        "\u03b2\u2085f includes leverage, size, sector, maturity, and liquidity (Dimson)", styles["BodySmall"]))
    story.append(PageBreak())

    # FCFE PROJECTION (Prof+)
    if is_prof and projections:
        _section_header(story, "Revenue and FCFE Projection", styles)
        story.append(Paragraph(
            "Projection of free cash flows to equity (FCFE) over the explicit period, "
            "basis for the present value calculation in the DCF model (direct Equity).", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        proj_header = ["Year", "Revenue", "Growth", "EBIT", "Net Inc.", "FCFE"]
        proj_rows = [proj_header]
        for p in projections:
            proj_rows.append([
                f"Year {p['year']}", format_brl(p["revenue"]), format_pct(p["growth_rate"]),
                format_brl(p["ebit"]), format_brl(p["nopat"]), format_brl(p["fcf"]),
            ])
        _build_wide_table(story, proj_rows, col_widths=[55, 85, 50, 85, 85, 85])
        story.append(Spacer(1, 6 * mm))
        _draw_bar_chart(story, projections, "Revenue vs FCFE")
        story.append(PageBreak())

    # P&L (Prof+)
    if is_prof and pnl:
        _section_header(story, "Projected P&L", styles)
        story.append(Paragraph(
            "Projected income statement based on growth and margin assumptions.", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        display_pnl = pnl[:min(len(pnl), 6)]
        pnl_header = [""] + [f"Year {p['year']}" for p in display_pnl]
        pnl_rows = [pnl_header]

        def _pnl_row(label, key, is_pct=False):
            row = [label]
            for p in display_pnl:
                row.append(format_pct(p[key]) if is_pct else format_brl(p[key]))
            return row

        pnl_rows.append(_pnl_row("Revenue", "revenue"))
        pnl_rows.append(_pnl_row("(-) COGS", "cogs"))
        pnl_rows.append(_pnl_row("Gross Profit", "gross_profit"))
        pnl_rows.append(_pnl_row("Gross Margin", "gross_margin", True))
        pnl_rows.append(_pnl_row("(-) Opex", "opex"))
        pnl_rows.append(_pnl_row("EBITDA", "ebitda"))
        pnl_rows.append(_pnl_row("EBITDA Margin", "ebitda_margin", True))
        pnl_rows.append(_pnl_row("(-) D&A", "depreciation"))
        pnl_rows.append(_pnl_row("EBIT", "ebit"))
        pnl_rows.append(_pnl_row("(-) Taxes", "taxes"))
        pnl_rows.append(_pnl_row("Net Income", "net_income"))
        pnl_rows.append(_pnl_row("Net Margin", "net_margin", True))

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
        story.append(Spacer(1, 6 * mm))
        # P3: EBITDA Mini Bar Chart
        _draw_ebitda_bars(story, display_pnl)
        story.append(PageBreak())

    # DCF GORDON GROWTH
    _section_header(story, "DCF \u2014 Gordon Growth Model", styles)
    story.append(Paragraph(
        "The Gordon model calculates the terminal value assuming that cash flows to equity grow "
        "at a constant rate (g) in perpetuity: TV = FCFE \u00d7 (1+g) / (Ke - g).", styles["Body"]))
    story.append(Spacer(1, 3 * mm))
    perp_g = tv_gordon.get("perpetuity_growth", 0.035)
    gordon_data = [
        ["Component", "Value"],
        ["Last Projected FCFE", format_brl(projections[-1]["fcf"] if projections else 0)],
        ["Perpetual Growth (g)", format_pct(perp_g)],
        ["Ke (Cost of Equity)", format_pct(wacc_val)],
        ["Terminal Value (Gordon)", format_brl(tv_gordon.get("terminal_value", 0))],
        ["PV of Terminal Value", format_brl(result.get("pv_terminal_value", 0))],
        ["PV of FCFEs", format_brl(result.get("pv_fcf_total", 0))],
        ["DCF Equity (Gordon)", format_brl(result.get("enterprise_value_gordon", 0))],
        ["Equity Value (Gordon)", format_brl(result.get("equity_value_gordon", 0))],
    ]
    _build_premium_table(story, gordon_data)
    for w in tv_gordon.get("warnings", []):
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(f"Warning: {w}", ParagraphStyle(
            "Warn", fontName="Helvetica-Bold", fontSize=8, textColor=AMBER, spaceAfter=3)))
    story.append(PageBreak())

    # EXIT MULTIPLE..SURVIVAL (Prof+)
    if is_prof:
        _section_header(story, "DCF \u2014 Exit Multiple", styles)
        story.append(Paragraph(
            "The Exit Multiple method calculates the terminal value by applying an EV/EBITDA multiple "
            "to the last projected year's EBITDA \u2014 preferred approach in M&A.", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        exit_data = [
            ["Component", "Value"],
            ["EBITDA Last Year", format_brl(pnl[-1]["ebitda"] if pnl else 0)],
            ["Exit Multiple (EV/EBITDA)", f"{tv_exit.get('exit_multiple', 0):.1f}x"],
            ["Terminal Value (Exit)", format_brl(tv_exit.get("terminal_value", 0))],
            ["DCF Equity (Exit)", format_brl(result.get("enterprise_value_exit", 0))],
            ["Equity Value (Exit)", format_brl(result.get("equity_value_exit_multiple", 0))],
        ]
        _build_premium_table(story, exit_data, accent_color=TEAL)
        story.append(PageBreak())

        # MULTIPLES
        _section_header(story, "Market Multiples Valuation (informational)", styles)
        story.append(Paragraph(
            f"Sector multiples for <b>{analysis.sector.capitalize()}</b> extracted from "
            f"Damodaran/NYU Stern. In the v4 FCFE/Ke model, multiples are <b>informational</b> "
            f"(they do not compose the final value).", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        mult_used = multiples_val.get("multiples_used", {})
        mult_data = [
            ["Method", "Multiple", "Estimated EV"],
            ["EV/Revenue", f"{mult_used.get('ev_revenue', 0):.1f}x", format_brl(multiples_val.get("ev_by_revenue", 0))],
            ["EV/EBITDA", f"{mult_used.get('ev_ebitda', 0):.1f}x", format_brl(multiples_val.get("ev_by_ebitda", 0))],
            ["Weighted Average", "\u2014", format_brl(multiples_val.get("ev_avg_multiples", 0))],
            ["Equity (Multiples)", "\u2014", format_brl(multiples_val.get("equity_avg_multiples", 0))],
        ]
        _build_wide_table(story, mult_data, col_widths=[150, 100, 200], accent_color=TEAL)
        story.append(Spacer(1, 6 * mm))
        # P2: EV Donut Chart
        _draw_ev_donut_chart(story, result)
        story.append(PageBreak())

        # TRIANGULATION
        _section_header(story, "Value Composition (Waterfall)", styles)
        story.append(Paragraph(
            f"The final value is composed by weighting between Gordon Growth and Exit Multiple methods "
            f"(weights defined by company maturity). Multiples are informational.", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        waterfall = result.get("waterfall", [])
        if waterfall:
            wf_rows = [["Component", "Value"]]
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
        story.append(Spacer(1, 6 * mm))
        _draw_waterfall_chart(story, waterfall)
        story.append(PageBreak())

        # DLOM
        _section_header(story, "Liquidity Discount (DLOM)", styles)
        story.append(Paragraph(
            "DLOM (Discount for Lack of Marketability) reflects the difficulty of selling an "
            "ownership stake in a private company compared to publicly listed shares.", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        dlom_data = [
            ["Component", "Value"],
            ["Base Discount", format_pct(dlom.get("base_discount", 0.20))],
            ["Size Adjustment", f"{dlom.get('size_adjustment', 0)*100:+.0f}%"],
            ["Maturity Adjustment", f"{dlom.get('maturity_adjustment', 0)*100:+.0f}%"],
            ["Sector Adjustment", f"{dlom.get('sector_adjustment', 0)*100:+.0f}%"],
            ["Sector Liquidity", dlom.get("sector_liquidity", "medium").capitalize()],
            ["DLOM Final", format_pct(dlom.get("dlom_pct", 0))],
        ]
        _build_premium_table(story, dlom_data)
        story.append(Spacer(1, 8 * mm))

        # SURVIVAL
        _section_header(story, "Survival (embedded in Terminal Value)", styles)
        story.append(Paragraph(
            "In the v7 FCFE/Ke model, the survival rate is embedded directly in the Terminal Value "
            "(TV \u00d7 rate). Data below is based on US Bureau of Labor Statistics (BLS).", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        surv_data = [
            ["Component", "Value"],
            ["Base Rate (sector/horizon)", format_pct(survival.get("base_rate", 0))],
            ["Horizon", survival.get("horizon", "5yr")],
            ["Age Bonus", f"+{survival.get('age_bonus', 0)*100:.0f}%"],
            ["Adjusted Rate", format_pct(survival.get("survival_rate", 0))],
        ]
        _build_premium_table(story, surv_data)
        story.append(PageBreak())

    # QUALITATIVE ASSESSMENT (Strategic)
    if is_strat:
        _section_header(story, "Qualitative Assessment", styles)
        if qual.get("has_data"):
            story.append(Paragraph(
                f"Qualitative Score: <b>{qual.get('score', 50):.0f}/100</b>  |  "
                f"Value Adjustment: <b>{qual.get('adjustment', 0)*100:+.1f}%</b>", styles["Body"]))
            story.append(Spacer(1, 3 * mm))
            dims = qual.get("dimensions", {})
            dim_labels = {
                "equipe": "Team", "governanca": "Governance", "mercado": "Market",
                "clientes": "Clients", "produto": "Product", "operacao": "Operations",
                "tracao": "Traction",
                # Legacy compat
                "financeiro": "Financial", "diferenciacao": "Differentiation",
                "escalabilidade": "Scalability",
            }
            if dims:
                dim_data = [["Dimension", "Score (1-5)"]]
                for k, v in dims.items():
                    dim_data.append([dim_labels.get(k, k.capitalize()), f"{v:.1f}"])
                _build_premium_table(story, dim_data)
                story.append(Spacer(1, 6 * mm))
                _draw_radar_chart(story, dims, dim_labels)
            obs = qual.get("observations", {})
            if obs:
                story.append(Spacer(1, 5 * mm))
                story.append(Paragraph("<b>Assessor Observations</b>", styles["SubSection"]))
                obs_labels = {
                    "equipe_num_fundadores": "Number of founders",
                    "equipe_dedicacao": "Founder dedication",
                    "equipe_experiencia": "Team experience",
                    "gov_profissional": "Professional management",
                    "gov_compliance": "Controls and compliance",
                    "mercado_posicao": "Market position",
                    "mercado_tendencia": "Sector trend",
                    "mercado_competicao": "Competition level",
                    "clientes_diversificacao": "Revenue diversification",
                    "clientes_recorrencia": "Recurring revenue",
                    "produto_moat": "Competitive advantage (moat)",
                    "produto_criticidade": "Product criticality",
                    "operacao_escalavel": "Operations scalability",
                    "operacao_automacao": "Operational automation",
                    "tracao_investimento": "External investment",
                    # Legacy keys
                    "mercado_lider": "Market position",
                    "financeiro_crescimento": "Revenue growth",
                    "financeiro_margens": "Margins vs sector",
                    "diferenciacao_moat": "Competitive advantage",
                    "escala_operacional": "Scalability",
                }
                for key, text in obs.items():
                    if text and text.strip():
                        label = obs_labels.get(key, key)
                        story.append(Paragraph(f"<b>{label}:</b> {text}", styles["BodySmall"]))
        else:
            story.append(Paragraph(
                "No qualitative assessment was completed. "
                "The score was kept neutral (50/100, no adjustment).", styles["Body"]))
        story.append(PageBreak())

    # SENSITIVITY + BENCHMARK (Prof+)
    if is_prof:
        _section_header(story, "Sensitivity Analysis", styles)
        story.append(Paragraph(
            "The table shows how the Equity Value varies according to changes in "
            "cost of equity (Ke) and growth rate.", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        sens = result.get("sensitivity_table", {})
        wacc_vals = sens.get("wacc_values", [])
        growth_vals = sens.get("growth_values", [])
        matrix = sens.get("equity_matrix", [])
        if wacc_vals and growth_vals and matrix:
            header = ["Ke \\ Growth"] + [f"{g:.1f}%" for g in growth_vals]
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
        # P1: Sensitivity Heatmap
        _draw_sensitivity_heatmap(story, sens, styles)
        story.append(PageBreak())

        # BENCHMARK
        _section_header(story, "Sector Benchmark", styles)
        sector_multiples = result.get("sector_multiples", {})
        ev_rev = result.get("enterprise_value", 0) / max(params.get("revenue", 1), 1)
        ev_rev_sector = sector_multiples.get("ev_revenue", 2.0)
        comp = "Above" if ev_rev > ev_rev_sector * 1.1 else "Below" if ev_rev < ev_rev_sector * 0.9 else "Average"
        bench_data = [
            ["Indicator", "Company", "Sector", "Position"],
            ["EV/Revenue", f"{ev_rev:.1f}x", f"{ev_rev_sector:.1f}x", comp],
            ["Beta Unlevered", f"{result.get('beta_levered', 0):.2f}", f"{result.get('beta_unlevered', 0):.2f}", "\u2014"],
            ["Percentile", f"{result.get('percentile', 0):.0f}%", "50%",
             f"{'Above' if result.get('percentile', 50) > 50 else 'Below'}"],
        ]
        _build_wide_table(story, bench_data, col_widths=[110, 100, 100, 140], accent_color=TEAL)
        story.append(Spacer(1, 5 * mm))
        story.append(PageBreak())

    # RISK + MATURITY
    _section_header(story, "Risk and Maturity", styles)
    risk_score = result.get("risk_score", 0)
    maturity_idx = result.get("maturity_index", 0)
    risk_label = "Low" if risk_score < 30 else "Moderate" if risk_score < 60 else "High" if risk_score < 80 else "Very High"
    mat_label = "Early Stage" if maturity_idx < 30 else "Developing" if maturity_idx < 50 else "Consolidated" if maturity_idx < 75 else "Mature"
    rm_data = [
        ["Indicator", "Score", "Classification"],
        ["Risk Score", f"{risk_score:.1f}/100", risk_label],
        ["Maturity", f"{maturity_idx:.1f}/100", mat_label],
        ["Market Percentile", f"{result.get('percentile', 0):.1f}%", "\u2014"],
    ]
    _build_wide_table(story, rm_data, col_widths=[160, 120, 170])

    # ── v7: Ke Detailed + ETR + CRP ────────────────────────
    if is_prof:
        story.append(Spacer(1, 6 * mm))
        _section_header(story, "Ke Detailed — Engine v7", styles)
        ke_detail = result.get("cost_of_equity_detail", {})
        tax_info = result.get("tax_info", {})
        ke_data = [
            ["Component", "Value"],
            ["Risk-Free Rate (10Y Treasury)", format_pct(ke_detail.get("risk_free_rate", 0))],
            ["Beta Unlevered (Sector)", f"{ke_detail.get('beta_unlevered', 0):.4f}"],
            ["Size Adjustment", f"{ke_detail.get('size_adj', 0):+.2f}"],
            ["Maturity Adjustment", f"{ke_detail.get('stage_adj', 0):+.2f}"],
            ["Profitability Adjustment", f"{ke_detail.get('profit_adj', 0):+.2f}"],
            ["Liquidity Adjustment (Dimson)", f"{ke_detail.get('liquidity_adj', 0):+.2f}"],
            ["Beta 5-Factor", f"{ke_detail.get('beta_5factor', 0):.4f}"],
            ["Levered Beta", f"{ke_detail.get('beta_levered', 0):.4f}"],
            ["ERP (US Base)", format_pct(ke_detail.get("erp_base", 0.065))],
            ["CRP (Country Risk)", f"{ke_detail.get('country_risk_premium', 0)*100:.1f}% ({ke_detail.get('crp_source', 'default')})"],
            ["Total Market Premium", format_pct(ke_detail.get("market_premium", 0))],
            ["Key-Person Premium", format_pct(ke_detail.get("key_person_premium", 0))],
            ["Ke Final", format_pct(ke_detail.get("cost_of_equity", 0))],
        ]
        _build_premium_table(story, ke_data)
        story.append(Spacer(1, 4 * mm))

        # ETR
        story.append(Paragraph("<b>Effective Tax Rate (ETR)</b>", styles["SubSection"]))
        regime_label = tax_info.get("regime", "—").replace("_", " ").title()
        etr_data = [
            ["Component", "Value"],
            ["Detected Regime", regime_label],
            ["Effective Rate (ETR)", format_pct(tax_info.get("effective_tax_rate", 0.34))],
            ["Nominal Rate (Corporate Income Tax)", format_pct(tax_info.get("nominal_rate", 0.34))],
            ["Savings vs Nominal", f"{(tax_info.get('nominal_rate', 0.34) - tax_info.get('effective_tax_rate', 0.34))*100:+.1f}pp"],
        ]
        _build_premium_table(story, etr_data, accent_color=TEAL)
        story.append(PageBreak())

    # ── v7: TV Fade ─────────────────────────────────────────
    if is_prof:
        tv_fade = result.get("tv_fade", {})
        if tv_fade:
            _section_header(story, "Terminal Value Fade (Competitive Convergence)", styles)
            story.append(Paragraph(
                "The terminal margin converges toward the sector average over time "
                "(McKinsey / Mauboussin Competitive Advantage Period). Younger companies "
                "lose advantages faster than consolidated ones.", styles["Body"]))
            story.append(Spacer(1, 3 * mm))
            fade_data = [
                ["Component", "Value"],
                ["Original Margin", format_pct(tv_fade.get("original_margin", 0))],
                ["Sector Average Margin", format_pct(tv_fade.get("sector_avg_margin", 0))],
                ["Competitive Retention", format_pct(tv_fade.get("retention", 0))],
                ["Terminal Margin (Faded)", format_pct(tv_fade.get("faded_margin", 0))],
                ["TV Impact", f"{tv_fade.get('fade_impact_pct', 0):+.2f} pp"],
            ]
            _build_premium_table(story, fade_data)
            story.append(Spacer(1, 4 * mm))

    # ── v7: Peer Comparison ─────────────────────────────────
    if is_prof:
        peers = result.get("peers", {})
        if peers:
            _section_header(story, "Peer Comparison", styles)
            story.append(Paragraph(
                "Cross-reference between DCF value and sector multiples — "
                "market validation (Damodaran / NYU Stern Emerging Markets).", styles["Body"]))
            story.append(Spacer(1, 3 * mm))
            ev_rev_peer = peers.get("ev_revenue", {})
            ev_ebitda_peer = peers.get("ev_ebitda", {})
            dcf_peers = peers.get("dcf_vs_peers", {})
            peer_data = [
                ["Method", "Multiple", "Value", "P25 — P75"],
                ["EV/Revenue", f"{ev_rev_peer.get('multiple', 0):.1f}x",
                 format_brl(ev_rev_peer.get('value', 0)),
                 f"{format_brl(ev_rev_peer.get('p25', 0))} — {format_brl(ev_rev_peer.get('p75', 0))}"],
                ["EV/EBITDA", f"{ev_ebitda_peer.get('multiple', 0):.1f}x",
                 format_brl(ev_ebitda_peer.get('value', 0)),
                 f"{format_brl(ev_ebitda_peer.get('p25', 0))} — {format_brl(ev_ebitda_peer.get('p75', 0))}"],
                ["DCF vs Peers", "—",
                 format_brl(dcf_peers.get('dcf_value', 0)),
                 f"{dcf_peers.get('premium_discount_pct', 0):+.1f}% ({dcf_peers.get('assessment', '—')})"],
            ]
            _build_wide_table(story, peer_data, col_widths=[85, 60, 120, 185], accent_color=TEAL)
            story.append(Spacer(1, 4 * mm))

    # ── v7: Control Premium ─────────────────────────────────
    if is_prof:
        control = result.get("control_premium", {})
        if control and control.get("full_control_100pct", 0) > 0:
            _section_header(story, "Control Premium / Minority Discount", styles)
            story.append(Paragraph(
                "How much the ownership stake is worth based on the percentage of control acquired. "
                "Source: Mergerstat Review / Houlihan Lokey Control Premium Studies.", styles["Body"]))
            story.append(Spacer(1, 3 * mm))
            ctrl_data = [
                ["Ownership", "Value"],
                ["100% (Full Control)", format_brl(control.get("full_control_100pct", 0))],
                ["51% (Majority)", format_brl(control.get("majority_51pct", 0))],
                ["33% (Significant)", format_brl(control.get("significant_33pct", 0))],
                ["25% (Minority)", format_brl(control.get("minority_25pct", 0))],
                ["10% (Minority)", format_brl(control.get("minority_10pct", 0))],
                ["5% (Minority)", format_brl(control.get("minority_5pct", 0))],
            ]
            _build_premium_table(story, ctrl_data)
            story.append(Spacer(1, 4 * mm))

    # ── v7: Monte Carlo Simulation ──────────────────────────
    if is_strat:
        mc = result.get("monte_carlo", {})
        if mc and mc.get("n_simulations", 0) > 0:
            _section_header(story, "Monte Carlo Simulation", styles)
            story.append(Paragraph(
                f"Probabilistic distribution of equity value with {mc.get('n_simulations', 2000):,} simulations. "
                "Varies growth (±30%), margin (±20%) and Ke (±15%) with Gaussian distribution. "
                "Source: McKinsey / Goldman Sachs quantitative valuation methodology.", styles["Body"]))
            story.append(Spacer(1, 3 * mm))
            mc_data = [
                ["Percentile", "Value"],
                ["P5 (Conservative)", format_brl(mc.get("p5", 0))],
                ["P10", format_brl(mc.get("p10", 0))],
                ["P25", format_brl(mc.get("p25", 0))],
                ["P50 (Median)", format_brl(mc.get("p50", 0))],
                ["P75", format_brl(mc.get("p75", 0))],
                ["P90", format_brl(mc.get("p90", 0))],
                ["P95 (Optimistic)", format_brl(mc.get("p95", 0))],
                ["Mean", format_brl(mc.get("mean", 0))],
                ["Standard Deviation", format_brl(mc.get("std_dev", 0))],
            ]
            _build_premium_table(story, mc_data, accent_color=NAVY)
            story.append(Spacer(1, 4 * mm))
            story.append(PageBreak())

    # TORNADO CHART (Strategic)
    if is_strat:
        _section_header(story, "Tornado Chart \u2014 Value Drivers", styles)
        story.append(Paragraph(
            "Impact of each key variable on equity value — pessimistic vs optimistic scenario. "
            "The longest bars identify where to focus to maximize company value.",
            styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        _draw_tornado_chart(story, result, params, styles)
        story.append(PageBreak())

    story.append(PageBreak())

    # INVESTMENT ROUND (Strategic)
    if is_strat:
        _section_header(story, "Investment Round Simulation", styles)
        story.append(Paragraph(
            "Simulation based on the estimated equity value as pre-money valuation, "
            "projecting an investment fundraising scenario.", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        round_data = [
            ["Parameter", "Value"],
            ["Pre-Money Valuation", format_brl(inv_round.get("pre_money_valuation", 0))],
            ["Investment (simulation)", format_brl(inv_round.get("investment_amount", 0))],
            ["Post-Money Valuation", format_brl(inv_round.get("post_money_valuation", 0))],
            ["Dilution", f"{inv_round.get('dilution_pct', 0):.1f}%"],
            ["Founder Equity", f"{inv_round.get('founder_equity_pct', 0):.1f}%"],
            ["Investor Equity", f"{inv_round.get('investor_equity_pct', 0):.1f}%"],
            ["Price per 1%", format_brl(inv_round.get("price_per_1pct", 0))],
        ]
        _build_premium_table(story, round_data)
        story.append(PageBreak())

    # EXIT STRATEGY (Strategic)
    if is_strat:
        _section_header(story, "Exit Strategy Analysis", styles)
        story.append(Paragraph(
            "Analysis of ideal exit timing, strategic vs financial buyer profile, "
            "sector M&A multiples and maximum value window based on the maturity cycle.",
            styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        _build_exit_strategy_section(story, result, params, analysis, styles)
        story.append(PageBreak())

    # RISK MATRIX (Strategic)
    if is_strat:
        _section_header(story, "Structured Risk Matrix", styles)
        story.append(Paragraph(
            "Mapping of key business risks with probability, impact and mitigators "
            "— M&A/due diligence language. Prob. \u00d7 Impact: HIGH \u2265 15 · MEDIUM \u2265 8 · LOW < 8.",
            styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        _build_risk_matrix_section(story, result, params, analysis, styles)
        story.append(PageBreak())

    # VALUE INCREASE PLAN (Strategic)
    if is_strat:
        _section_header(story, "Value Increase Plan", styles)
        story.append(Paragraph(
            "Quantified roadmap of actions to increase equity value. Each action includes "
            "the current situation, suggested target and estimated impact on equity value.",
            styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        _build_value_increase_plan(story, result, params, analysis, styles)
        story.append(PageBreak())

    # AI ANALYSIS (Strategic)
    if is_strat and analysis.ai_analysis:
        _section_header(story, "Strategic Analysis (AI)", styles)
        story.append(Paragraph(
            "Analysis generated by artificial intelligence based on financial data "
            "and valuation results.", ParagraphStyle(
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

    # OPINION LETTER (Strategic)
    if is_strat:
        _section_header(story, "Value Opinion Letter", styles)
        story.append(Paragraph(
            "Formal value opinion document issued by Valuora with "
            "investment advisory language — intended for fundraising, M&A and corporate planning processes.",
            styles["Body"]))
        story.append(Spacer(1, 4 * mm))
        _build_opinion_letter(story, result, params, analysis, styles, report_id, timestamp)
        story.append(PageBreak())

    # GLOSSARY
    _section_header(story, "Glossary", styles)
    glossary = [
        ("DCF", "Discounted Cash Flow \u2014 valuation method that discounts future cash flows to present value."),
        ("Ke", "Cost of Equity \u2014 required rate of return by the shareholder, used as the discount rate in the FCFE model."),
        ("FCFE", "Free Cash Flow to Equity \u2014 free cash flow available to the shareholder after debt service."),
        ("Terminal Value", "Present value of cash flows beyond the explicit projection period."),
        ("Gordon Growth", "Perpetuity model with constant growth to calculate terminal value."),
        ("Exit Multiple", "Method that applies a multiple (EV/EBITDA) to the last projected year's EBITDA."),
        ("EBITDA", "Earnings before interest, taxes, depreciation and amortization."),
        ("EV/Revenue", "Enterprise Value divided by revenue \u2014 revenue-based valuation multiple."),
        ("EV/EBITDA", "Enterprise Value divided by EBITDA \u2014 operational valuation multiple."),
        ("DLOM", "Discount for Lack of Marketability \u2014 discount for lack of liquidity of a private company."),
        ("Beta 5-Factor", "Valuora risk measure that incorporates sector, size, maturity, profitability and liquidity (Dimson)."),
        ("CRP", "Country Risk Premium \u2014 additional return required for investing in a specific country, sourced from Damodaran/NYU."),
        ("ETR", "Effective Tax Rate \u2014 effective tax rate considering the applicable tax regime."),
        ("Mid-Year Convention", "Convention that discounts flows at mid-year (t-0.5) instead of year-end, Goldman Sachs / Big 4 standard."),
        ("TV Fade", "Competitive convergence \u2014 terminal margin converges toward the sector average (McKinsey/Mauboussin)."),
        ("Monte Carlo", "Stochastic simulation with random parameter variation to generate probabilistic value distribution."),
        ("Control Premium", "Value adjustment based on the percentage of ownership acquired (Mergerstat/Houlihan Lokey)."),
        ("Peer Comparison", "DCF comparison with sector multiples (market validation cross-reference)."),
        ("Net Income", "After-tax result \u2014 basis for FCFE calculation in the v7 model."),
        ("Pre-Money", "Estimated value of the company before receiving an investment."),
        ("Post-Money", "Company value after the investment (pre-money + investment)."),
        ("Dilution", "Percentage reduction in original partners' ownership after investment."),
    ]
    for term, definition in glossary:
        story.append(Paragraph(term, styles["GlossaryTerm"]))
        story.append(Paragraph(definition, styles["GlossaryDef"]))
    story.append(PageBreak())

    # DISCLAIMER
    _section_header(story, "Legal Disclaimer", styles)
    disclaimer_paras = [
        "This report was generated by the Valuora platform for informational and educational "
        "purposes only. The values presented are estimates based on the FCFE/Ke v7.0 (Valuora) "
        "methodology with DCF Gordon Growth and Exit Multiple, DLOM adjustment, "
        "Monte Carlo (2000 simulations), competitive TV Fade and Mid-Year Convention.",
        "Sector data (5-factor betas, multiples, NWC, CapEx, D&A) are derived from Aswath Damodaran (NYU Stern). "
        "The risk-free rate uses the US 10-Year Treasury yield (FRED). "
        "Survival statistics are from the US Bureau of Labor Statistics (BLS).",
        "This document does NOT constitute an investment recommendation, offer to buy or sell "
        "equity stakes, nor does it replace a formal valuation performed by a qualified professional.",
        "Results depend directly on the quality and accuracy of the input data. Financial "
        "projections are, by nature, uncertain and may differ significantly from actual results.",
        "Valuora is not responsible for decisions made based on this report. "
        "We recommend consulting a qualified financial advisor before making relevant decisions.",
        "All rights reserved. Valuora \u00a9 2026.",
    ]
    for para in disclaimer_paras:
        story.append(Paragraph(para, styles["Disclaimer"]))
        story.append(Spacer(1, 2 * mm))

    story.append(Spacer(1, 12 * mm))
    story.append(HRFlowable(width="30%", thickness=0.5, color=EMERALD, spaceAfter=8))
    story.append(Paragraph(f"Report #{report_id}  \u00b7  {timestamp}", styles["Footer"]))
    story.append(Paragraph("valuora.online", styles["Footer"]))

    doc.build(story, onFirstPage=_cover_page, onLaterPages=_premium_footer)
    return filepath
