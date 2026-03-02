"""
Quanto Vale \u2014 PDF Report Generator v4
Relat\u00f3rio premium, design executivo, tema esmeralda/navy.
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
EMERALD = HexColor("#10b981")        # emerald-500 — brand green claro
EMERALD_DARK = HexColor("#059669")    # emerald-600
EMERALD_BRIGHT = HexColor("#34d399")  # emerald-400 — destaques/charts
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
    # Gradient-like double line footer
    canvas.setStrokeColor(EMERALD)
    canvas.setLineWidth(2)
    canvas.line(2.5 * cm, 21 * mm, w - 2.5 * cm, 21 * mm)
    canvas.setStrokeColor(EMERALD_LIGHT)
    canvas.setLineWidth(0.5)
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
    canvas.setFillColor(NAVY_MID)
    canvas.rect(0, 0, w, 28 * mm, fill=1, stroke=0)
    canvas.setFillColor(EMERALD)
    canvas.rect(0, 0, w, 3 * mm, fill=1, stroke=0)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(EMERALD_BRIGHT)
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

def _draw_bar_chart(story, projections, title="Projeção de Receita e FCFE"):
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
            label = f"R${label_val/1_000_000:.1f}M"
        elif label_val >= 1_000:
            label = f"R${label_val/1_000:.0f}K"
        else:
            label = f"R${label_val:.0f}"
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
        d.add(String(x_center - 10, margin_b - 12, f"Ano {p.get('year', i+1)}",
                      fontName="Helvetica", fontSize=6.5, fillColor=GRAY_600))

    # Legend
    lx = margin_l
    d.add(Rect(lx, H + 5, 8, 8, fillColor=EMERALD, strokeColor=None, strokeWidth=0))
    d.add(String(lx + 11, H + 5, "Receita", fontName="Helvetica", fontSize=7, fillColor=GRAY_600))
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

    d.add(String(0, H + 2, "Composição do Equity Value", fontName="Helvetica-Bold", fontSize=9, fillColor=NAVY))

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

    d.add(String(0, H + 2, "Avaliação Qualitativa — Radar", fontName="Helvetica-Bold", fontSize=9, fillColor=NAVY))

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
    d.add(String(margin + 5, bar_y - 12, "Conservador",
                  fontName="Helvetica", fontSize=6, fillColor=GRAY_500))
    d.add(String(mid_x - 8, bar_y - 12, "Base",
                  fontName="Helvetica-Bold", fontSize=6, fillColor=GRAY_700))
    d.add(String(margin + bar_w - 35, bar_y - 12, "Otimista",
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

    d.add(String(0, H - 5, "Sensibilidade: Ke × Crescimento (Heatmap)",
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
    d.add(String(0, H + 2, "Composição do Valor por DCF",
                  fontName="Helvetica-Bold", fontSize=9, fillColor=NAVY))

    cx, cy = 90, H / 2 - 5
    outer_r = 60
    inner_r = 35

    slices = [
        ("DCF Gordon", ev_gordon / total * 100, EMERALD),
        ("DCF Exit", ev_exit / total * 100, TEAL),
        ("Múltiplos", ev_mult / total * 100, HexColor("#8b5cf6")),
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
    d.add(String(0, H + 12, "EBITDA por Ano",
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
        d.add(String(x + bar_w/2 - 8, margin_b - 12, f"Ano {p.get('year', i+1)}",
                      fontName="Helvetica", fontSize=6, fillColor=GRAY_600))

    story.append(d)
    story.append(Spacer(1, 4 * mm))


def _build_infographic_page(story, analysis, result, styles):
    """P5: Visual infographic summary page with 8 key numbers in card layout."""
    story.append(Spacer(1, 5 * mm))
    bar = HRFlowable(width="100%", thickness=3, color=EMERALD, spaceAfter=0, spaceBefore=0)
    story.append(bar)
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("Visão Geral — Infográfico", styles["SectionTitle"]))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        f"Resumo visual dos principais indicadores de <b>{analysis.company_name}</b>.",
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
        ("Equity Value", format_brl(equity), EMERALD, "Valor do patrimônio após ajustes"),
        ("Valor por DCF", format_brl(ev), TEAL, "VP dos FCFEs + VP terminal"),
        ("Receita Anual", format_brl(params.get("revenue", 0)), HexColor("#3b82f6"), "Receita informada"),
        ("Ke (Custo Capital)", format_pct(wacc_val), HexColor("#8b5cf6"), "Custo de capital próprio (QuantoVale)"),
        ("Score de Risco", f"{risk:.0f}/100", RED if risk > 60 else AMBER if risk > 30 else GREEN, "Quanto menor, melhor"),
        ("Maturidade", f"{maturity:.0f}/100", EMERALD if maturity > 60 else AMBER, "Nível de desenvolvimento"),
        ("DLOM", format_pct(dlom_pct), AMBER, "Desconto de liquidez"),
        ("Sobrevivência", format_pct(survival_rate), GREEN if survival_rate and survival_rate > 0.7 else AMBER, "Embutida no Valor Terminal"),
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
        f'Percentil de mercado: <b>{percentile:.0f}%</b> — '
        f'Setor: <b>{analysis.sector.capitalize()}</b> — '
        f'Margem: <b>{format_pct(params.get("net_margin", 0))}</b> — '
        f'Crescimento: <b>{format_pct(params.get("growth_rate", 0))}</b>',
        ParagraphStyle("InfoFooter", fontName="Helvetica", fontSize=8,
                       textColor=GRAY_600, alignment=TA_CENTER, leading=14)))
    story.append(PageBreak())


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
        title=f"Relatório de Valuation — {analysis.company_name}",
        author="Quanto Vale · quantovale.online",
        subject="Valuation Empresarial — Quanto Vale",
        creator="Quanto Vale (quantovale.online)",
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
        "Metodologia: DCF FCFE/Ke v5 (Gordon + Exit Multiple) + M\u00faltiplos Damodaran",
        "Fontes: Damodaran/NYU  \u00b7  BCB/Selic  \u00b7  BCB/EMBI+  \u00b7  IBGE/SIDRA",
        "Motor: QuantoVale Engine v5.0 \u2014 10 melhorias institucionais",
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
        toc_items += ["Proje\u00e7\u00e3o de Receita e FCFE", "DRE Projetado (P&L)"]
    toc_items.append("DCF \u2014 Gordon Growth Model")
    if is_prof:
        toc_items += ["DCF \u2014 Exit Multiple", "M\u00faltiplos de Mercado (informativos)", "Composi\u00e7\u00e3o do Valor (Waterfall)"]
        toc_items += ["Desconto de Liquidez (DLOM)", "Sobreviv\u00eancia (embutida no TV)"]
    if is_strat:
        toc_items.append("Avalia\u00e7\u00e3o Qualitativa")
    if is_prof:
        toc_items += ["An\u00e1lise de Sensibilidade", "Benchmark Setorial"]
    toc_items.append("Risco e Maturidade")
    if is_prof:
        toc_items += ["Ke Detalhado \u2014 Motor v5", "TV Fade (Converg\u00eancia)", "Compara\u00e7\u00e3o com Pares", "Pr\u00eamio de Controle"]
    if is_strat:
        toc_items.append("Simula\u00e7\u00e3o Monte Carlo")
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

    # INFOGRAPHIC PAGE (P5) — before detailed content
    if is_prof:
        _build_infographic_page(story, analysis, result, styles)

    # RESUMO EXECUTIVO
    _section_header(story, "Resumo Executivo", styles)
    equity = result.get("equity_value", 0)
    val_range = result.get("valuation_range", {})

    _value_card(story, format_brl(equity), "Valor Estimado do Equity (ap\u00f3s todos os ajustes)", styles)
    story.append(Spacer(1, 4 * mm))

    # Key insights callout
    risk_score = result.get("risk_score", 0)
    maturity_idx = result.get("maturity_index", 0)
    qual_adj = qual.get("adjustment_pct", 0) if qual else 0
    dlom_pct = dlom.get("dlom_pct", 0) if dlom else 0
    insights = [
        f"Receita anual de {format_brl(params.get('revenue', 0))} com margem l\u00edquida de {format_pct(params.get('net_margin', 0))}",
        f"Score de risco {risk_score:.0f}/100 \u00b7 \u00cdndice de maturidade {maturity_idx:.0f}/100",
        f"Desconto de liquidez (DLOM) de {format_pct(dlom_pct)} aplicado ao valor final",
    ]
    if qual_adj:
        sign = "+" if qual_adj >= 0 else ""
        answers_count = len(qual.get("answers", {})) if qual else 0
        insights.append(f"Ajuste qualitativo de {sign}{format_pct(qual_adj)} baseado nas {answers_count} respostas")
    _callout_box(story, "DESTAQUES EXECUTIVOS", insights)
    story.append(Spacer(1, 2 * mm))

    _draw_scenario_bar(story, val_range, equity)
    story.append(Spacer(1, 4 * mm))
    _scenario_table(story, val_range, styles)
    story.append(Spacer(1, 8 * mm))

    key_metrics = [
        ["Indicador", "Valor"],
        ["Receita Anual", format_brl(params.get("revenue", 0))],
        ["Margem L\u00edquida", format_pct(params.get("net_margin", 0))],
        ["Crescimento", format_pct(params.get("growth_rate", 0))],
        ["Ke (Custo de Capital Próprio)", format_pct(wacc_val)],
        ["Valor por DCF", format_brl(result.get("enterprise_value", 0))],
        ["Score de Risco", f"{result.get('risk_score', 0):.1f}/100"],
        ["Maturidade", f"{result.get('maturity_index', 0):.1f}/100"],
        ["DLOM (Desconto Liquidez)", format_pct(dlom.get("dlom_pct", 0))],
        ["Sobreviv\u00eancia (embutida no TV)", format_pct(survival.get("survival_rate", 0))],
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
            ["Anos Projetados", str(params.get("projection_years", 10))],
            ["Anos de Opera\u00e7\u00e3o", str(params.get("years_in_business", 3))],
            ["Receita Recorrente", format_pct(params.get("recurring_revenue_pct", 0))],
            ["Funcion\u00e1rios", str(params.get("num_employees", 0))],
            ["Taxa Selic (Rf)", format_pct(params.get("selic_rate", 0))],
            ["Peso Gordon / Exit Multiple", f"{params.get('dcf_weight', 0.5)*100:.0f}% / {params.get('exit_weight', params.get('multiples_weight', 0.5))*100:.0f}%"],
            ["Fonte de Dados", params.get("data_source", "Damodaran/NYU")],
            ["Taxa Efetiva (ETR)", format_pct(params.get("effective_tax_rate", 0.34))],
            ["Regime Tribut\u00e1rio", params.get("tax_regime", "\u2014").replace("_", " ").title()],
            ["CapEx Setorial", format_pct(params.get("capex_ratio", 0.05))],
            ["NWC Setorial", format_pct(params.get("nwc_ratio", 0.05))],
            ["D&A Setorial", format_pct(params.get("depreciation_ratio", 0.03))],
        ]
        _build_premium_table(story, premissas)
        story.append(PageBreak())

    # METODOLOGIA
    _section_header(story, "Metodologia de Valuation", styles)
    story.append(Paragraph("<b>Abordagem FCFE/Ke (QuantoVale)</b>", styles["SubSection"]))
    story.append(Paragraph(
        "Este relat\u00f3rio utiliza a metodologia FCFE/Ke v5 (Free Cash Flow to Equity / Custo de Capital Pr\u00f3prio), "
        "alinhada com as melhores pr\u00e1ticas internacionais (Goldman Sachs, McKinsey, Big 4). "
        "Inclui Mid-Year Convention, ETR autom\u00e1tico, Beta 5-fatores com CRP din\u00e2mico, "
        "TV Fade competitivo e Monte Carlo (2000 simula\u00e7\u00f5es). A pondera\u00e7\u00e3o entre Gordon e Exit Multiple \u00e9 "
        "determinada pelo est\u00e1gio de maturidade da empresa:", styles["Body"]))

    methods = [
        ["M\u00e9todo", "Peso", "Descri\u00e7\u00e3o"],
        ["DCF Gordon Growth (LTG)", f"{params.get('dcf_weight', 0.5)*100:.0f}%", "Proje\u00e7\u00e3o de FCFE + valor terminal por perpetuidade"],
        ["DCF Exit Multiple", f"{params.get('exit_weight', params.get('multiples_weight', 0.5))*100:.0f}%", "Proje\u00e7\u00e3o de FCFE + valor terminal por m\u00faltiplo EV/EBITDA"],
        ["M\u00faltiplos de Mercado", "Informativo", "EV/Receita e EV/EBITDA compar\u00e1veis (Damodaran) \u2014 n\u00e3o entra no blend"],
    ]
    _build_wide_table(story, methods, col_widths=[130, 50, 270], accent_color=NAVY)
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("<b>Ajustes P\u00f3s-DCF</b>", styles["SubSection"]))
    for a in [
        "DLOM \u2014 Desconto por falta de liquidez / iliquidez (12-35%)",
        "Score Qualitativo \u2014 Ajuste \u00b115% baseado em avalia\u00e7\u00e3o qualitativa (15 perguntas, 7 dimens\u00f5es)",
    ]:
        story.append(Paragraph(f"  \u00b7  {a}", styles["BodySmall"]))

    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("<b>Custo de Capital Pr\u00f3prio (Ke) \u2014 QuantoVale v5</b>", styles["SubSection"]))
    story.append(Paragraph(
        f"Ke calculado: <b>{format_pct(wacc_val)}</b>  |  "
        f"Beta unlevered ({analysis.sector}): <b>{result.get('beta_unlevered', 0):.2f}</b>  |  "
        f"Beta 5-fatores: <b>{result.get('cost_of_equity_detail', {}).get('beta_5factor', result.get('beta_levered', 0)):.2f}</b>  |  "
        f"Beta relevered: <b>{result.get('beta_levered', 0):.2f}</b>", styles["Body"]))
    story.append(Paragraph(
        "F\u00f3rmula: Ke = Rf + \u03b2\u2085f \u00d7 (ERP + CRP) + Key-Person  |  "
        "\u03b2\u2085f inclui alavancagem, tamanho, setor, maturidade e liquidez (Dimson)", styles["BodySmall"]))
    story.append(PageBreak())

    # PROJECAO FCFE (Prof+)
    if is_prof and projections:
        _section_header(story, "Proje\u00e7\u00e3o de Receita e FCFE", styles)
        story.append(Paragraph(
            "Proje\u00e7\u00e3o dos fluxos de caixa livres ao acionista (FCFE) ao longo do per\u00edodo expl\u00edcito, "
            "base para o c\u00e1lculo do valor presente no modelo DCF (Equity direto).", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        proj_header = ["Ano", "Receita", "Cresc.", "EBIT", "Lucro L\u00edq.", "FCFE"]
        proj_rows = [proj_header]
        for p in projections:
            proj_rows.append([
                f"Ano {p['year']}", format_brl(p["revenue"]), format_pct(p["growth_rate"]),
                format_brl(p["ebit"]), format_brl(p["nopat"]), format_brl(p["fcf"]),
            ])
        _build_wide_table(story, proj_rows, col_widths=[55, 85, 50, 85, 85, 85])
        story.append(Spacer(1, 6 * mm))
        _draw_bar_chart(story, projections, "Receita vs FCFE")
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
        story.append(Spacer(1, 6 * mm))
        # P3: EBITDA Mini Bar Chart
        _draw_ebitda_bars(story, display_pnl)
        story.append(PageBreak())

    # DCF GORDON GROWTH
    _section_header(story, "DCF \u2014 Gordon Growth Model", styles)
    story.append(Paragraph(
        "O modelo de Gordon calcula o valor terminal assumindo que os fluxos de caixa ao acionista crescem "
        "a uma taxa constante (g) na perpetuidade: TV = FCFE \u00d7 (1+g) / (Ke - g).", styles["Body"]))
    story.append(Spacer(1, 3 * mm))
    perp_g = tv_gordon.get("perpetuity_growth", 0.035)
    gordon_data = [
        ["Componente", "Valor"],
        ["\u00daltimo FCFE Projetado", format_brl(projections[-1]["fcf"] if projections else 0)],
        ["Crescimento Perp\u00e9tuo (g)", format_pct(perp_g)],
        ["Ke (Custo de Capital Pr\u00f3prio)", format_pct(wacc_val)],
        ["Valor Terminal (Gordon)", format_brl(tv_gordon.get("terminal_value", 0))],
        ["VP do Valor Terminal", format_brl(result.get("pv_terminal_value", 0))],
        ["VP dos FCFEs", format_brl(result.get("pv_fcf_total", 0))],
        ["DCF Equity (Gordon)", format_brl(result.get("enterprise_value_gordon", 0))],
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
            ["DCF Equity (Exit)", format_brl(result.get("enterprise_value_exit", 0))],
            ["Equity Value (Exit)", format_brl(result.get("equity_value_exit_multiple", 0))],
        ]
        _build_premium_table(story, exit_data, accent_color=TEAL)
        story.append(PageBreak())

        # MULTIPLOS
        _section_header(story, "Valuation por M\u00faltiplos de Mercado (informativos)", styles)
        story.append(Paragraph(
            f"M\u00faltiplos setoriais de <b>{analysis.sector.capitalize()}</b> extra\u00eddos de "
            f"Damodaran/NYU Stern. No modelo v4 FCFE/Ke, m\u00faltiplos s\u00e3o <b>informativos</b> "
            f"(n\u00e3o comp\u00f5em o valor final).", styles["Body"]))
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
        story.append(Spacer(1, 6 * mm))
        # P2: EV Donut Chart
        _draw_ev_donut_chart(story, result)
        story.append(PageBreak())

        # TRIANGULACAO
        _section_header(story, "Composi\u00e7\u00e3o do Valor (Waterfall)", styles)
        story.append(Paragraph(
            f"O valor final \u00e9 composto pela pondera\u00e7\u00e3o entre os m\u00e9todos Gordon Growth e Exit Multiple "
            f"(pesos definidos pela maturidade da empresa). M\u00faltiplos s\u00e3o informativos.", styles["Body"]))
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
        story.append(Spacer(1, 6 * mm))
        _draw_waterfall_chart(story, waterfall)
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
        _section_header(story, "Sobreviv\u00eancia (embutida no Valor Terminal)", styles)
        story.append(Paragraph(
            "No modelo v5 FCFE/Ke, a taxa de sobreviv\u00eancia \u00e9 embutida diretamente no Valor Terminal "
            "(TV \u00d7 taxa). Os dados abaixo s\u00e3o baseados em SEBRAE/IBGE.", styles["Body"]))
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
                "equipe": "Equipe", "governanca": "Governan\u00e7a", "mercado": "Mercado",
                "clientes": "Clientes", "produto": "Produto", "operacao": "Opera\u00e7\u00e3o",
                "tracao": "Tra\u00e7\u00e3o",
                # Legacy compat
                "financeiro": "Financeiro", "diferenciacao": "Diferencia\u00e7\u00e3o",
                "escalabilidade": "Escalabilidade",
            }
            if dims:
                dim_data = [["Dimens\u00e3o", "Score (1-5)"]]
                for k, v in dims.items():
                    dim_data.append([dim_labels.get(k, k.capitalize()), f"{v:.1f}"])
                _build_premium_table(story, dim_data)
                story.append(Spacer(1, 6 * mm))
                _draw_radar_chart(story, dims, dim_labels)
            obs = qual.get("observations", {})
            if obs:
                story.append(Spacer(1, 5 * mm))
                story.append(Paragraph("<b>Observa\u00e7\u00f5es do Avaliador</b>", styles["SubSection"]))
                obs_labels = {
                    "equipe_num_fundadores": "N\u00famero de fundadores",
                    "equipe_dedicacao": "Dedica\u00e7\u00e3o dos fundadores",
                    "equipe_experiencia": "Experi\u00eancia da equipe",
                    "gov_profissional": "Gest\u00e3o profissionalizada",
                    "gov_compliance": "Controles e compliance",
                    "mercado_posicao": "Posi\u00e7\u00e3o de mercado",
                    "mercado_tendencia": "Tend\u00eancia do setor",
                    "mercado_competicao": "N\u00edvel de competi\u00e7\u00e3o",
                    "clientes_diversificacao": "Diversifica\u00e7\u00e3o de receita",
                    "clientes_recorrencia": "Receita recorrente",
                    "produto_moat": "Diferencial competitivo (moat)",
                    "produto_criticidade": "Criticidade do produto",
                    "operacao_escalavel": "Escalabilidade da opera\u00e7\u00e3o",
                    "operacao_automacao": "Automa\u00e7\u00e3o operacional",
                    "tracao_investimento": "Investimento externo",
                    # Legacy keys
                    "mercado_lider": "Posi\u00e7\u00e3o de mercado",
                    "financeiro_crescimento": "Crescimento do faturamento",
                    "financeiro_margens": "Margens vs setor",
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
            "A tabela mostra como o Equity Value varia conforme mudan\u00e7as no "
            "custo de capital pr\u00f3prio (Ke) e na taxa de crescimento.", styles["Body"]))
        story.append(Spacer(1, 3 * mm))
        sens = result.get("sensitivity_table", {})
        wacc_vals = sens.get("wacc_values", [])
        growth_vals = sens.get("growth_values", [])
        matrix = sens.get("equity_matrix", [])
        if wacc_vals and growth_vals and matrix:
            header = ["Ke \\ Cresc."] + [f"{g:.1f}%" for g in growth_vals]
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

    # ── v5: Ke Detalhado + ETR + CRP ────────────────────────
    if is_prof:
        story.append(Spacer(1, 6 * mm))
        _section_header(story, "Ke Detalhado — Motor v5", styles)
        ke_detail = result.get("cost_of_equity_detail", {})
        tax_info = result.get("tax_info", {})
        ke_data = [
            ["Componente", "Valor"],
            ["Taxa Livre de Risco (Selic)", format_pct(ke_detail.get("risk_free_rate", 0))],
            ["Beta Unlevered (Setor)", f"{ke_detail.get('beta_unlevered', 0):.4f}"],
            ["Ajuste Porte", f"{ke_detail.get('size_adj', 0):+.2f}"],
            ["Ajuste Maturidade", f"{ke_detail.get('stage_adj', 0):+.2f}"],
            ["Ajuste Rentabilidade", f"{ke_detail.get('profit_adj', 0):+.2f}"],
            ["Ajuste Liquidez (Dimson)", f"{ke_detail.get('liquidity_adj', 0):+.2f}"],
            ["Beta 5-Fatores", f"{ke_detail.get('beta_5factor', 0):.4f}"],
            ["Beta Alavancado", f"{ke_detail.get('beta_levered', 0):.4f}"],
            ["ERP (US Base)", format_pct(ke_detail.get("erp_base", 0.065))],
            ["CRP (Brasil)", f"{ke_detail.get('country_risk_premium', 0)*100:.1f}% ({ke_detail.get('crp_source', 'default')})"],
            ["Prêmio Mercado Total", format_pct(ke_detail.get("market_premium", 0))],
            ["Key-Person Premium", format_pct(ke_detail.get("key_person_premium", 0))],
            ["Ke Final", format_pct(ke_detail.get("cost_of_equity", 0))],
        ]
        _build_premium_table(story, ke_data)
        story.append(Spacer(1, 4 * mm))

        # ETR
        story.append(Paragraph("<b>Taxa Efetiva de Impostos (ETR)</b>", styles["SubSection"]))
        regime_label = tax_info.get("regime", "—").replace("_", " ").title()
        etr_data = [
            ["Componente", "Valor"],
            ["Regime Detectado", regime_label],
            ["Taxa Efetiva (ETR)", format_pct(tax_info.get("effective_tax_rate", 0.34))],
            ["Taxa Nominal (IRPJ+CSLL)", format_pct(tax_info.get("nominal_rate", 0.34))],
            ["Economia vs Nominal", f"{(tax_info.get('nominal_rate', 0.34) - tax_info.get('effective_tax_rate', 0.34))*100:+.1f}pp"],
        ]
        _build_premium_table(story, etr_data, accent_color=TEAL)
        story.append(PageBreak())

    # ── v5: TV Fade ─────────────────────────────────────────
    if is_prof:
        tv_fade = result.get("tv_fade", {})
        if tv_fade:
            _section_header(story, "Terminal Value Fade (Convergência Competitiva)", styles)
            story.append(Paragraph(
                "A margem terminal converge em direção à média do setor ao longo do tempo "
                "(McKinsey / Mauboussin Competitive Advantage Period). Empresas mais jovens "
                "perdem vantagens mais rápido que empresas consolidadas.", styles["Body"]))
            story.append(Spacer(1, 3 * mm))
            fade_data = [
                ["Componente", "Valor"],
                ["Margem Original", format_pct(tv_fade.get("original_margin", 0))],
                ["Margem Média do Setor", format_pct(tv_fade.get("sector_avg_margin", 0))],
                ["Retenção Competitiva", format_pct(tv_fade.get("retention", 0))],
                ["Margem Terminal (Faded)", format_pct(tv_fade.get("faded_margin", 0))],
                ["Impacto no TV", f"{tv_fade.get('fade_impact_pct', 0):+.2f} pp"],
            ]
            _build_premium_table(story, fade_data)
            story.append(Spacer(1, 4 * mm))

    # ── v5: Peer Comparison ─────────────────────────────────
    if is_prof:
        peers = result.get("peers", {})
        if peers:
            _section_header(story, "Comparação com Pares do Setor", styles)
            story.append(Paragraph(
                "Cross-reference entre o valor por DCF e múltiplos setoriais — "
                "validação de mercado (Damodaran / NYU Stern Emerging Markets).", styles["Body"]))
            story.append(Spacer(1, 3 * mm))
            ev_rev_peer = peers.get("ev_revenue", {})
            ev_ebitda_peer = peers.get("ev_ebitda", {})
            dcf_peers = peers.get("dcf_vs_peers", {})
            peer_data = [
                ["Método", "Múltiplo", "Valor", "P25 — P75"],
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

    # ── v5: Control Premium ─────────────────────────────────
    if is_prof:
        control = result.get("control_premium", {})
        if control and control.get("full_control_100pct", 0) > 0:
            _section_header(story, "Prêmio de Controle / Desconto de Minoria", styles)
            story.append(Paragraph(
                "Quanto vale a participação conforme o percentual de controle adquirido. "
                "Fonte: Mergerstat Review / Houlihan Lokey Control Premium Studies.", styles["Body"]))
            story.append(Spacer(1, 3 * mm))
            ctrl_data = [
                ["Participação", "Valor"],
                ["100% (Controle Total)", format_brl(control.get("full_control_100pct", 0))],
                ["51% (Maioria)", format_brl(control.get("majority_51pct", 0))],
                ["33% (Significativo)", format_brl(control.get("significant_33pct", 0))],
                ["25% (Minoria)", format_brl(control.get("minority_25pct", 0))],
                ["10% (Minoria)", format_brl(control.get("minority_10pct", 0))],
                ["5% (Minoria)", format_brl(control.get("minority_5pct", 0))],
            ]
            _build_premium_table(story, ctrl_data)
            story.append(Spacer(1, 4 * mm))

    # ── v5: Monte Carlo Simulation ──────────────────────────
    if is_strat:
        mc = result.get("monte_carlo", {})
        if mc and mc.get("n_simulations", 0) > 0:
            _section_header(story, "Simulação Monte Carlo", styles)
            story.append(Paragraph(
                f"Distribuição probabilística do equity value com {mc.get('n_simulations', 2000):,} simulações. "
                "Varia crescimento (±30%), margem (±20%) e Ke (±15%) com distribuição gaussiana. "
                "Fonte: McKinsey / Goldman Sachs quantitative valuation methodology.", styles["Body"]))
            story.append(Spacer(1, 3 * mm))
            mc_data = [
                ["Percentil", "Valor"],
                ["P5 (Conservador)", format_brl(mc.get("p5", 0))],
                ["P10", format_brl(mc.get("p10", 0))],
                ["P25", format_brl(mc.get("p25", 0))],
                ["P50 (Mediana)", format_brl(mc.get("p50", 0))],
                ["P75", format_brl(mc.get("p75", 0))],
                ["P90", format_brl(mc.get("p90", 0))],
                ["P95 (Otimista)", format_brl(mc.get("p95", 0))],
                ["Média", format_brl(mc.get("mean", 0))],
                ["Desvio Padrão", format_brl(mc.get("std_dev", 0))],
            ]
            _build_premium_table(story, mc_data, accent_color=NAVY)
            story.append(Spacer(1, 4 * mm))
            story.append(PageBreak())

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
        ("Ke", "Custo de Capital Pr\u00f3prio \u2014 taxa de retorno exigida pelo acionista, utilizada como taxa de desconto no modelo FCFE."),
        ("FCFE", "Free Cash Flow to Equity \u2014 fluxo de caixa livre dispon\u00edvel ao acionista ap\u00f3s servi\u00e7o de d\u00edvida."),
        ("Valor Terminal", "Valor presente dos fluxos de caixa al\u00e9m do per\u00edodo de proje\u00e7\u00e3o expl\u00edcita."),
        ("Gordon Growth", "Modelo de perpetuidade com crescimento constante para calcular o valor terminal."),
        ("Exit Multiple", "M\u00e9todo que aplica um m\u00faltiplo (EV/EBITDA) sobre o EBITDA do \u00faltimo ano projetado."),
        ("EBITDA", "Lucro operacional antes de juros, impostos, deprecia\u00e7\u00e3o e amortiza\u00e7\u00e3o."),
        ("EV/Receita", "Enterprise Value dividido pela receita \u2014 m\u00faltiplo de avalia\u00e7\u00e3o por faturamento."),
        ("EV/EBITDA", "Enterprise Value dividido pelo EBITDA \u2014 m\u00faltiplo de avalia\u00e7\u00e3o operacional."),
        ("DLOM", "Discount for Lack of Marketability \u2014 desconto por falta de liquidez de empresa fechada."),
        ("Beta 5-Fatores", "Medida de risco QuantoVale que incorpora setor, porte, maturidade, rentabilidade e liquidez (Dimson)."),
        ("CRP", "Country Risk Premium \u2014 pr\u00eamio por risco-pa\u00eds (Brasil), medido pelo spread EMBI+ (BCB)."),
        ("ETR", "Effective Tax Rate \u2014 taxa efetiva de impostos considerando regime (Simples/Presumido/Real)."),
        ("Mid-Year Convention", "Conven\u00e7\u00e3o que desconta fluxos no meio do ano (t-0,5) ao inv\u00e9s do final, padr\u00e3o Goldman Sachs / Big 4."),
        ("TV Fade", "Converg\u00eancia competitiva \u2014 a margem terminal converge em dire\u00e7\u00e3o \u00e0 m\u00e9dia do setor (McKinsey/Mauboussin)."),
        ("Monte Carlo", "Simula\u00e7\u00e3o estoc\u00e1stica com varia\u00e7\u00e3o aleat\u00f3ria de par\u00e2metros para gerar distribui\u00e7\u00e3o probabil\u00edstica do valor."),
        ("Pr\u00eamio de Controle", "Ajuste no valor conforme o percentual de participa\u00e7\u00e3o adquirido (Mergerstat/Houlihan Lokey)."),
        ("Peer Comparison", "Compara\u00e7\u00e3o do DCF com m\u00faltiplos setoriais (cross-reference de valida\u00e7\u00e3o de mercado)."),
        ("Lucro L\u00edquido", "Resultado ap\u00f3s impostos \u2014 base para c\u00e1lculo do FCFE no modelo v5."),
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
        "informativa e educacional. Os valores apresentados s\u00e3o estimativas baseadas na metodologia "
        "FCFE/Ke v5.0 (QuantoVale) com DCF Gordon Growth e Exit Multiple, ajuste de DLOM, "
        "Monte Carlo (2000 simula\u00e7\u00f5es), TV Fade competitivo e Mid-Year Convention.",
        "Os dados setoriais (betas 5-fatores, m\u00faltiplos, NWC, CapEx, D&A) s\u00e3o derivados de Aswath Damodaran (NYU Stern). "
        "O CRP (Country Risk Premium) utiliza o spread EMBI+ do Banco Central do Brasil. "
        "Estat\u00edsticas de sobreviv\u00eancia s\u00e3o do SEBRAE/IBGE. A taxa livre de risco utiliza a Selic (BCB).",
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
