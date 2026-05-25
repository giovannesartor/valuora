"""
Pitch Deck Invite Service

Business logic:
- Secure token generation
- Public URL construction
- Invite → PitchDeck conversion (linked to the admin who converts)
- Invite email sending (dedicated template)
"""
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.models import (
    PitchDeck, PitchDeckInvite, PitchDeckInviteStatus, PitchDeckStatus, User,
)
from app.services.email_service import render_template, send_email

logger = logging.getLogger(__name__)


def generate_invite_token() -> str:
    """URL-safe token of ~43 characters."""
    return secrets.token_urlsafe(32)


def build_public_url(token: str) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/pitch-deck/invite/{token}"


def is_invite_expired(invite: PitchDeckInvite) -> bool:
    if invite.expires_at is None:
        return False
    expires = invite.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) > expires


def can_client_submit(invite: PitchDeckInvite) -> bool:
    """Client can submit / re-submit while admin hasn't converted/rejected."""
    if invite.deleted_at is not None:
        return False
    if is_invite_expired(invite):
        return False
    return invite.status in (
        PitchDeckInviteStatus.PENDING,
        PitchDeckInviteStatus.SUBMITTED,
        PitchDeckInviteStatus.IN_REVIEW,
    )


async def send_invite_email(invite: PitchDeckInvite) -> bool:
    """Sends email to the client with the public link. Returns True on success."""
    if not invite.client_email:
        return False
    public_url = build_public_url(invite.token)
    expires_label = invite.expires_at.strftime("%m/%d/%Y")
    try:
        html = render_template(
            "pitch_deck_invite.html",
            client_name=invite.client_name or "Hello",
            company_hint=invite.company_hint or "",
            admin_message=invite.admin_message or "",
            public_url=public_url,
            expires_label=expires_label,
        )
        subject = "Invitation to fill in your Pitch Deck — Valuora"
        await send_email(invite.client_email, subject, html)
        return True
    except Exception as exc:
        logger.error(f"[invite] failed to send email to {invite.client_email}: {exc}")
        return False


def _to_serializable(value):
    """Converts Pydantic sub-models / lists to JSON-safe dicts."""
    if value is None:
        return None
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if isinstance(value, list):
        return [_to_serializable(v) for v in value]
    if isinstance(value, dict):
        return {k: _to_serializable(v) for k, v in value.items()}
    return value


def submission_to_pitch_deck_kwargs(data: dict) -> dict:
    """
    Receives submission_data (dict in PitchDeckCreate shape) and returns
    direct kwargs to build a PitchDeck.
    """
    if not isinstance(data, dict):
        data = {}

    return {
        "company_name": (data.get("company_name") or "Unnamed company").strip()[:255],
        "sector": data.get("sector"),
        "slogan": data.get("slogan"),
        "logo_path": data.get("_logo_path") or data.get("logo_path"),
        "contact_email": data.get("contact_email"),
        "contact_phone": data.get("contact_phone"),
        "website": data.get("website"),
        "headline": data.get("headline"),
        "problem": data.get("problem"),
        "solution": data.get("solution"),
        "target_market": _to_serializable(data.get("target_market")),
        "competitive_landscape": _to_serializable(data.get("competitive_landscape")),
        "business_model": data.get("business_model"),
        "sales_channels": data.get("sales_channels"),
        "marketing_activities": data.get("marketing_activities"),
        "funding_needs": _to_serializable(data.get("funding_needs")),
        "financial_projections": _to_serializable(data.get("financial_projections")),
        "milestones": _to_serializable(data.get("milestones")),
        "team": _to_serializable(data.get("team")),
        "partners_resources": _to_serializable(data.get("partners_resources")),
        "investor_type": data.get("investor_type") or "general",
        "theme": data.get("theme") or "corporate",
    }


async def convert_invite_to_pitch_deck(
    db: AsyncSession,
    invite: PitchDeckInvite,
    admin: User,
) -> PitchDeck:
    """
    Converts the Invite into an official PitchDeck linked to the admin who converted it.
    Marks invite as CONVERTED and stores the created deck id.
    """
    if invite.submission_data is None:
        raise ValueError("The client hasn't submitted data for this invite yet.")
    if invite.status == PitchDeckInviteStatus.CONVERTED and invite.converted_pitch_deck_id:
        # idempotent — return existing deck
        deck = await db.get(PitchDeck, invite.converted_pitch_deck_id)
        if deck:
            return deck

    kwargs = submission_to_pitch_deck_kwargs(invite.submission_data)
    deck = PitchDeck(
        user_id=admin.id,
        partner_id=getattr(admin, "partner_id", None),
        status=PitchDeckStatus.DRAFT,
        is_paid=True,  # generated by admin — doesn't go through paywall
        language=(getattr(invite, "language", None) or "en")[:8],
        **kwargs,
    )
    db.add(deck)
    await db.flush()  # ensure deck.id

    invite.status = PitchDeckInviteStatus.CONVERTED
    invite.converted_pitch_deck_id = deck.id
    invite.converted_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(deck)
    await db.refresh(invite)
    return deck


