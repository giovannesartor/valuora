"""
Pitch Deck Invite Routes

Admin (auth obrigatória, somente admin/superadmin):
    POST   /api/v1/pitch-deck/invites
    GET    /api/v1/pitch-deck/invites
    GET    /api/v1/pitch-deck/invites/{invite_id}
    PATCH  /api/v1/pitch-deck/invites/{invite_id}
    POST   /api/v1/pitch-deck/invites/{invite_id}/convert
    POST   /api/v1/pitch-deck/invites/{invite_id}/reject
    POST   /api/v1/pitch-deck/invites/{invite_id}/resend
    DELETE /api/v1/pitch-deck/invites/{invite_id}

Público (sem auth, identificado pelo token no path):
    GET    /api/v1/pitch-deck/invite/{token}
    POST   /api/v1/pitch-deck/invite/{token}/submit
    POST   /api/v1/pitch-deck/invite/{token}/upload  (logo / anexos)
"""
import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit_log
from app.core.database import get_db
from app.models.models import (
    PitchDeckInvite, PitchDeckInviteStatus, PitchDeckInviteComment,
    PitchDeck, PitchDeckStatus, User,
    PitchDeckConsolidation, PitchDeckConsolidationStatus,
    PitchDeckInviteEventType,
)
from app.services.pitch_deck_tracking_service import (
    record_event_safe as _record_event,
    list_events as _list_events,
    compute_progress as _compute_progress,
)
from app.schemas.pitch_deck_invite import (
    PitchDeckInviteCreate, PitchDeckInviteUpdate,
    PitchDeckInviteSubmission, PitchDeckInvitePublicInfo,
    PitchDeckInviteAdminResponse, PitchDeckInviteListItem,
    PitchDeckInviteConvertResponse, PitchDeckInviteResendResponse,
    PitchDeckInviteDraft, PitchDeckInviteAIExtractRequest,
    PitchDeckInviteBulkCreate, PitchDeckInviteBulkResult,
    PitchDeckInviteCommentCreate, PitchDeckInviteCommentRead,
    PitchDeckInviteAssign, PitchDeckInviteFunnelStats,
    PitchDeckInviteScoreResponse,
    PitchDeckInviteRequestChanges, PitchDeckInvitePreviewEmail,
)
from app.schemas.pitch_deck_consolidation import (
    PitchDeckConsolidationCreate, PitchDeckConsolidationRead,
    GroupSuggestionRequest, GroupSuggestionResponse,
)
from app.services.auth_service import get_current_admin
from app.services.pitch_deck_invite_service import (
    build_public_url, generate_invite_token, is_invite_expired,
    can_client_submit, send_invite_email, convert_invite_to_pitch_deck,
    make_default_expiration, compute_invite_score,
    extract_pitch_data_with_ai, fetch_url_text, extract_pdf_text,
    fetch_url_text_multipage, enrich_team_with_ai,
)
from app.services.storage_service import save_logo

logger = logging.getLogger(__name__)

# Limites de segurança
MAX_ATTACHMENTS = 5
MAX_ATTACHMENT_SIZE = 8 * 1024 * 1024   # 8 MB por arquivo
MAX_LOGO_SIZE = 5 * 1024 * 1024         # 5 MB
MAX_VIDEO_SIZE = 50 * 1024 * 1024       # 50 MB para vídeo de pitch

# Rate limit para uploads públicos (por token + IP)
RL_UPLOAD_WINDOW = 60       # segundos
RL_UPLOAD_MAX = 10          # uploads/minuto por (token, ip)
RL_DRAFT_WINDOW = 60
RL_DRAFT_MAX = 30           # drafts/minuto por (token, ip)
RL_SUBMIT_WINDOW = 600
RL_SUBMIT_MAX = 10          # submits/10min por (token, ip)
RL_AI_WINDOW = 60
RL_AI_MAX = 5               # extrações IA/min por admin

router = APIRouter(prefix="/pitch-deck", tags=["Pitch Deck Invites"])


# ─── Helpers ─────────────────────────────────────────────
def _ip_hash(request: Request) -> Optional[str]:
    try:
        ip = (request.client.host if request.client else None) or request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if not ip:
            return None
        return hashlib.sha256(ip.encode()).hexdigest()[:32]
    except Exception:
        return None


async def _check_invite_rate_limit(
    bucket: str, ident: str, max_requests: int, window: int
) -> tuple[bool, int]:
    """Redis-backed fixed-window rate limit. Allow if Redis is down."""
    from app.core.redis import redis_client
    key = f"rl:invite:{bucket}:{ident}"
    try:
        pipe = redis_client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window)
        results = await pipe.execute()
        current = int(results[0])
        return current <= max_requests, current
    except Exception as exc:
        logger.warning(f"[invite-rl] redis error: {exc}")
        return True, 0


def _admin_short_name(user: Optional[User]) -> Optional[str]:
    if not user:
        return None
    return getattr(user, "full_name", None) or (user.email.split("@")[0] if user.email else None)


def _sla_breached(invite: PitchDeckInvite) -> bool:
    """Submetido há mais de 48h sem revisão ainda?"""
    if invite.status != PitchDeckInviteStatus.SUBMITTED or not invite.submitted_at:
        return False
    submitted = invite.submitted_at
    if submitted.tzinfo is None:
        submitted = submitted.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - submitted).total_seconds() > 48 * 3600


def _comment_read(c) -> PitchDeckInviteCommentRead:
    return PitchDeckInviteCommentRead(
        id=c.id,
        invite_id=c.invite_id,
        admin_id=c.admin_id,
        admin_name=_admin_short_name(getattr(c, "admin", None)),
        body=c.body,
        created_at=c.created_at,
    )


def _admin_response(invite: PitchDeckInvite, *, with_score: bool = True, with_comments: bool = True) -> PitchDeckInviteAdminResponse:
    score_data = compute_invite_score(invite.submission_data) if with_score else None
    comments = []
    if with_comments:
        try:
            for c in (invite.comments or []):
                comments.append(_comment_read(c))
        except Exception:
            comments = []
    return PitchDeckInviteAdminResponse(
        id=invite.id,
        token=invite.token,
        public_url=build_public_url(invite.token),
        created_by_admin_id=invite.created_by_admin_id,
        assigned_admin_id=invite.assigned_admin_id,
        assigned_admin_name=_admin_short_name(getattr(invite, "assigned_admin", None)),
        client_email=invite.client_email,
        client_name=invite.client_name,
        company_hint=invite.company_hint,
        admin_message=invite.admin_message,
        status=invite.status.value if hasattr(invite.status, "value") else invite.status,
        expires_at=invite.expires_at,
        is_expired=is_invite_expired(invite),
        is_draft=bool(invite.is_draft),
        submission_data=invite.submission_data,
        attachments=invite.attachments,
        notes_admin=invite.notes_admin,
        converted_pitch_deck_id=invite.converted_pitch_deck_id,
        opened_at=invite.opened_at,
        submitted_at=invite.submitted_at,
        reviewed_at=invite.reviewed_at,
        converted_at=invite.converted_at,
        rejected_at=invite.rejected_at,
        last_email_sent_at=invite.last_email_sent_at,
        last_draft_saved_at=invite.last_draft_saved_at,
        created_at=invite.created_at,
        updated_at=invite.updated_at,
        score=score_data,
        comments=comments,
    )


