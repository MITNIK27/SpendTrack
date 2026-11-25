"""Formatted Excel (.xlsx) and PDF renderings of the spend report.

Both take the exact data the on-screen report and the CSV exports are built
from (a SpendSummaryResponse plus the matched SpendRequestReportRow list), so
the three formats can never disagree about what "matches". Amounts in the
per-request table stay in each row's own currency (shown in a Currency column);
only the category summary is converted, into `summary.display_currency`.
"""
import io
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.schemas.report import SpendRequestReportRow, SpendSummaryResponse

_BRAND_RED = "EA1B3D"
_CHARCOAL = "2F2F39"
_ZEBRA = "F6F4EE"
_GRID = "D9D6CC"

_LOGO_PATH = Path(__file__).resolve().parent.parent / "assets" / "email-logo.png"


@dataclass
class ReportMeta:
    """What the header block of either format says about this particular export."""

    scope_label: str  # "All requests" or "My requests"
    generated_by: str
    generated_at: datetime
    filter_notes: list[str]  # e.g. ["Fiscal year: FY2026", "Category: Conferences & Events"]


def period_label(summary: SpendSummaryResponse) -> str:
    return f"FY{summary.fiscal_year}" if summary.fiscal_year is not None else "All time"


def status_label(status: str) -> str:
    return status.replace("_", " ").capitalize()


def _money(amount: Decimal | str | None) -> Decimal | None:
    return None if amount is None else Decimal(amount)


def _text(value: str | None) -> str:
    return value or "—"


def _title_lines(summary: SpendSummaryResponse, meta: ReportMeta) -> list[str]:
    lines = [
        f"{meta.scope_label}  ·  {period_label(summary)}  ·  amounts in {summary.display_currency}",
        f"Generated {meta.generated_at:%d %b %Y, %H:%M} by {meta.generated_by}",
    ]
    if meta.filter_notes:
        lines.append("Filters: " + "; ".join(meta.filter_notes))
    return lines


# --------------------------------------------------------------------------- Excel

_REQUEST_COLUMNS: list[tuple[str, int]] = [
    ("Date", 12),
    ("Request", 30),
    ("Description", 34),
    ("Category", 26),
    ("Business Unit", 18),
    ("Requester", 20),
    ("Vendor", 18),
    ("Currency", 10),
    ("Requested", 15),
    ("Approved", 15),
    ("Status", 16),
    ("Decided By", 20),
    ("Decision Comment", 44),
]
_NUMBER_FORMAT = "#,##0.00"


def build_xlsx(summary: SpendSummaryResponse, rows: list[SpendRequestReportRow], meta: ReportMeta) -> bytes:
    workbook = Workbook()
    _summary_sheet(workbook.active, summary, meta)
    _requests_sheet(workbook.create_sheet("Spend Requests"), rows)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _style_header(row, fill: str = _CHARCOAL) -> None:
    thin = Side(style="thin", color=_GRID)
    for cell in row:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor=fill)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = Border(left=thin, right=thin, top=thin, bottom=thin)


def _summary_sheet(sheet, summary: SpendSummaryResponse, meta: ReportMeta) -> None:
    sheet.title = "Summary"
    sheet.sheet_view.showGridLines = False
    thin = Side(style="thin", color=_GRID)
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    sheet["A1"] = "SpendTrack — Spend Report"
    sheet["A1"].font = Font(bold=True, size=16, color=_BRAND_RED)
    for offset, line in enumerate(_title_lines(summary, meta)):
        cell = sheet.cell(row=2 + offset, column=1, value=line)
        cell.font = Font(size=10, color="666666")

    row = 6
    sheet.cell(row=row, column=1, value="Overview").font = Font(bold=True, size=12, color=_CHARCOAL)
    row += 1
    for label, value in [
        ("Requests included", summary.matched_spend_request_count),
        (f"Requested ({summary.display_currency})", _money(summary.kpis.fy_spend_requested)),
        (f"Approved ({summary.display_currency})", _money(summary.kpis.fy_spend_approved)),
    ]:
        sheet.cell(row=row, column=1, value=label).border = border
        value_cell = sheet.cell(row=row, column=2, value=value)
        value_cell.border = border
        value_cell.alignment = Alignment(horizontal="right")
        if isinstance(value, Decimal):
            value_cell.number_format = _NUMBER_FORMAT
        row += 1

    row += 1
    sheet.cell(row=row, column=1, value="By category").font = Font(bold=True, size=12, color=_CHARCOAL)
    row += 1
    headers = ["Code", "Category", f"Approved ({summary.display_currency})"]
    for col, header in enumerate(headers, start=1):
        sheet.cell(row=row, column=col, value=header)
    _style_header(sheet[row][: len(headers)])
    row += 1
    for index, cat in enumerate(summary.by_category):
        values = [cat.category_code, cat.category_name, _money(cat.approved)]
        for col, value in enumerate(values, start=1):
            cell = sheet.cell(row=row, column=col, value=value)
            cell.border = border
            if index % 2:
                cell.fill = PatternFill("solid", fgColor=_ZEBRA)
            if col == 3:
                cell.number_format = _NUMBER_FORMAT
                cell.alignment = Alignment(horizontal="right")
        row += 1
    if summary.by_category:
        sheet.cell(row=row, column=2, value="Total").font = Font(bold=True)
        total = sheet.cell(row=row, column=3, value=sum(_money(c.approved) for c in summary.by_category))
        total.font = Font(bold=True)
        total.number_format = _NUMBER_FORMAT
        total.alignment = Alignment(horizontal="right")
        for col in (1, 2, 3):
            sheet.cell(row=row, column=col).border = Border(top=Side(style="medium", color=_CHARCOAL))

    if summary.fx_rate_is_stale:
        note = sheet.cell(
            row=row + 2, column=1, value="Note: exchange rates may be out of date (live rate source was unreachable)."
        )
        note.font = Font(italic=True, size=9, color="B45309")

    for col, width in zip("ABC", (30, 34, 24)):
        sheet.column_dimensions[col].width = width