def make_default_expiration(days: int = 14) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=max(1, int(days)))


# ─── Completeness Score ──────────────────────────────────
SCORE_RULES: list[tuple[str, int, str]] = [
    ("company_name",              5,  "Company name"),
    ("sector",                    3,  "Sector"),
    ("slogan",                    2,  "Slogan"),
    ("contact_email",             3,  "Contact email"),
    ("contact_phone",             2,  "Phone"),
    ("website",                   2,  "Website"),
    ("headline",                  6,  "Headline"),
    ("problem",                   8,  "Problem"),
    ("solution",                  8,  "Solution"),
    ("business_model",            7,  "Business model"),
    ("sales_channels",            4,  "Sales channels"),
    ("marketing_activities",      4,  "Marketing activities"),
    ("target_market.description", 5,  "Market description"),
    ("target_market.tam",         3,  "TAM"),
    ("target_market.sam",         3,  "SAM"),
    ("target_market.som",         3,  "SOM"),
    ("competitive_landscape*",    6,  "Competitors (≥1)"),
    ("funding_needs.amount>0",    5,  "Funding amount"),
    ("funding_needs.description", 4,  "Use of funds"),
    ("financial_projections>=3",  8,  "Projections (≥3 years)"),
    ("milestones*",               4,  "Milestones / Roadmap (≥1)"),
    ("team*",                     5,  "Team (≥1 member)"),
    ("_logo_path",                5,  "Logo uploaded"),
]


def _resolve(data: dict, path: str):
    cur = data
    for part in path.split("."):
        if isinstance(cur, dict):
            cur = cur.get(part)
        else:
            return None
    return cur


def compute_invite_score(submission: Optional[dict]) -> dict:
    """Heuristic 0–100 + checklist (filled/missing)."""
    data = submission or {}
    total_weight = sum(w for _, w, _ in SCORE_RULES)
    earned = 0
    filled: list[str] = []
    missing: list[str] = []

    for key, weight, label in SCORE_RULES:
        ok = False
        if key.endswith("*"):
            base = key[:-1]
            val = _resolve(data, base)
            ok = isinstance(val, list) and len(val) >= 1
        elif ">=3" in key:
            base = key.split(">=")[0]
            val = _resolve(data, base)
            ok = isinstance(val, list) and len(val) >= 3
        elif ">0" in key:
            base = key.split(">")[0]
            val = _resolve(data, base)
            try:
                ok = float(val or 0) > 0
            except (TypeError, ValueError):
                ok = False
        else:
            val = _resolve(data, key)
            ok = bool(val) if not isinstance(val, (int, float)) else val != 0

        if ok:
            earned += weight
            filled.append(label)
        else:
            missing.append(label)

    score = round((earned / total_weight) * 100) if total_weight else 0
    if score >= 85:
        level = "excellent"
    elif score >= 65:
        level = "good"
    elif score >= 40:
        level = "fair"
    else:
        level = "poor"

    return {
        "score": score,
        "level": level,
        "earned": earned,
        "total": total_weight,
        "filled": filled,
        "missing": missing,
    }