def _list_item(invite: PitchDeckInvite) -> PitchDeckInviteListItem:
    score_obj = compute_invite_score(invite.submission_data) if invite.submission_data else None
    return PitchDeckInviteListItem(
        id=invite.id,
        token=invite.token,
        status=invite.status.value if hasattr(invite.status, "value") else invite.status,
        client_email=invite.client_email,
        client_name=invite.client_name,
        company_hint=invite.company_hint,
        assigned_admin_id=invite.assigned_admin_id,
        assigned_admin_name=_admin_short_name(getattr(invite, "assigned_admin", None)),
        submitted_at=invite.submitted_at,
        expires_at=invite.expires_at,
        is_expired=is_invite_expired(invite),
        is_draft=bool(invite.is_draft),
        sla_breached=_sla_breached(invite),
        score=int(score_obj["score"]) if score_obj else None,
        converted_pitch_deck_id=invite.converted_pitch_deck_id,
        created_at=invite.created_at,
    )


async def _get_invite_by_token(db: AsyncSession, token: str) -> PitchDeckInvite:
    """Busca por token. Lança 404 genérico para não vazar existência."""
    if not token or len(token) < 16 or len(token) > 80:
        raise HTTPException(status_code=404, detail="Convite inválido.")
    result = await db.execute(
        select(PitchDeckInvite).where(
            PitchDeckInvite.token == token,
            PitchDeckInvite.deleted_at.is_(None),
        )
    )
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Convite não encontrado ou expirado.")
    return invite


async def _get_invite_admin(db: AsyncSession, invite_id: uuid.UUID) -> PitchDeckInvite:
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(PitchDeckInvite)
        .where(
            PitchDeckInvite.id == invite_id,
            PitchDeckInvite.deleted_at.is_(None),
        )
        .options(
            selectinload(PitchDeckInvite.assigned_admin),
            selectinload(PitchDeckInvite.comments).selectinload(PitchDeckInviteComment.admin),
        )
    )
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Convite não encontrado.")
    return invite