def _requests_sheet(sheet, rows: list[SpendRequestReportRow]) -> None:
    sheet.sheet_view.showGridLines = False
    thin = Side(style="thin", color=_GRID)
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    for col, (header, width) in enumerate(_REQUEST_COLUMNS, start=1):
        sheet.cell(row=1, column=col, value=header)
        sheet.column_dimensions[get_column_letter(col)].width = width
    _style_header(sheet[1])
    sheet.row_dimensions[1].height = 24

    for index, r in enumerate(rows):
        values = [
            r.created_at.date(),
            r.initiative_name,
            r.description or "",
            r.category_name,
            r.business_unit_name,
            r.requester_name,
            r.vendor or "",
            r.currency,
            _money(r.requested_amount),
            _money(r.approved_amount),
            status_label(r.status),
            r.decided_by or "",
            r.decision_comment or "",
        ]
        for col, value in enumerate(values, start=1):
            cell = sheet.cell(row=index + 2, column=col, value=value)
            cell.border = border
            cell.alignment = Alignment(vertical="top", wrap_text=col in (2, 3, 13))
            if index % 2:
                cell.fill = PatternFill("solid", fgColor=_ZEBRA)
            if col == 1:
                cell.number_format = "DD MMM YYYY"
            elif col in (9, 10):
                cell.number_format = _NUMBER_FORMAT
                cell.alignment = Alignment(horizontal="right", vertical="top")

    sheet.freeze_panes = "C2"
    sheet.auto_filter.ref = f"A1:{get_column_letter(len(_REQUEST_COLUMNS))}{max(len(rows) + 1, 2)}"
    sheet.page_setup.orientation = "landscape"
    sheet.page_setup.fitToWidth = 1
    sheet.page_setup.fitToHeight = 0
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.print_title_rows = "1:1"


# ----------------------------------------------------------------------------- PDF


def _money_text(amount: Decimal | str | None, currency: str) -> str:
    return "—" if amount is None else f"{currency} {Decimal(amount):,.2f}"