# ─── AI Extraction (Deepseek) ────────────────────────────
async def extract_pitch_data_with_ai(
    *,
    raw_text: str,
    source_label: str = "document",
    custom_instructions: Optional[str] = None,
) -> dict:
    """Uses DeepSeek to extract structured info from raw text and return a dict
    matching PitchDeckInviteSubmission shape for pre-filling the invite."""
    from app.services.deepseek_service import call_deepseek
    import json
    import re

    truncated = (raw_text or "").strip()[:14000]
    if not truncated:
        raise ValueError("Empty text — nothing to extract.")

    prompt = (
        "You receive the raw content of a pitch deck or corporate website "
        f"({source_label}). Extract information in the exact JSON below. "
        "Use only what is present — missing fields stay as empty string or empty list. "
        "Do not invent financial figures.\n\n"
        "Schema (respond ONLY with the JSON):\n"
        "{\n"
        '  "company_name": "",\n'
        '  "sector": "",\n'
        '  "slogan": "",\n'
        '  "website": "",\n'
        '  "contact_email": "",\n'
        '  "contact_phone": "",\n'
        '  "headline": "",\n'
        '  "problem": "",\n'
        '  "solution": "",\n'
        '  "business_model": "",\n'
        '  "sales_channels": "",\n'
        '  "marketing_activities": "",\n'
        '  "target_market": {"description":"", "tam":"", "sam":"", "som":""},\n'
        '  "competitive_landscape": [{"competitor":"", "advantage":""}],\n'
        '  "funding_needs": {"amount": 0, "description":""},\n'
        '  "financial_projections": [{"year": 2026, "revenue":0, "expenses":0, "profit":0}],\n'
        '  "milestones": [{"title":"", "date":"", "description":"", "status":"upcoming"}],\n'
        '  "team": [{"name":"", "role":"", "bio":"", "linkedin":""}]\n'
        "}\n\n"
        + (f"EXTRA ADMIN INSTRUCTIONS: {custom_instructions}\n\n" if custom_instructions else "")
        + f"--- CONTENT ---\n{truncated}"
    )

    raw = await call_deepseek(prompt, max_tokens=2500)
    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        raise ValueError("AI did not return a valid JSON. Please try again.")
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        logger.warning(f"[invite-ai] JSON parse error: {exc}; raw={raw[:500]}")
        raise ValueError("Failed to parse AI response.") from exc


async def fetch_url_text(url: str, *, max_chars: int = 20000) -> str:
    """Downloads a URL and returns the main text (HTML stripped)."""
    import httpx
    from html.parser import HTMLParser

    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": "ValoraBot/1.0"})
        resp.raise_for_status()
        html = resp.text

    class _Stripper(HTMLParser):
        def __init__(self):
            super().__init__()
            self.parts: list[str] = []
            self._skip = 0

        def handle_starttag(self, tag, attrs):
            if tag in ("script", "style", "noscript"):
                self._skip += 1

        def handle_endtag(self, tag):
            if tag in ("script", "style", "noscript") and self._skip > 0:
                self._skip -= 1

        def handle_data(self, data):
            if self._skip == 0:
                txt = data.strip()
                if txt:
                    self.parts.append(txt)

    stripper = _Stripper()
    stripper.feed(html)
    text = " ".join(stripper.parts)
    return text[:max_chars]


def extract_pdf_text(file_bytes: bytes, *, max_chars: int = 20000) -> str:
    """Extracts text from a PDF using pypdf."""
    import io
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(file_bytes))
    parts: list[str] = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            continue
    text = "\n".join(parts).strip()
    return text[:max_chars]


# ─── Multi-page crawler ──────────────────────────────────
SUBPAGE_PATHS = [
    "/about", "/about-us", "/team", "/founders",
    "/product", "/products", "/solution", "/contact",
    "/sobre", "/quem-somos", "/produto", "/time",
]


async def fetch_url_text_multipage(
    base_url: str,
    *,
    max_chars_per_page: int = 8000,
    max_pages: int = 6,
) -> str:
    """Fetches home + known sub-paths (about/product/team) and concatenates."""
    import httpx
    from urllib.parse import urlparse, urljoin

    parsed = urlparse(base_url)
    if not parsed.scheme or not parsed.netloc:
        return ""
    root = f"{parsed.scheme}://{parsed.netloc}"

    parts: list[str] = []
    visited: set[str] = set()

    async def _fetch(u: str, label: str) -> None:
        if u in visited or len(visited) >= max_pages:
            return
        visited.add(u)
        try:
            txt = await fetch_url_text(u, max_chars=max_chars_per_page)
            if txt:
                parts.append(f"\n\n=== [{label}] {u} ===\n{txt}")
        except Exception as exc:
            logger.info(f"[crawler] skip {u}: {exc}")

    await _fetch(base_url, "home")
    for path in SUBPAGE_PATHS:
        if len(visited) >= max_pages:
            break
        await _fetch(urljoin(root, path), path.strip("/"))

    return "\n".join(parts)