# ─── ADMIN ROUTES ────────────────────────────────────────
@router.post("/invites", response_model=PitchDeckInviteAdminResponse, status_code=201)
async def create_invite(
    data: PitchDeckInviteCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    invite = PitchDeckInvite(
        token=generate_invite_token(),
        created_by_admin_id=admin.id,
        client_email=data.client_email,
        client_name=data.client_name,
        company_hint=data.company_hint,
        admin_message=data.admin_message,
        expires_at=make_default_expiration(data.expires_in_days),
        status=PitchDeckInviteStatus.PENDING,
        language=(data.language or "pt").lower()[:8],
        prefill_data=data.prefill_data or None,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    # tracking: created
    await _record_event(
        db, invite.id, PitchDeckInviteEventType.CREATED,
        payload={"by": str(admin.id), "send_email": bool(data.send_email)},
        request=request, actor_admin_id=admin.id,
    )
    await db.commit()

    if data.send_email and invite.client_email:
        ok = await send_invite_email(invite)
        if ok:
            invite.last_email_sent_at = datetime.now(timezone.utc)
            await _record_event(
                db, invite.id, PitchDeckInviteEventType.EMAIL_SENT,
                payload={"to": invite.client_email}, request=request, actor_admin_id=admin.id,
            )
            await db.commit()
            await db.refresh(invite)

    await audit_log(
        action="pitch_deck_invite.create",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(invite.id),
        detail=f"client_email={invite.client_email or '-'} sent={data.send_email}",
        ip=request.client.host if request.client else None,
    )
    return _admin_response(invite)


@router.get("/invites", response_model=list[PitchDeckInviteListItem])
async def list_invites(
    status: Optional[str] = Query(None, description="pending|submitted|in_review|converted|rejected|expired"),
    assigned_to_me: bool = Query(False, description="Filtra apenas convites atribuídos a este admin"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    from sqlalchemy.orm import selectinload
    stmt = (
        select(PitchDeckInvite)
        .where(PitchDeckInvite.deleted_at.is_(None))
        .options(selectinload(PitchDeckInvite.assigned_admin))
    )
    if status:
        try:
            status_enum = PitchDeckInviteStatus(status)
            stmt = stmt.where(PitchDeckInvite.status == status_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail="Status inválido.")
    if assigned_to_me:
        stmt = stmt.where(PitchDeckInvite.assigned_admin_id == admin.id)
    stmt = stmt.order_by(PitchDeckInvite.created_at.desc()).limit(500)
    result = await db.execute(stmt)
    invites = result.scalars().all()
    return [_list_item(i) for i in invites]


@router.get("/invites/{invite_id}", response_model=PitchDeckInviteAdminResponse)
async def get_invite(
    invite_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    invite = await _get_invite_admin(db, invite_id)
    # marca como em_revisão na primeira abertura após submissão
    if invite.status == PitchDeckInviteStatus.SUBMITTED:
        invite.status = PitchDeckInviteStatus.IN_REVIEW
        invite.reviewed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(invite)
    return _admin_response(invite)


@router.patch("/invites/{invite_id}", response_model=PitchDeckInviteAdminResponse)
async def update_invite(
    invite_id: uuid.UUID,
    data: PitchDeckInviteUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    invite = await _get_invite_admin(db, invite_id)
    if invite.status in (PitchDeckInviteStatus.CONVERTED, PitchDeckInviteStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Convite já foi finalizado e não pode ser editado.")

    payload = data.model_dump(exclude_unset=True)
    for field, value in payload.items():
        setattr(invite, field, value)

    await db.commit()
    await db.refresh(invite)
    await audit_log(
        action="pitch_deck_invite.update",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(invite.id),
        ip=request.client.host if request.client else None,
    )
    return _admin_response(invite)


@router.post("/invites/{invite_id}/convert", response_model=PitchDeckInviteConvertResponse)
async def convert_invite(
    invite_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    invite = await _get_invite_admin(db, invite_id)
    if invite.status == PitchDeckInviteStatus.REJECTED:
        raise HTTPException(status_code=400, detail="Convite rejeitado não pode ser convertido.")
    if invite.submission_data is None:
        raise HTTPException(status_code=400, detail="The client has not yet filled in this invite.")

    try:
        deck = await convert_invite_to_pitch_deck(db, invite, admin)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await _record_event(
        db, invite.id, PitchDeckInviteEventType.CONVERTED,
        payload={"pitch_deck_id": str(deck.id)},
        request=request, actor_admin_id=admin.id,
    )
    await db.commit()

    await audit_log(
        action="pitch_deck_invite.convert",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(invite.id),
        detail=f"pitch_deck_id={deck.id}",
        ip=request.client.host if request.client else None,
    )
    return PitchDeckInviteConvertResponse(pitch_deck_id=deck.id, invite_id=invite.id)


@router.post("/invites/{invite_id}/reject", response_model=PitchDeckInviteAdminResponse)
async def reject_invite(
    invite_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    invite = await _get_invite_admin(db, invite_id)
    if invite.status == PitchDeckInviteStatus.CONVERTED:
        raise HTTPException(status_code=400, detail="Convite já convertido.")
    invite.status = PitchDeckInviteStatus.REJECTED
    invite.rejected_at = datetime.now(timezone.utc)
    await _record_event(
        db, invite.id, PitchDeckInviteEventType.REJECTED,
        request=request, actor_admin_id=admin.id,
    )
    await db.commit()
    await db.refresh(invite)
    await audit_log(
        action="pitch_deck_invite.reject",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(invite.id),
        ip=request.client.host if request.client else None,
    )
    return _admin_response(invite)


@router.post("/invites/{invite_id}/resend", response_model=PitchDeckInviteResendResponse)
async def resend_invite(
    invite_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Reenvia o e-mail mantendo o MESMO token."""
    invite = await _get_invite_admin(db, invite_id)
    if invite.status in (PitchDeckInviteStatus.CONVERTED, PitchDeckInviteStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Convite finalizado — não pode ser reenviado.")
    if not invite.client_email:
        raise HTTPException(status_code=400, detail="Convite não possui e-mail do cliente.")

    ok = await send_invite_email(invite)
    if ok:
        invite.last_email_sent_at = datetime.now(timezone.utc)
        await _record_event(
            db, invite.id, PitchDeckInviteEventType.REMINDER_SENT,
            payload={"to": invite.client_email},
            request=request, actor_admin_id=admin.id,
        )
        await db.commit()
        await db.refresh(invite)

    await audit_log(
        action="pitch_deck_invite.resend",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(invite.id),
        ok=ok,
        ip=request.client.host if request.client else None,
    )
    return PitchDeckInviteResendResponse(
        sent=ok,
        public_url=build_public_url(invite.token),
        last_email_sent_at=invite.last_email_sent_at,
    )


@router.delete("/invites/{invite_id}")
async def delete_invite(
    invite_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    invite = await _get_invite_admin(db, invite_id)
    invite.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    await audit_log(
        action="pitch_deck_invite.delete",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(invite.id),
        ip=request.client.host if request.client else None,
    )
    return {"detail": "Convite excluído."}


# ─── PUBLIC ROUTES (cliente, sem auth) ───────────────────
@router.get("/invite/{token}", response_model=PitchDeckInvitePublicInfo)
async def public_get_invite(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    invite = await _get_invite_by_token(db, token)

    # marca como expirado se vencido (sem alterar deleted/converted/rejected)
    if (
        is_invite_expired(invite)
        and invite.status in (PitchDeckInviteStatus.PENDING, PitchDeckInviteStatus.SUBMITTED, PitchDeckInviteStatus.IN_REVIEW)
    ):
        invite.status = PitchDeckInviteStatus.EXPIRED
        await _record_event(db, invite.id, PitchDeckInviteEventType.EXPIRED, request=request)
        await db.commit()
        await db.refresh(invite)

    # tracking de primeira abertura
    if invite.opened_at is None and invite.status != PitchDeckInviteStatus.EXPIRED:
        invite.opened_at = datetime.now(timezone.utc)
        await _record_event(db, invite.id, PitchDeckInviteEventType.OPENED, request=request)
        await db.commit()
        await db.refresh(invite)

    return PitchDeckInvitePublicInfo(
        token=invite.token,
        company_hint=invite.company_hint,
        client_name=invite.client_name,
        client_email=invite.client_email,
        admin_message=invite.admin_message,
        status=invite.status.value if hasattr(invite.status, "value") else invite.status,
        expires_at=invite.expires_at,
        is_expired=is_invite_expired(invite),
        can_submit=can_client_submit(invite),
        is_draft=bool(getattr(invite, "is_draft", False)),
        submission_data=invite.submission_data,
        prefill_data=getattr(invite, "prefill_data", None),
    )


@router.post("/invite/{token}/submit", response_model=PitchDeckInvitePublicInfo)
async def public_submit_invite(
    token: str,
    payload: PitchDeckInviteSubmission,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    invite = await _get_invite_by_token(db, token)
    if not can_client_submit(invite):
        raise HTTPException(status_code=400, detail="This invite is not accepting submissions.")

    # Rate limit
    rl_key = f"{token}:{_ip_hash(request) or 'na'}"
    allowed, _ = await _check_invite_rate_limit("submit", rl_key, RL_SUBMIT_MAX, RL_SUBMIT_WINDOW)
    if not allowed:
        raise HTTPException(status_code=429, detail="Muitas submissões em pouco tempo. Tente novamente em alguns minutos.")

    # Preserva _logo_path uploaded antes do submit
    prior = invite.submission_data if isinstance(invite.submission_data, dict) else {}
    prior_logo = prior.get("_logo_path")

    invite.submission_data = payload.model_dump(mode="json", exclude_none=False)
    if prior_logo and "_logo_path" not in invite.submission_data:
        invite.submission_data["_logo_path"] = prior_logo
    invite.submitted_at = datetime.now(timezone.utc)
    invite.is_draft = False
    if invite.status == PitchDeckInviteStatus.PENDING:
        invite.status = PitchDeckInviteStatus.SUBMITTED
    # tracking: SUBMITTED
    try:
        _company = (payload.company_name or "")[:80]
    except Exception:
        _company = ""
    await _record_event(
        db, invite.id, PitchDeckInviteEventType.SUBMITTED,
        payload={"company": _company}, request=request,
    )

    meta = invite.submission_meta or {}
    if not isinstance(meta, dict):
        meta = {}
    meta["last_ip_hash"] = _ip_hash(request)
    meta["last_user_agent"] = (request.headers.get("user-agent") or "")[:500]
    meta["submit_count"] = int(meta.get("submit_count") or 0) + 1
    invite.submission_meta = meta

    await db.commit()
    await db.refresh(invite)

    await audit_log(
        action="pitch_deck_invite.public_submit",
        resource_id=str(invite.id),
        detail=f"company={payload.company_name[:80]} submit_count={meta['submit_count']}",
        ip=request.client.host if request.client else None,
    )

    return PitchDeckInvitePublicInfo(
        token=invite.token,
        company_hint=invite.company_hint,
        client_name=invite.client_name,
        client_email=invite.client_email,
        admin_message=invite.admin_message,
        status=invite.status.value if hasattr(invite.status, "value") else invite.status,
        expires_at=invite.expires_at,
        is_expired=is_invite_expired(invite),
        can_submit=can_client_submit(invite),
        is_draft=bool(getattr(invite, "is_draft", False)),
        submission_data=invite.submission_data,
        prefill_data=getattr(invite, "prefill_data", None),
    )


@router.post("/invite/{token}/upload")
async def public_upload_attachment(
    token: str,
    request: Request,
    file: UploadFile = File(...),
    kind: str = Query("attachment", description="logo | attachment"),
    db: AsyncSession = Depends(get_db),
):
    invite = await _get_invite_by_token(db, token)
    if not can_client_submit(invite):
        raise HTTPException(status_code=400, detail="Convite não aceita uploads.")

    # Rate limit por (token, ip)
    rl_key = f"{token}:{_ip_hash(request) or 'na'}"
    allowed, _ = await _check_invite_rate_limit("upload", rl_key, RL_UPLOAD_MAX, RL_UPLOAD_WINDOW)
    if not allowed:
        raise HTTPException(status_code=429, detail="Muitos uploads em pouco tempo. Aguarde 1 minuto.")

    # Validações
    allowed_logo = {"image/png", "image/jpeg", "image/webp", "image/svg+xml"}
    allowed_attach = allowed_logo | {"application/pdf"}
    allowed_video = {"video/mp4", "video/quicktime", "video/webm"}
    content_type = (file.content_type or "").lower()
    if kind == "logo":
        if content_type not in allowed_logo:
            raise HTTPException(status_code=400, detail="Logo deve ser PNG, JPEG, WEBP ou SVG.")
        max_size = MAX_LOGO_SIZE
    elif kind == "video":
        if content_type not in allowed_video:
            raise HTTPException(status_code=400, detail="Vídeo deve ser MP4, MOV ou WebM.")
        max_size = MAX_VIDEO_SIZE
    else:
        if content_type not in allowed_attach:
            raise HTTPException(status_code=400, detail="Anexo deve ser imagem ou PDF.")
        max_size = MAX_ATTACHMENT_SIZE

    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail=f"Arquivo muito grande. Máximo: {max_size // (1024*1024)} MB.")

    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "bin"
    ext = "".join(c for c in ext if c.isalnum())[:8] or "bin"

    # Reusa o save_logo (que já lida com R2 ou local). O "id" é o invite.id
    # — ambos os tipos vão para o mesmo bucket "logos/<uuid>.<ext>".
    path = await save_logo(content, invite.id, ext)

    if kind == "logo":
        # injeta no submission_data (cria se necessário)
        sub = invite.submission_data or {}
        if not isinstance(sub, dict):
            sub = {}
        sub["_logo_path"] = path
        invite.submission_data = sub
    elif kind == "video":
        attachments = list(invite.attachments or [])
        attachments.append({
            "name": (file.filename or "video")[:200],
            "path": path,
            "size": len(content),
            "content_type": content_type,
            "kind": "video",
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        })
        invite.attachments = attachments
    else:
        attachments = list(invite.attachments or [])
        if len(attachments) >= MAX_ATTACHMENTS:
            raise HTTPException(status_code=400, detail=f"Limite de {MAX_ATTACHMENTS} anexos atingido.")
        attachments.append({
            "name": (file.filename or "arquivo")[:200],
            "path": path,
            "size": len(content),
            "content_type": content_type,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        })
        invite.attachments = attachments

    await db.commit()
    await db.refresh(invite)
    return {"path": path, "kind": kind, "attachments": invite.attachments or []}


# ─── PUBLIC: salvar rascunho server-side ─────────────────
@router.patch("/invite/{token}/draft", response_model=PitchDeckInvitePublicInfo)
async def public_save_draft(
    token: str,
    payload: PitchDeckInviteDraft,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    invite = await _get_invite_by_token(db, token)
    if not can_client_submit(invite):
        raise HTTPException(status_code=400, detail="Convite não aceita edições.")

    rl_key = f"{token}:{_ip_hash(request) or 'na'}"
    allowed, _ = await _check_invite_rate_limit("draft", rl_key, RL_DRAFT_MAX, RL_DRAFT_WINDOW)
    if not allowed:
        raise HTTPException(status_code=429, detail="Salvando rascunho com muita frequência.")

    # Mescla preservando _logo_path / metadados
    prior = invite.submission_data if isinstance(invite.submission_data, dict) else {}
    new_data = dict(payload.submission_data or {})
    if prior.get("_logo_path") and "_logo_path" not in new_data:
        new_data["_logo_path"] = prior["_logo_path"]

    # tracking: 1º save = DRAFT_STARTED, demais = DRAFT_SAVED (com info de % preenchido)
    is_first = invite.last_draft_saved_at is None
    invite.submission_data = new_data
    invite.is_draft = True
    invite.last_draft_saved_at = datetime.now(timezone.utc)
    # Se tinha sido SUBMITTED e está editando, mantém o status (admin pode rever depois)
    try:
        _filled = sum(1 for v in (new_data or {}).values() if v not in (None, "", [], {}))
        _total = max(1, len(new_data or {}))
        _pct = int(100 * _filled / _total)
    except Exception:
        _pct = None
    if is_first:
        await _record_event(
            db, invite.id, PitchDeckInviteEventType.DRAFT_STARTED,
            payload={"completion_pct": _pct}, request=request,
        )
    await _record_event(
        db, invite.id, PitchDeckInviteEventType.DRAFT_SAVED,
        payload={"completion_pct": _pct, "keys": list((new_data or {}).keys())[:20]},
        request=request,
    )
    await db.commit()
    await db.refresh(invite)
    return PitchDeckInvitePublicInfo(
        token=invite.token,
        company_hint=invite.company_hint,
        client_name=invite.client_name,
        client_email=invite.client_email,
        admin_message=invite.admin_message,
        status=invite.status.value if hasattr(invite.status, "value") else invite.status,
        expires_at=invite.expires_at,
        is_expired=is_invite_expired(invite),
        can_submit=can_client_submit(invite),
        is_draft=bool(getattr(invite, "is_draft", False)),
        submission_data=invite.submission_data,
        prefill_data=getattr(invite, "prefill_data", None),
    )


# ─── PUBLIC: completeness score (form helper) ────────────
@router.post("/invite/{token}/score", response_model=PitchDeckInviteScoreResponse)
async def public_compute_score(
    token: str,
    payload: PitchDeckInviteDraft,
    db: AsyncSession = Depends(get_db),
):
    """Calcula score do payload atual sem persistir. Usado pelo wizard."""
    invite = await _get_invite_by_token(db, token)
    if not can_client_submit(invite):
        raise HTTPException(status_code=400, detail="Convite indisponível.")
    return compute_invite_score(payload.submission_data or {})


# ─── ADMIN: AI extraction (URL ou PDF) ───────────────────
@router.post("/invites/ai-extract")
async def admin_ai_extract(
    payload: PitchDeckInviteAIExtractRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Extrai dados estruturados de uma URL ou texto colado, usando Valuora AI.

    Suporta:
      - crawl_subpages=True: também visita /sobre /produto /time, etc.
      - extra_urls: outras URLs a concatenar (ex: blog, página de fundadores).
      - enrich_team=True: após extração, gera bios resumidas via Valuora AI.
      - custom_instructions: dica extra para o prompt.
    """
    allowed, _ = await _check_invite_rate_limit("ai", str(admin.id), RL_AI_MAX, RL_AI_WINDOW)
    if not allowed:
        raise HTTPException(status_code=429, detail="Muitas extrações IA. Tente novamente em 1 minuto.")

    if not payload.url and not (payload.raw_text and payload.raw_text.strip()) and not payload.extra_urls:
        raise HTTPException(status_code=400, detail="Forneça url, raw_text ou extra_urls.")

    parts: list[str] = []
    label_parts: list[str] = []

    if payload.raw_text and payload.raw_text.strip():
        parts.append(f"=== [texto colado] ===\n{payload.raw_text.strip()[:14000]}")
        label_parts.append("texto colado")

    if payload.url:
        try:
            if payload.crawl_subpages:
                txt = await fetch_url_text_multipage(payload.url)
            else:
                txt = await fetch_url_text(payload.url)
            if txt:
                parts.append(txt if payload.crawl_subpages else f"=== [URL] {payload.url} ===\n{txt}")
                label_parts.append(f"URL {payload.url}")
        except Exception as exc:
            logger.warning(f"[ai-extract] fetch URL failed: {exc}")

    for u in (payload.extra_urls or [])[:5]:
        try:
            txt = await fetch_url_text(u)
            if txt:
                parts.append(f"=== [extra] {u} ===\n{txt}")
                label_parts.append(f"extra {u}")
        except Exception as exc:
            logger.info(f"[ai-extract] extra URL skip {u}: {exc}")

    raw = "\n\n".join(parts).strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Nenhum conteúdo coletado das fontes informadas.")

    label = " + ".join(label_parts) or "fontes múltiplas"

    try:
        data = await extract_pitch_data_with_ai(
            raw_text=raw,
            source_label=label,
            custom_instructions=payload.custom_instructions,
        )
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    if payload.enrich_team and isinstance(data.get("team"), list) and data["team"]:
        try:
            data["team"] = await enrich_team_with_ai(data["team"])
        except Exception as exc:
            logger.warning(f"[ai-extract] enrich_team failed: {exc}")

    await audit_log(
        action="pitch_deck_invite.ai_extract",
        user_id=str(admin.id),
        user_email=admin.email,
        detail=f"source={label[:120]} crawl={payload.crawl_subpages} enrich={payload.enrich_team}",
        ip=request.client.host if request.client else None,
    )
    return {"data": data, "source": label}


@router.post("/invites/ai-extract/pdf")
async def admin_ai_extract_pdf(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Extrai dados de um PDF (pitch antigo) via Valuora AI."""
    allowed, _ = await _check_invite_rate_limit("ai", str(admin.id), RL_AI_MAX, RL_AI_WINDOW)
    if not allowed:
        raise HTTPException(status_code=429, detail="Muitas extrações IA. Tente novamente em 1 minuto.")

    if (file.content_type or "").lower() not in ("application/pdf", "application/x-pdf"):
        raise HTTPException(status_code=400, detail="Envie um PDF.")
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF muito grande (máx 15MB).")
    try:
        raw = extract_pdf_text(content)
    except Exception as exc:
        logger.warning(f"[ai-extract] PDF extract failed: {exc}")
        raise HTTPException(status_code=400, detail="Não foi possível ler o PDF.")
    if not raw.strip():
        raise HTTPException(status_code=400, detail="PDF vazio ou sem texto extraível.")
    try:
        data = await extract_pitch_data_with_ai(raw_text=raw, source_label=f"PDF {file.filename or ''}")
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    await audit_log(
        action="pitch_deck_invite.ai_extract_pdf",
        user_id=str(admin.id),
        user_email=admin.email,
        detail=f"file={file.filename}",
        ip=request.client.host if request.client else None,
    )
    return {"data": data, "source": f"PDF {file.filename}"}


# ─── ADMIN: pedir ajustes ao cliente sem rejeitar ───────
@router.post("/invites/{invite_id}/request-changes", response_model=PitchDeckInviteAdminResponse)
async def admin_request_changes(
    invite_id: uuid.UUID,
    payload: PitchDeckInviteRequestChanges,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Devolve o convite ao cliente para edição. Status volta a PENDING,
    mantém submission_data atual (cliente pode editar), envia email opcional.
    """
    from app.services.email_service import render_template, send_email
    invite = await _get_invite_admin(db, invite_id)
    if invite.status in (PitchDeckInviteStatus.CONVERTED, PitchDeckInviteStatus.REJECTED):
        raise HTTPException(status_code=400, detail="Convite já finalizado.")

    invite.status = PitchDeckInviteStatus.PENDING
    invite.is_draft = True  # cliente pode continuar editando
    if invite.notes_admin:
        invite.notes_admin = (invite.notes_admin + "\n\n[ajustes pedidos]\n" + payload.message)[:8000]
    else:
        invite.notes_admin = "[ajustes pedidos]\n" + payload.message

    await _record_event(
        db, invite.id, PitchDeckInviteEventType.REVIEWED,
        payload={"action": "request_changes", "message": payload.message[:200]},
        request=request, actor_admin_id=admin.id,
    )

    sent = False
    if payload.send_email and invite.client_email:
        try:
            html = render_template(
                "pitch_deck_invite_changes.html",
                client_name=invite.client_name or "Olá",
                admin_message=payload.message,
                public_url=build_public_url(invite.token),
            )
            await send_email(
                invite.client_email,
                "Changes requested on your Pitch Deck — Valuora",
                html,
            )
            invite.last_email_sent_at = datetime.now(timezone.utc)
            sent = True
            await _record_event(
                db, invite.id, PitchDeckInviteEventType.REMINDER_SENT,
                payload={"to": invite.client_email, "kind": "request_changes"},
                request=request, actor_admin_id=admin.id,
            )
        except Exception as exc:
            logger.warning(f"[request-changes] email failed: {exc}")

    await db.commit()
    await db.refresh(invite)
    await audit_log(
        action="pitch_deck_invite.request_changes",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(invite.id),
        detail=f"email_sent={sent}",
        ip=request.client.host if request.client else None,
    )
    return _admin_response(invite)


# ─── ADMIN: preview do email de convite ─────────────────
@router.post("/invites/preview-email")
async def admin_preview_email(
    payload: PitchDeckInvitePreviewEmail,
    admin: User = Depends(get_current_admin),
):
    """Renderiza o HTML do email de convite com dados fictícios para preview."""
    from app.services.email_service import render_template
    fake_token = "PREVIEW_TOKEN_XXXXXXXX"
    fake_url = build_public_url(fake_token)
    expires_label = (
        datetime.now(timezone.utc).replace(microsecond=0)
    ).strftime("%d/%m/%Y")
    try:
        html = render_template(
            "pitch_deck_invite.html",
            client_name=payload.client_name or "Cliente",
            company_hint=payload.company_hint or "",
            admin_message=payload.admin_message or "",
            public_url=fake_url,
            expires_label=expires_label,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao renderizar template: {exc}")
    return {"html": html, "subject": "Invitation to fill in your Pitch Deck — Valuora"}


# ─── ADMIN: bulk CSV invite ──────────────────────────────
@router.post("/invites/bulk", response_model=PitchDeckInviteBulkResult)
async def admin_bulk_create(
    payload: PitchDeckInviteBulkCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    if len(payload.rows) > 200:
        raise HTTPException(status_code=400, detail="Máximo 200 convites por lote.")

    expires_at = make_default_expiration(payload.expires_in_days)
    seen_emails: set[str] = set()
    created_ids: list[uuid.UUID] = []
    errors: list[str] = []
    skipped = 0

    for row in payload.rows:
        email = (row.client_email or "").strip().lower()
        if not email:
            skipped += 1
            continue
        if email in seen_emails:
            skipped += 1
            errors.append(f"{email}: duplicado no lote")
            continue
        seen_emails.add(email)
        invite = PitchDeckInvite(
            token=generate_invite_token(),
            created_by_admin_id=admin.id,
            client_email=email,
            client_name=row.client_name,
            company_hint=row.company_hint,
            admin_message=payload.admin_message,
            expires_at=expires_at,
            status=PitchDeckInviteStatus.PENDING,
        )
        db.add(invite)
        await db.flush()
        created_ids.append(invite.id)

        if payload.send_email:
            ok = await send_invite_email(invite)
            if ok:
                invite.last_email_sent_at = datetime.now(timezone.utc)
            else:
                errors.append(f"{email}: falha ao enviar e-mail")

    await db.commit()
    await audit_log(
        action="pitch_deck_invite.bulk_create",
        user_id=str(admin.id),
        user_email=admin.email,
        detail=f"created={len(created_ids)} skipped={skipped}",
        ip=request.client.host if request.client else None,
    )
    return PitchDeckInviteBulkResult(
        created=len(created_ids),
        skipped=skipped,
        errors=errors[:50],
        invite_ids=created_ids,
    )


# ─── ADMIN: comments timeline ────────────────────────────
@router.post("/invites/{invite_id}/comments", response_model=PitchDeckInviteCommentRead, status_code=201)
async def add_invite_comment(
    invite_id: uuid.UUID,
    payload: PitchDeckInviteCommentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    invite = await _get_invite_admin(db, invite_id)
    comment = PitchDeckInviteComment(
        invite_id=invite.id,
        admin_id=admin.id,
        body=payload.body.strip(),
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    await audit_log(
        action="pitch_deck_invite.comment",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(invite.id),
        ip=request.client.host if request.client else None,
    )
    # ataca admin name
    comment.admin = admin  # type: ignore[attr-defined]
    return _comment_read(comment)


@router.delete("/invites/{invite_id}/comments/{comment_id}", status_code=204)
async def delete_invite_comment(
    invite_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(
        select(PitchDeckInviteComment).where(
            PitchDeckInviteComment.id == comment_id,
            PitchDeckInviteComment.invite_id == invite_id,
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comentário não encontrado.")
    # somente o autor ou superadmin
    if comment.admin_id != admin.id and not getattr(admin, "is_superadmin", False):
        raise HTTPException(status_code=403, detail="Apenas o autor pode excluir.")
    await db.delete(comment)
    await db.commit()
    return None


# ─── ADMIN: assignment ───────────────────────────────────
@router.post("/invites/{invite_id}/assign", response_model=PitchDeckInviteAdminResponse)
async def assign_invite(
    invite_id: uuid.UUID,
    payload: PitchDeckInviteAssign,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    invite = await _get_invite_admin(db, invite_id)
    if payload.assigned_admin_id:
        target = await db.get(User, payload.assigned_admin_id)
        if not target or not (target.is_admin or target.is_superadmin):
            raise HTTPException(status_code=400, detail="Atribuição inválida — usuário não é admin.")
    invite.assigned_admin_id = payload.assigned_admin_id
    await db.commit()
    # recarrega com eager loading
    invite = await _get_invite_admin(db, invite_id)
    await audit_log(
        action="pitch_deck_invite.assign",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(invite.id),
        detail=f"to={payload.assigned_admin_id}",
        ip=request.client.host if request.client else None,
    )
    return _admin_response(invite)


# ─── ADMIN: funnel KPIs ──────────────────────────────────
@router.get("/invites/stats/funnel", response_model=PitchDeckInviteFunnelStats)
async def funnel_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    from sqlalchemy import func
    base = select(PitchDeckInvite).where(PitchDeckInvite.deleted_at.is_(None))
    rows = (await db.execute(base)).scalars().all()

    counts = {s.value: 0 for s in PitchDeckInviteStatus}
    sla_breached = 0
    converted_paid = 0
    by_month: dict[str, dict[str, int]] = {}

    for inv in rows:
        st = inv.status.value if hasattr(inv.status, "value") else str(inv.status)
        counts[st] = counts.get(st, 0) + 1
        if _sla_breached(inv):
            sla_breached += 1
        # bucket mensal de criação
        month = inv.created_at.strftime("%Y-%m") if inv.created_at else "?"
        bucket = by_month.setdefault(month, {"created": 0, "submitted": 0, "converted": 0})
        bucket["created"] += 1
        if inv.submitted_at:
            bucket["submitted"] += 1
        if inv.status == PitchDeckInviteStatus.CONVERTED:
            bucket["converted"] += 1

    # converted_paid: deck COMPLETED a partir de invites convertidos
    converted_ids = [inv.converted_pitch_deck_id for inv in rows if inv.converted_pitch_deck_id]
    if converted_ids:
        deck_rows = (await db.execute(
            select(PitchDeck.id).where(
                PitchDeck.id.in_(converted_ids),
                PitchDeck.status == PitchDeckStatus.COMPLETED,
            )
        )).scalars().all()
        converted_paid = len(deck_rows)

    by_month_list = [
        {"month": m, **v} for m, v in sorted(by_month.items())
    ]

    return PitchDeckInviteFunnelStats(
        total=len(rows),
        pending=counts.get("pending", 0),
        submitted=counts.get("submitted", 0),
        in_review=counts.get("in_review", 0),
        converted=counts.get("converted", 0),
        rejected=counts.get("rejected", 0),
        expired=counts.get("expired", 0),
        converted_paid=converted_paid,
        sla_breached=sla_breached,
        by_month=by_month_list,
    )


# ─── ADMIN: tracking em tempo real ───────────────────────
@router.get("/invites/tracking")
async def list_invites_tracking(
    status: Optional[str] = Query(None),
    only_active: bool = Query(False, description="Exclui converted/rejected/expired"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Lista convites com progresso computado e KPIs agregados (admin-only).

    Pensado para polling do painel de tracking em tempo real (~5s).
    """
    from sqlalchemy.orm import selectinload
    stmt = (
        select(PitchDeckInvite)
        .where(PitchDeckInvite.deleted_at.is_(None))
        .options(selectinload(PitchDeckInvite.events))
        .order_by(PitchDeckInvite.updated_at.desc().nullslast(), PitchDeckInvite.created_at.desc())
    )
    if status:
        try:
            stmt = stmt.where(PitchDeckInvite.status == PitchDeckInviteStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail="status inválido")
    if only_active:
        stmt = stmt.where(PitchDeckInvite.status.in_([
            PitchDeckInviteStatus.PENDING,
            PitchDeckInviteStatus.SUBMITTED,
            PitchDeckInviteStatus.IN_REVIEW,
        ]))

    rows = (await db.execute(stmt)).scalars().all()
    total = len(rows)
    start = (page - 1) * page_size
    rows_page = rows[start: start + page_size]

    items = []
    aggregate = {"active": 0, "stale_3d": 0, "submitted_today": 0, "avg_progress": 0}
    today = datetime.now(timezone.utc).date()
    progress_sum = 0
    for inv in rows_page:
        prog = _compute_progress(inv, inv.events)
        items.append({
            "id": str(inv.id),
            "token": inv.token,
            "status": inv.status.value if hasattr(inv.status, "value") else inv.status,
            "client_email": inv.client_email,
            "client_name": inv.client_name,
            "company_hint": inv.company_hint,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
            "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
            "is_expired": is_invite_expired(inv),
            "current_stage": prog["current_stage"],
            "is_terminal": prog["is_terminal"],
            "progress_pct": prog["progress_pct"],
            "last_activity_at": prog["last_activity_at"],
            "inactive_seconds": prog["inactive_seconds"],
            "inactive_days": prog["inactive_days"],
            "total_funnel_seconds": prog["total_funnel_seconds"],
            "dwell_seconds": prog["dwell_seconds"],
            "events_count": len(inv.events or []),
        })
        if not prog["is_terminal"]:
            aggregate["active"] += 1
        if prog["inactive_days"] >= 3 and not prog["is_terminal"]:
            aggregate["stale_3d"] += 1
        if inv.submitted_at and inv.submitted_at.date() == today:
            aggregate["submitted_today"] += 1
        progress_sum += prog["progress_pct"]
    if rows_page:
        aggregate["avg_progress"] = round(progress_sum / len(rows_page), 1)

    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "aggregate": aggregate,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/invites/{invite_id}/events")
async def get_invite_events(
    invite_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Timeline completo de um convite. Admin-only."""
    invite = await _get_invite_admin(db, invite_id)
    events = await _list_events(db, invite.id)
    progress = _compute_progress(invite, events)
    return {
        "invite_id": str(invite.id),
        "current_stage": progress["current_stage"],
        "progress_pct": progress["progress_pct"],
        "is_terminal": progress["is_terminal"],
        "last_activity_at": progress["last_activity_at"],
        "total_funnel_seconds": progress["total_funnel_seconds"],
        "inactive_seconds": progress["inactive_seconds"],
        "dwell_seconds": progress["dwell_seconds"],
        "events": [
            {
                "id": str(e.id),
                "event_type": e.event_type.value if hasattr(e.event_type, "value") else str(e.event_type),
                "payload": e.payload,
                "actor_admin_id": str(e.actor_admin_id) if e.actor_admin_id else None,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
    }


# ─── ADMIN: LGPD purge — apaga dados do submission ───────
@router.post("/invites/{invite_id}/purge-data")
async def purge_invite_data(
    invite_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Remove submission_data, attachments e meta — usado a pedido do titular (LGPD)."""
    invite = await _get_invite_admin(db, invite_id)
    invite.submission_data = None
    invite.attachments = None
    invite.client_email = None
    invite.client_name = None
    invite.company_hint = None
    invite.notes_admin = None
    invite.submission_meta = {"purged_at": datetime.now(timezone.utc).isoformat(), "by": str(admin.id)}
    if invite.status not in (PitchDeckInviteStatus.CONVERTED, PitchDeckInviteStatus.REJECTED):
        invite.status = PitchDeckInviteStatus.REJECTED
        invite.rejected_at = datetime.now(timezone.utc)
    await db.commit()
    await audit_log(
        action="pitch_deck_invite.lgpd_purge",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(invite.id),
        ip=request.client.host if request.client else None,
    )
    return {"purged": True, "invite_id": str(invite.id)}


# ─── ADMIN: lista de admins (para dropdown de assign) ────
@router.get("/invites/options/admins")
async def list_admins_for_assign(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(
        select(User).where(
            (User.is_admin.is_(True)) | (User.is_superadmin.is_(True))
        ).limit(100)
    )
    admins = result.scalars().all()
    return [
        {"id": str(u.id), "name": _admin_short_name(u), "email": u.email}
        for u in admins
    ]


# ════════════════════════════════════════════════════════════
# CONSOLIDATIONS — Relatório executivo de N pitch decks
# ════════════════════════════════════════════════════════════
import os
from fastapi import BackgroundTasks
from fastapi.responses import FileResponse
from app.core.database import async_session_maker
from app.services.pitch_deck_consolidation_service import (
    run_consolidation, MAX_DECKS_PER_CONSOLIDATION, suggest_groups,
)


def _consolidation_to_read(c: PitchDeckConsolidation) -> PitchDeckConsolidationRead:
    return PitchDeckConsolidationRead(
        id=c.id,
        title=c.title,
        language=c.language,
        status=c.status.value if hasattr(c.status, "value") else str(c.status),
        invite_ids=[uuid.UUID(x) for x in (c.invite_ids or [])],
        progress_pct=c.progress_pct or 0,
        progress_message=c.progress_message,
        has_pdf=bool(c.pdf_path and os.path.exists(c.pdf_path)),
        has_pptx=bool(c.pptx_path and os.path.exists(c.pptx_path)),
        error=c.error,
        meta_json=c.meta_json,
        created_at=c.created_at,
        ready_at=c.ready_at,
    )


async def _run_consolidation_with_session(consolidation_id: uuid.UUID):
    """Wrapper para BackgroundTasks: abre sessão própria."""
    async with async_session_maker() as session:
        try:
            await run_consolidation(session, consolidation_id)
        except Exception:
            logger.exception(f"[consolidation] background failure {consolidation_id}")


@router.post("/consolidations", response_model=PitchDeckConsolidationRead, status_code=201)
async def create_consolidation(
    payload: PitchDeckConsolidationCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Cria um job de consolidação e dispara em background."""
    if len(payload.invite_ids) > MAX_DECKS_PER_CONSOLIDATION:
        raise HTTPException(status_code=400, detail=f"Máximo de {MAX_DECKS_PER_CONSOLIDATION} pitch decks por consolidação.")

    # Valida que todos os invites existem, têm submission_data e pertencem ao escopo admin
    result = await db.execute(
        select(PitchDeckInvite).where(
            PitchDeckInvite.id.in_(payload.invite_ids),
            PitchDeckInvite.deleted_at.is_(None),
        )
    )
    invites = result.scalars().all()
    if len(invites) != len(payload.invite_ids):
        raise HTTPException(status_code=404, detail="Um ou mais pitch decks não foram encontrados.")
    missing = [str(i.id) for i in invites if not isinstance(i.submission_data, dict) or not i.submission_data]
    if missing:
        raise HTTPException(status_code=400, detail=f"Pitch decks sem dados submetidos: {missing}")

    cons = PitchDeckConsolidation(
        created_by_admin_id=admin.id,
        title=payload.title,
        language=(payload.language or "pt")[:8],
        status=PitchDeckConsolidationStatus.PENDING,
        invite_ids=[str(x) for x in payload.invite_ids],
        options={
            "include_pptx": bool(payload.include_pptx),
            "email_recipients": [str(e) for e in (payload.email_recipients or [])],
        },
        progress_pct=0,
        progress_message="Aguardando processamento...",
    )
    db.add(cons)
    await db.commit()
    await db.refresh(cons)

    background_tasks.add_task(_run_consolidation_with_session, cons.id)

    await audit_log(
        action="pitch_deck_consolidation.create",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(cons.id),
        detail=f"n_decks={len(invites)} pptx={payload.include_pptx} emails={len(payload.email_recipients or [])}",
        ip=request.client.host if request.client else None,
    )

    return _consolidation_to_read(cons)


@router.get("/consolidations", response_model=list[PitchDeckConsolidationRead])
async def list_consolidations(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    result = await db.execute(
        select(PitchDeckConsolidation)
        .where(PitchDeckConsolidation.deleted_at.is_(None))
        .order_by(PitchDeckConsolidation.created_at.desc())
        .limit(100)
    )
    rows = result.scalars().all()
    return [_consolidation_to_read(c) for c in rows]


@router.get("/consolidations/{consolidation_id}", response_model=PitchDeckConsolidationRead)
async def get_consolidation(
    consolidation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    res = await db.execute(
        select(PitchDeckConsolidation).where(
            PitchDeckConsolidation.id == consolidation_id,
            PitchDeckConsolidation.deleted_at.is_(None),
        )
    )
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Consolidação não encontrada.")
    return _consolidation_to_read(c)


def _stream_consolidation_file(path: Optional[str], suffix: str, fallback_name: str):
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Arquivo ainda não está pronto.")
    return FileResponse(
        path,
        media_type=("application/pdf" if suffix == "pdf"
                    else "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
        filename=os.path.basename(path) or fallback_name,
    )


@router.get("/consolidations/{consolidation_id}/pdf")
async def download_consolidation_pdf(
    consolidation_id: uuid.UUID,
    inline: bool = False,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    res = await db.execute(select(PitchDeckConsolidation).where(PitchDeckConsolidation.id == consolidation_id))
    c = res.scalar_one_or_none()
    if not c or c.deleted_at:
        raise HTTPException(status_code=404, detail="Consolidação não encontrada.")
    if not c.pdf_path or not os.path.exists(c.pdf_path):
        raise HTTPException(status_code=404, detail="Arquivo não disponível.")
    fname = f"consolidation-{c.id}.pdf"
    headers = {"Content-Disposition": f'inline; filename="{fname}"'} if inline else None
    return FileResponse(
        path=c.pdf_path,
        media_type="application/pdf",
        filename=fname,
        headers=headers,
    )


@router.post("/consolidations/suggest-groups", response_model=GroupSuggestionResponse)
async def suggest_consolidation_groups(
    payload: GroupSuggestionRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Sugere agrupamentos por afinidade (setor/tese/estágio) para N invites."""
    result = await db.execute(
        select(PitchDeckInvite).where(
            PitchDeckInvite.id.in_(payload.invite_ids),
            PitchDeckInvite.deleted_at.is_(None),
        )
    )
    invites = result.scalars().all()
    if not invites:
        raise HTTPException(status_code=404, detail="Nenhum pitch deck encontrado.")
    data = await suggest_groups(invites)
    # Pydantic vai converter strings em UUID
    return data


@router.get("/consolidations/{consolidation_id}/pptx")
async def download_consolidation_pptx(
    consolidation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    res = await db.execute(select(PitchDeckConsolidation).where(PitchDeckConsolidation.id == consolidation_id))
    c = res.scalar_one_or_none()
    if not c or c.deleted_at:
        raise HTTPException(status_code=404, detail="Consolidação não encontrada.")
    return _stream_consolidation_file(c.pptx_path, "pptx", f"consolidation-{c.id}.pptx")


@router.delete("/consolidations/{consolidation_id}", status_code=204)
async def delete_consolidation(
    consolidation_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    res = await db.execute(select(PitchDeckConsolidation).where(PitchDeckConsolidation.id == consolidation_id))
    c = res.scalar_one_or_none()
    if not c or c.deleted_at:
        raise HTTPException(status_code=404, detail="Consolidação não encontrada.")
    c.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    # apaga arquivos físicos (best-effort)
    for p in (c.pdf_path, c.pptx_path):
        try:
            if p and os.path.exists(p):
                os.remove(p)
        except OSError:
            pass
    await audit_log(
        action="pitch_deck_consolidation.delete",
        user_id=str(admin.id),
        user_email=admin.email,
        resource_id=str(c.id),
        ip=request.client.host if request.client else None,
    )
    return None


# ─── Garante que rotas estáticas /invites/<literal> sejam matched ANTES
#     do parametrizado /invites/{invite_id} (definido logicamente antes
#     no arquivo). Sem isso, GET /invites/tracking cai em /invites/{invite_id}
#     e gera 422 'invalid UUID'.
def _hoist_static_invite_routes() -> None:
    static_suffixes = (
        "/invites/tracking",
        "/invites/stats/funnel",
    )
    static = [
        r for r in router.routes
        if any(getattr(r, "path", "").endswith(s) for s in static_suffixes)
    ]
    others = [r for r in router.routes if r not in static]
    router.routes = static + others


_hoist_static_invite_routes()