def build_pdf(summary: SpendSummaryResponse, rows: list[SpendRequestReportRow], meta: ReportMeta) -> bytes:
    buffer = io.BytesIO()
    page = landscape(A4)
    doc = SimpleDocTemplate(
        buffer,
        pagesize=page,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=14 * mm,
        title="SpendTrack — Spend Report",
        author=meta.generated_by,
    )
    width = page[0] - doc.leftMargin - doc.rightMargin

    base = getSampleStyleSheet()["Normal"]
    cell = ParagraphStyle("cell", parent=base, fontSize=7.5, leading=9.5)
    cell_right = ParagraphStyle("cellr", parent=cell, alignment=2)
    head = ParagraphStyle("head", parent=cell, textColor=colors.white, fontName="Helvetica-Bold")
    head_right = ParagraphStyle("headr", parent=head, alignment=2)
    h2 = ParagraphStyle("h2", parent=base, fontName="Helvetica-Bold", fontSize=11, textColor=colors.HexColor(f"#{_CHARCOAL}"),
                        spaceBefore=10, spaceAfter=4)
    muted = ParagraphStyle("muted", parent=base, fontSize=8, textColor=colors.HexColor("#666666"), leading=11)

    story: list = []

    # Dark header band carrying the (white) InfoBeans logo and the report title.
    title_style = ParagraphStyle("title", parent=base, fontName="Helvetica-Bold", fontSize=15, leading=19,
                                 textColor=colors.white)
    subtitle_style = ParagraphStyle("subtitle", parent=base, fontSize=8, leading=11, textColor=colors.HexColor("#DDDDDD"))
    title_cell = [
        Paragraph("SpendTrack — Spend Report", title_style),
        Paragraph(_title_lines(summary, meta)[0], subtitle_style),
    ]
    logo = Image(str(_LOGO_PATH), width=34 * mm, height=34 * mm * 90 / 306) if _LOGO_PATH.exists() else ""
    band = Table([[title_cell, logo]], colWidths=[width - 40 * mm, 40 * mm])
    band.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(f"#{_CHARCOAL}")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LINEBELOW", (0, 0), (-1, -1), 2, colors.HexColor(f"#{_BRAND_RED}")),
            ]
        )
    )
    story += [band, Spacer(1, 4)]
    story += [Paragraph(line, muted) for line in _title_lines(summary, meta)[1:]]

    # Overview + category summary
    story.append(Paragraph("Overview", h2))
    kpi_rows = [
        ["Requests included", str(summary.matched_spend_request_count)],
        [f"Requested ({summary.display_currency})", f"{Decimal(summary.kpis.fy_spend_requested):,.2f}"],
        [f"Approved ({summary.display_currency})", f"{Decimal(summary.kpis.fy_spend_approved):,.2f}"],
    ]
    kpi = Table(kpi_rows, colWidths=[55 * mm, 40 * mm], hAlign="LEFT")
    kpi.setStyle(_grid_style(zebra=False, header=False))
    story.append(kpi)

    if summary.by_category:
        story.append(Paragraph("By category", h2))
        cat_data = [[
            Paragraph("Code", head),
            Paragraph("Category", head),
            Paragraph(f"Approved ({summary.display_currency})", head_right),
        ]]
        for cat in summary.by_category:
            cat_data.append([
                Paragraph(cat.category_code, cell),
                Paragraph(cat.category_name, cell),
                Paragraph(f"{Decimal(cat.approved):,.2f}", cell_right),
            ])
        cat_data.append([
            "",
            Paragraph("<b>Total</b>", cell),
            Paragraph(f"<b>{sum(Decimal(c.approved) for c in summary.by_category):,.2f}</b>", cell_right),
        ])
        cat_table = Table(cat_data, colWidths=[18 * mm, 85 * mm, 45 * mm], hAlign="LEFT", repeatRows=1)
        style = _grid_style(zebra=True, header=True)
        style.add("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor(f"#{_CHARCOAL}"))
        cat_table.setStyle(style)
        story.append(cat_table)

    # Per-request table
    story.append(Paragraph("Spend requests", h2))
    if not rows:
        story.append(Paragraph("No spend requests match these filters.", muted))
    else:
        col_widths = [22, 40, 40, 34, 24, 28, 26, 26, 26]  # mm — scaled to the page below
        scale = width / (sum(col_widths) * mm)
        col_widths = [w * mm * scale for w in col_widths]
        data = [[
            Paragraph("Date", head),
            Paragraph("Request", head),
            Paragraph("Description", head),
            Paragraph("Category", head),
            Paragraph("Business Unit", head),
            Paragraph("Requester", head),
            Paragraph("Requested", head_right),
            Paragraph("Approved", head_right),
            Paragraph("Status", head),
        ]]
        for r in rows:
            data.append([
                Paragraph(f"{r.created_at:%d %b %Y}", cell),
                Paragraph(_escape(r.initiative_name), cell),
                Paragraph(_escape(_text(r.description)), cell),
                Paragraph(_escape(r.category_name), cell),
                Paragraph(_escape(r.business_unit_name), cell),
                Paragraph(_escape(r.requester_name), cell),
                Paragraph(_money_text(r.requested_amount, r.currency), cell_right),
                Paragraph(_money_text(r.approved_amount, r.currency), cell_right),
                Paragraph(status_label(r.status), cell),
            ])
        table = Table(data, colWidths=col_widths, repeatRows=1)
        table.setStyle(_grid_style(zebra=True, header=True))
        story.append(table)
        story.append(Paragraph(
            "Amounts in this table are shown in each request's own currency; the overview and category totals "
            f"above are converted to {summary.display_currency}.",
            muted,
        ))

    def footer(canvas, document) -> None:
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(colors.HexColor("#777777"))
        canvas.drawString(document.leftMargin, 8 * mm, "SpendTrack · Confidential — internal use only")
        canvas.drawRightString(page[0] - document.rightMargin, 8 * mm, f"Page {document.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()


def _escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _grid_style(*, zebra: bool, header: bool) -> TableStyle:
    commands = [
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor(f"#{_GRID}")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    if header:
        commands.append(("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{_CHARCOAL}")))
    if zebra:
        commands.append(("ROWBACKGROUNDS", (0, 1 if header else 0), (-1, -1), [colors.white, colors.HexColor(f"#{_ZEBRA}")]))
    return TableStyle(commands)