# ─── Team enrichment via DeepSeek ────────────────────────
async def enrich_team_with_ai(team: list[dict]) -> list[dict]:
    """Receives a list of members and uses DeepSeek to generate professional bios."""
    from app.services.deepseek_service import call_deepseek
    import json
    import re

    if not team or not isinstance(team, list):
        return team or []

    valid = [m for m in team if isinstance(m, dict) and m.get("name")]
    if not valid:
        return team

    members_str = json.dumps(
        [{"name": m.get("name"), "role": m.get("role", ""), "linkedin": m.get("linkedin", "")} for m in valid],
        ensure_ascii=False,
    )

    prompt = (
        "You are a pitch deck analyst. For each team member below, "
        "write a short professional bio (2-3 sentences, focus on prior experience, "
        "expertise and education if known). If you don't know the person, return "
        "a generic bio based on the role (e.g. 'CTO with experience in software architecture...'). "
        "Respond ONLY with a JSON array in the same shape received + 'bio' field.\n\n"
        f"Members:\n{members_str}\n\n"
        "Response (JSON array only):"
    )

    try:
        raw = await call_deepseek(prompt, max_tokens=1500)
        match = re.search(r"\[[\s\S]*\]", raw)
        if not match:
            return team
        enriched = json.loads(match.group(0))
        out = []
        for orig, new in zip(team, enriched):
            if not isinstance(orig, dict):
                out.append(orig)
                continue
            merged = dict(orig)
            new_bio = (new.get("bio") or "").strip() if isinstance(new, dict) else ""
            if new_bio and not (orig.get("bio") or "").strip():
                merged["bio"] = new_bio
            out.append(merged)
        return out
    except Exception as exc:
        logger.warning(f"[enrich-team] failed: {exc}")
        return team


# ─── Translation via DeepSeek ─────────────────────────────
TRANSLATABLE_FIELDS = [
    "slogan", "headline", "problem", "solution",
    "business_model", "sales_channels", "marketing_activities",
]


async def translate_pitch_data(data: dict, target_language: str) -> dict:
    """Translates text fields via DeepSeek. target_language: 'en' or 'es' or 'pt'."""
    from app.services.deepseek_service import call_deepseek
    import json
    import re

    if not isinstance(data, dict):
        return data
    target = target_language.lower()[:2] if target_language else "en"

    payload = {k: data[k] for k in TRANSLATABLE_FIELDS if data.get(k)}
    if data.get("target_market", {}).get("description"):
        payload["target_market_description"] = data["target_market"]["description"]
    if data.get("funding_needs", {}).get("description"):
        payload["funding_needs_description"] = data["funding_needs"]["description"]
    team = data.get("team") or []
    for i, m in enumerate(team):
        if isinstance(m, dict) and m.get("bio"):
            payload[f"team_{i}_bio"] = m["bio"]
    miles = data.get("milestones") or []
    for i, m in enumerate(miles):
        if isinstance(m, dict) and m.get("description"):
            payload[f"milestone_{i}_desc"] = m["description"]

    if not payload:
        return data

    lang_label = {"en": "professional English (en-US)", "es": "professional Spanish", "pt": "Brazilian Portuguese"}.get(target, target)
    prompt = (
        f"Translate the JSON values below to {lang_label}. Keep corporate tone, "
        "preserve universal technical terms (KPI, MRR, SaaS, etc.). "
        "Respond ONLY with the JSON with the SAME keys and translated values.\n\n"
        f"{json.dumps(payload, ensure_ascii=False)}"
    )

    try:
        raw = await call_deepseek(prompt, max_tokens=3000)
        match = re.search(r"\{[\s\S]*\}", raw)
        if not match:
            return data
        translated = json.loads(match.group(0))
    except Exception as exc:
        logger.warning(f"[translate-deck] failed: {exc}")
        return data

    out = dict(data)
    for k in TRANSLATABLE_FIELDS:
        if k in translated and translated[k]:
            out[k] = translated[k]
    if "target_market_description" in translated and isinstance(out.get("target_market"), dict):
        out["target_market"] = {**out["target_market"], "description": translated["target_market_description"]}
    if "funding_needs_description" in translated and isinstance(out.get("funding_needs"), dict):
        out["funding_needs"] = {**out["funding_needs"], "description": translated["funding_needs_description"]}
    new_team = list(team)
    for i, m in enumerate(new_team):
        key = f"team_{i}_bio"
        if isinstance(m, dict) and translated.get(key):
            new_team[i] = {**m, "bio": translated[key]}
    if new_team:
        out["team"] = new_team
    new_miles = list(miles)
    for i, m in enumerate(new_miles):
        key = f"milestone_{i}_desc"
        if isinstance(m, dict) and translated.get(key):
            new_miles[i] = {**m, "description": translated[key]}
    if new_miles:
        out["milestones"] = new_miles
    return out
