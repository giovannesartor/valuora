import os
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.models import Report, Analysis, User
from app.schemas.analysis import ReportResponse
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/download")
async def download_report(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Download PDF report via signed temporary link."""
    payload = decode_token(token)
    if not payload or payload.get("purpose") != "download":
        raise HTTPException(status_code=401, detail="Expired or invalid link.")

    report_result = await db.execute(
        select(Report).where(Report.download_token == token)
    )
    report = report_result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    if not os.path.exists(report.file_path):
        # Regenerate PDF from stored analysis data (Railway ephemeral FS)
        analysis_result = await db.execute(
            select(Analysis).where(Analysis.id == report.analysis_id)
        )
        analysis = analysis_result.scalar_one_or_none()
        if not analysis or not analysis.valuation_result:
            raise HTTPException(status_code=404, detail="File not found and insufficient data to regenerate.")
        from app.services.pdf_service import generate_report_pdf
        try:
            pdf_path = await asyncio.to_thread(generate_report_pdf, analysis)
        except Exception as exc:
            logging.getLogger(__name__).error("PDF regen failed for report %s: %s", report.id, exc)
            raise HTTPException(status_code=500, detail="Failed to regenerate the PDF.")
        report.file_path = pdf_path

    report.download_count += 1
    await db.commit()

    return FileResponse(
        report.file_path,
        media_type="application/pdf",
        filename=f"report-valuora-{report.analysis_id}.pdf",
    )


@router.get("/my", response_model=list[ReportResponse])
async def list_my_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists user reports."""
    result = await db.execute(
        select(Report)
        .join(Analysis, Report.analysis_id == Analysis.id)
        .where(Analysis.user_id == current_user.id)
        .order_by(Report.created_at.desc())
    )
    reports = result.scalars().all()
    return reports
