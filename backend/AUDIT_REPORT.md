# QuantoVale Backend — Complete Security & Quality Audit

**Audited commit / state**: current working tree  
**Scope**: all Python files under `backend/app/`  
**Stack**: FastAPI 0.115.6 · SQLAlchemy 2.0 async · asyncpg · Redis · PyJWT · Asaas · DeepSeek

---

## Severity Legend

| Level | Meaning |
|-------|---------|
| **CRITICAL** | Will crash in production or silently corrupt data |
| **HIGH** | Wrong behaviour, security weakness, or resource leak under normal load |
| **MEDIUM** | Incorrect logic that only triggers in edge cases, or clear code defect |
| **LOW** | Code quality, minor inconsistency, maintainability |

---

## CRITICAL Issues

---

### C-1 · `diagnostico.py` ~line 150 — email send blocks the HTTP response

**File**: `app/routes/diagnostico.py`  
**Problem**: `send_diagnostico_email` is `await`-ed directly inside the request handler. Email delivery via SMTP (aiosmtplib → Resend/Gmail) can take 1–10 s. Every POST to `/api/v1/diagnostico` blocks its event-loop slot for that entire duration; under concurrency the thread pool backs up and gateway timeouts accumulate.

```python
# CURRENT (broken)
await send_diagnostico_email(
    email=lead.email,
    ...
)
return {"score": score, ...}
```

**Fix** — pass `background_tasks: BackgroundTasks` to the path function and schedule the email off the hot path:

```python
# FIXED
@router.post("/diagnostico")
async def create_diagnostico(
    data: DiagnosticoCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    ...
    background_tasks.add_task(
        send_diagnostico_email,
        email=lead.email,
        full_name=lead.name,
        score=score,
        company_name=data.company_name,
        sector=data.sector,
    )
    return {"score": score, ...}
```

---

### C-2 · `routes/analysis.py` ~line 1843 — `net_margin` units are inconsistent across routes

**Files**: `app/routes/analysis.py` (multiple handlers)  
**Problem**: Three different endpoints that write `analysis.net_margin` use three different unit conventions, making the stored value dependent on which route the frontend called last:

| Route | Input expected | Transformation | Stored value for "25 %" |
|-------|---------------|----------------|------------------------|
| `POST /analyses` (create) | decimal `0.25` | none | `0.25` ✓ |
| `PATCH /analyses/{id}` (patch) | percentage `25` | `/ 100.0` | `0.25` ✓ |
| `POST /analyses/{id}/reanalyze` | decimal `0.25` | none | `0.25` ✓ |

While the end result is the same if the frontend is consistent, the three routes enforce different validation bounds:

- `create_analysis` accepts `net_margin` as any float (no bounds check in schema)  
- `patch_analysis` rejects `|net_margin| > 100` (percentage check)  
- `reanalyze` accepts any float (no bounds check)

A user who calls `reanalyze` with a decimal (`0.25`) after using `patch_analysis` with a percentage (`25`) will get the correct value. But if a client accidentally sends `25` to `reanalyze` (matching the `patch_analysis` convention), the engine will receive `net_margin = 25` (2500 %), producing a wildly wrong valuation silently.

**Fix** — standardise on decimals everywhere and add a uniform guard:

```python
# In AnalysisCreate schema (schemas/analysis.py)
net_margin: float = Field(..., ge=-1.0, le=1.0,
    description="Net margin as decimal — e.g. 0.25 for 25 %")

# In ReanalyzeInput (analysis.py)
net_margin: Optional[float] = Field(None, ge=-1.0, le=1.0)

# In patch_analysis — remove the /100 division:
if net_margin is not None:
    if not (-1.0 <= net_margin <= 1.0):
        raise HTTPException(400, "net_margin deve ser decimal entre -1.0 e 1.0.")
    analysis.net_margin = net_margin   # no /100
```

---

### C-3 · `routes/analysis.py` ~line 1980 — `inverse_projection` runs up to 30 sequential valuation calls with no payment gate

**File**: `app/routes/analysis.py`, endpoint `POST /analyses/inverse-projection`  
**Problems** (two separate issues in the same function):

**C-3a — No plan/payment check**: The endpoint only requires `Analysis.status == COMPLETED`. Any user whose analysis somehow reached COMPLETED without paying can access this premium feature. All other advanced endpoints (`/reanalyze`, `/simulate`) explicitly check `analysis.plan`.

```python
# MISSING — add after fetching the analysis:
if not analysis.plan:
    raise HTTPException(status_code=403,
        detail="Esta funcionalidade requer um plano pago.")
```

**C-3b — 30 blocking engine calls, no timeout**: The binary search (20 iterations) plus the chart curve (10 points) run **serially**:

```python
for _ in range(20):          # 20 sequential awaits
    mid = (lo + hi) / 2
    val = await _value_at(mid)   # each ~ 200–800 ms in thread
    ...
for i in range(10):          # 10 more
    v = await _value_at(x)
```

Total wall-clock time: 30 × ~500 ms = **~15 s per request**, monopolising a thread-pool slot. A handful of concurrent users can trigger thread-pool exhaustion.

**Fix** — use `asyncio.gather` for the chart curve and add a hard timeout:

```python
async def _value_at(x: float) -> float: ...   # unchanged

# Binary search stays sequential (dependency between iterations)
# But wrap in a timeout:
import asyncio
try:
    async with asyncio.timeout(30):
        for _ in range(20):
            mid = (lo + hi) / 2
            val = await _value_at(mid)
            ...
except asyncio.TimeoutError:
    raise HTTPException(504, "Cálculo excedeu o tempo máximo de 30 s.")

# Chart curve — run all 10 in parallel:
xs = [range_lo + (range_hi - range_lo) / 9 * i for i in range(10)]
curve_vals = await asyncio.gather(*[_value_at(x) for x in xs])
curve = [{"x": round(x * 100, 1), "equity": round(v, 0)} for x, v in zip(xs, curve_vals)]
```

---

## HIGH Issues

---

### H-1 · `routes/payments.py` ~line 290 — SSE stream leaks DB connections (one per poll tick)

**File**: `app/routes/payments.py`, `event_generator()` coroutine  
**Problem**: Inside the SSE generator a new `async_session_maker()` session is opened on **every 3-second tick**:

```python
async def event_gen():
    for _ in range(100):          # up to 5 minutes
        async with async_session_maker() as db:   # new connection each tick
            payment = await db.get(Payment, payment_id)
        ...
        await asyncio.sleep(3)
```

100 ticks × any concurrent user = 100 held DB connections per concurrent SSE subscriber. With asyncpg's default pool of 10–20 connections, a handful of simultaneous subscribers starves the rest of the application.

**Fix** — open one session for the entire lifetime of the generator:

```python
async def event_gen():
    async with async_session_maker() as db:
        for _ in range(100):
            payment = await db.get(Payment, payment_id)
            ...
            await asyncio.sleep(3)
```

---

### H-2 · `routes/notifications_routes.py` ~line 99 — paid payment notifications never appear

**File**: `app/routes/notifications_routes.py`  
**Problem**: Payment statuses stored by the webhook are uppercase enum values (`"PAID"`, `"RECEIVED"`), but the notification builder checks against lowercase strings:

```python
if status in ("paid", "received", "CONFIRMED", "RECEIVED"):   # "PAID" never matches
```

`PaymentStatus.PAID.value == "PAID"` — so paid payments always fall through and no "payment confirmed" notification is generated. Only `"RECEIVED"` would match, but the webhook stores `PaymentStatus.PAID`, not `PaymentStatus.RECEIVED`, for confirmed payments.

**Fix**:

```python
PAID_STATUSES = {
    PaymentStatus.PAID.value,
    PaymentStatus.RECEIVED.value,
    "CONFIRMED",   # legacy Asaas webhook value kept for safety
}
PENDING_STATUSES = {PaymentStatus.PENDING.value}

if status in PAID_STATUSES:
    ...
elif status in PENDING_STATUSES:
    ...
```

---

### H-3 · `routes/analysis.py` ~line 1430 — share-link password sent as GET query parameter

**File**: `app/routes/analysis.py`, endpoint `GET /analyses/public/{share_token}`

```python
async def get_public_analysis(
    share_token: str,
    password: Optional[str] = None,   # ← query param: ?password=...
    ...
```

Passwords in query strings are recorded in:
- Web server / reverse proxy access logs  
- Browser history and URL bar  
- CDN and analytics logs  

An attacker with access to any log file recovers passwords in plaintext.

**Fix** — receive the password in the request body via a `POST` (or as a custom header for GET if you need cacheability):

```python
class PublicAccessBody(BaseModel):
    password: Optional[str] = None

@router.post("/public/{share_token}")
async def get_public_analysis(
    share_token: str,
    body: PublicAccessBody = PublicAccessBody(),
    db: AsyncSession = Depends(get_db),
):
    ...
    if analysis.share_password_hash:
        if not body.password:
            raise HTTPException(401, "Senha obrigatória.")
        if not _share_pwd_ctx.verify(body.password, analysis.share_password_hash):
            raise HTTPException(401, "Senha incorreta.")
```

---

### H-4 · `routes/partner.py` ~line 620 — admin commission routes use manual `is_admin` check instead of `get_current_admin` dependency

**File**: `app/routes/partner.py`, endpoints:
- `PATCH /admin/commissions/{id}/approve`
- `PATCH /admin/commissions/{id}/pay`
- `POST /admin/partners/{id}/payout`
- `GET /admin/payout-summary`

All four use:

```python
current_user: User = Depends(get_current_user)
...
if not current_user.is_admin and not current_user.is_superadmin:
    raise HTTPException(403, ...)
```

This duplicates and deviates from the purpose of `get_current_admin`. If `get_current_admin` is ever changed (e.g., to add 2FA checking, IP allow-listing, or audit logging), these endpoints will not inherit those changes, silently bypassing the new security control.

**Fix** — use the canonical dependency everywhere:

```python
from app.services.auth_service import get_current_admin

async def admin_approve_commission(
    commission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),   # replaces manual check
):
    ...
```

---

### H-5 · `routes/admin.py` ~line 862 — coupon `discount_pct` validation missing on PATCH

**File**: `app/routes/admin.py`, `update_coupon` handler  
**Problem**: the `discount_pct` range guard (`0 < x <= 1`) is only applied in `create_coupon`. The `PATCH /admin/coupons/{id}` route uses the same `CouponCreate` body but skips the check:

```python
@router.patch("/coupons/{coupon_id}", ...)
async def update_coupon(data: CouponCreate, ...):
    # No validation!
    coupon.discount_pct = data.discount_pct   # could store 0, 1.5, 500, etc.
```

A `discount_pct > 1.0` would cause a 100 %+ discount, making products free or generating negative payment amounts.

**Fix**:

```python
async def update_coupon(data: CouponCreate, ...):
    if not (0 < data.discount_pct <= 1):
        raise HTTPException(400, "discount_pct deve estar entre 0 e 1.")
    ...
```

---

### H-6 · `routes/analysis.py` ~line 1213 — `submit_feedback` silently discards data

**File**: `app/routes/analysis.py`, `POST /analyses/feedback`

```python
@router.post("/feedback", status_code=201)
async def submit_feedback(payload: FeedbackCreate, ...):
    logger.info(f"[FEEDBACK] user={current_user.id} score={payload.score} ...")
    return {"message": "Feedback recebido.", "score": payload.score}
```

NPS scores and comments are logged to stdout only — never persisted. Log rotation or container restart erases them permanently. There is also no model or table for feedback, so there is no way to query aggregate NPS scores later.

**Fix** — either add a `Feedback` model and persist, or be explicit that this is a stub:

```python
# Option A: persist (recommended)
feedback = Feedback(
    user_id=current_user.id,
    analysis_id=payload.analysis_id,
    score=payload.score,
    comment=payload.comment,
)
db.add(feedback)
await db.commit()

# Option B: explicit stub until model is added
raise HTTPException(503, "Feedback temporariamente indisponível.")
```

---

### H-7 · `tasks/__init__.py` ~line 175 — `cleanup_trash` silently skips R2-stored logos

**File**: `app/tasks/__init__.py`, `cleanup_trash` function

```python
if analysis.logo_path:
    logo_full = os.path.join(_s.UPLOADS_DIR, analysis.logo_path.lstrip("/"))
    if os.path.exists(logo_full):
        os.remove(logo_full)
```

When R2 is active, `analysis.logo_path` contains an absolute HTTPS URL (e.g., `https://pub-xxx.r2.dev/logos/uuid.png`). After `lstrip("/")`, this becomes `https:/pub-xxx.r2.dev/...` — a valid filesystem path that will never exist. The file/object is never deleted from R2, leaking storage indefinitely as companies are permanently deleted.

**Fix**:

```python
from app.services.storage_service import _r2_configured, _get_s3_client
from app.core.config import settings as _s
import asyncio, os

if analysis.logo_path:
    if analysis.logo_path.startswith("http://") or analysis.logo_path.startswith("https://"):
        # R2 object — extract key and delete
        if _r2_configured():
            try:
                public_base = _s.R2_PUBLIC_URL.rstrip("/") + "/"
                key = analysis.logo_path.replace(public_base, "")
                client = _get_s3_client()
                await asyncio.to_thread(
                    client.delete_object,
                    Bucket=_s.R2_BUCKET_NAME,
                    Key=key,
                )
            except Exception as exc:
                logger.warning("[TRASH CLEANUP] R2 delete failed for %s: %s",
                               analysis.logo_path, exc)
    else:
        # Local filesystem
        logo_full = os.path.join(_s.UPLOADS_DIR, analysis.logo_path.lstrip("/"))
        if os.path.exists(logo_full):
            try:
                os.remove(logo_full)
            except OSError:
                pass
```

---

## MEDIUM Issues

---

### M-1 · `routes/admin.py` ~line 240 — revenue timeline uses `timedelta(days=30*i)` for monthly buckets

**File**: `app/routes/admin.py`, `revenue_timeline` function

```python
for i in range(months):
    period_start = now - timedelta(days=30 * i)
```

30-day increments drift from actual month boundaries by up to 3 days per month. A query from mid-November to mid-October and from mid-October to mid-September overlap on days 28–31. Revenue items near month ends are either double-counted or missed.

**Fix** — use `dateutil.relativedelta` or pure datetime arithmetic:

```python
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta

for i in range(months):
    period_end   = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0) \
                   - relativedelta(months=i)
    period_start = period_end - relativedelta(months=1)
```

---

### M-2 · `core/valuation_engine/engine.py` — sensitivity table can contain negative/zero discount rates

**File**: `app/core/valuation_engine/engine.py`, `calculate_sensitivity_table`

```python
dr_steps    = [wacc - 0.04 + 0.02 * i for i in range(5)]
growth_steps = [growth_rate - 0.04 + 0.02 * i for i in range(5)]
```

For a startup with `wacc = 0.15` and `growth_rate = 0.02`:
- `dr_steps` = `[0.11, 0.13, 0.15, 0.17, 0.19]` — fine  
- `growth_steps` = `[-0.02, 0.00, 0.02, 0.04, 0.06]` — negative and zero growth rates

When `growth_rate <= 0` enters the terminal value formula `TV = FCF_terminal / (WACC - g)`, the denominator grows and the result is mathematically valid but economically misleading (negative growth = perpetual shrinkage). More critically, when `dr_step ≈ growth_step`, the denominator approaches zero and produces an astronomically large (and meaningless) sensitivity value.

**Fix** — floor both series:

```python
dr_steps     = [max(0.06, wacc - 0.04 + 0.02 * i) for i in range(5)]
growth_steps = [max(0.00, growth_rate - 0.04 + 0.02 * i) for i in range(5)]
# Also guard against WACC ≈ g in the TV calculation:
spread = max(dr - g, 0.005)   # minimum 50 bps spread
tv = fcf_terminal / spread
```

---

### M-3 · `routes/analysis.py` ~line 1340 — `patch_analysis` `deleted_at` logic accepts arbitrary timestamps

**File**: `app/routes/analysis.py`, `patch_analysis`

```python
if deleted_at is not None:
    if deleted_at == "":
        analysis.deleted_at = None
    else:
        analysis.deleted_at = datetime.fromisoformat(deleted_at).replace(tzinfo=timezone.utc)
```

A client can set `deleted_at` to a **past** date (`"2020-01-01T00:00:00"`), instantly making the analysis eligible for hard-deletion in the next `cleanup_trash` run (which removes analyses with `deleted_at < now - 30 days`). An authenticated user can permanently delete their analysis bypassing the 30-day trash retention.

**Fix** — always use the current server time when soft-deleting:

```python
if deleted_at is not None:
    if deleted_at == "":
        analysis.deleted_at = None   # restore
    else:
        analysis.deleted_at = datetime.now(timezone.utc)   # always now
```

---

### M-4 · `routes/analysis.py` — `list_analyses` page_size allows 500 rows with no index hint

**File**: `app/routes/analysis.py`, `list_analyses`, line with `Query(50, ge=1, le=500)`

With 500 rows × rich JSON `valuation_result` column (potentially hundreds of KB each), a single request can fetch hundreds of MB from the database, serialise it, and return a multi-MB JSON response. This is a practical DoS vector for any authenticated user.

**Fix** — cap at 100 and add a database-level limit:

```python
page_size: int = Query(20, ge=1, le=100)
```

---

### M-5 · `routes/analysis.py` ~line 1219 — feedback endpoint accepts any `analysis_id` without ownership check

**File**: `app/routes/analysis.py`, `FeedbackCreate` / `submit_feedback`

The endpoint validates `analysis_id` exists in the pydantic model but never verifies it belongs to `current_user`. Any authenticated user can submit (or spam) feedback against another user's analysis ID.

**Fix**:

```python
analysis = (await db.execute(
    select(Analysis).where(
        Analysis.id == payload.analysis_id,
        Analysis.user_id == current_user.id,
    )
)).scalar_one_or_none()
if not analysis:
    raise HTTPException(404, "Análise não encontrada.")
```

---

### M-6 · `services/auth_service.py` line 1 — `register()` return type annotation incorrect

**File**: `app/services/auth_service.py`

```python
async def register(self, data: UserRegister) -> User:   # annotation says User
    ...
    return user, token   # actually returns (User, str) tuple
```

Callers in `auth.py` correctly unpack `user, token = await service.register(data)`, so the code works, but static type checkers (mypy, Pyright) will flag every caller as a type error, masking real type errors elsewhere.

**Fix**:

```python
from typing import Tuple
async def register(self, data: UserRegister) -> Tuple[User, str]:
```

---

### M-7 · `tasks/__init__.py` ~line 210 — abandoned-analysis task holds DB session open during SMTP calls

**File**: `app/tasks/__init__.py`, `send_abandoned_analysis_reminders`

```python
async with AsyncSessionLocal() as db:
    ...
    for analysis, email, full_name in rows:
        await send_analysis_abandoned_email(...)   # SMTP inside DB session
```

Email delivery (SMTP handshake + TLS + message transfer) can take 2–10 s per message. A batch of 50 reminders holds the DB connection open for up to 8 minutes, exhausting the connection pool for all other requests.

**Fix** — collect data, close the session, then send:

```python
async with AsyncSessionLocal() as db:
    rows = (await db.execute(...)).all()
    batch = [
        (analysis, email, full_name)
        for analysis, email, full_name in rows
    ]
# Session is now closed
for analysis, email, full_name in batch:
    try:
        await send_analysis_abandoned_email(...)
        sent += 1
    except Exception as exc:
        logger.error(...)
```

---

### M-8 · `routes/admin.py` admin CSV exports hard-coded `.limit(10000)`

**File**: `app/routes/admin.py`, `export_analyses_csv` and `export_payments_csv`

Both routes load up to 10 000 full ORM rows into memory, build a StringIO buffer, then stream it. For a production database with 50 000 analyses, a single admin export request loads ~50 MB of JSON valuation data into the worker process.

**Fix** — stream the CSV using server-side cursor pagination or SQLAlchemy `yield_per`:

```python
from sqlalchemy.orm import lazyload

result = await db.stream(
    select(Analysis, User.email.label("user_email"))
    ...
    .execution_options(yield_per=200)
)

output = io.StringIO()
writer = csv.writer(output)
writer.writerow([...headers...])

async for partition in result.partitions(200):
    for a, email in partition:
        writer.writerow([...])
    output.seek(0)
    yield output.read()
    output.seek(0)
    output.truncate(0)
```

---

## LOW Issues

---

### L-1 · `routes/partner.py` ~line 778 — `get_partner_ranking` Python-level `or` in SQLAlchemy filter

**File**: `app/routes/partner.py`

```python
.where(Partner.status == PartnerStatus.ACTIVE, (Partner.total_sales or 0) > 0)
```

`(Partner.total_sales or 0)` is evaluated in Python, not in SQL. `Partner.total_sales` is a SQLAlchemy `Column` object (always truthy), so `or 0` is dead code and the filter becomes `Partner.total_sales > 0`, which is correct SQL but for the wrong reason. If `total_sales` is `NULL`, asyncpg returns NULL for `NULL > 0`, which SQL treats as false — so NULLs are correctly excluded, but the intent is unclear and the code would break if refactored naively.

**Fix**:

```python
.where(
    Partner.status == PartnerStatus.ACTIVE,
    Partner.total_sales > 0,
)
```

---

### L-2 · `routes/pitch_deck.py` ~lines 97, 116 — `== None` instead of `.is_(None)` for soft-delete filter

**File**: `app/routes/pitch_deck.py`

```python
.where(PitchDeck.deleted_at == None)   # generates SAWarning in SQLAlchemy 2.x
```

SQLAlchemy 2.0 emits `SAWarning: Comparison to None using == is deprecated` for column comparisons with `None`. Use `.is_(None)` / `.is_not(None)`.

**Fix**:

```python
.where(PitchDeck.deleted_at.is_(None))
```

---

### L-3 · `routes/admin.py` ~line 1040 — audit log `limit` accepts up to 500 but `get_audit_log` may not paginate correctly

**File**: `app/routes/admin.py`

```python
limit: int = Query(100, ge=1, le=500),
offset: int = Query(0, ge=0),
...
entries = await get_audit_log(limit=limit, offset=offset)
```

`get_audit_log` reads from a Redis list (in `audit.py`). Redis `LRANGE` is O(N) on the range length. Fetching 500 entries when the list cap is 1000 entries is fine, but the function signature should document that the absolute maximum is 1000.

**Fix** — cap at `le=200` or document the Redis list cap:

```python
limit: int = Query(100, ge=1, le=200,
    description="Max 200; audit log is capped at 1000 entries in Redis.")
```

---

### L-4 · `tasks/__init__.py` ~line 255 — admin alert email body built with unsanitised HTML

**File**: `app/tasks/__init__.py`, `alert_stalled_analyses`

```python
items_html = "".join(
    f"<li>{a.company_name} — id={a.id}, user={email}, ...</li>"
    for a, email in rows
)
```

`a.company_name` is user-supplied text and is interpolated raw into HTML. If a company name contains `<script>` or `</li><li>...<`, the admin's email client could render broken or, in rare webmail clients, execute injected content. The risk is low (admin-only email), but the pattern is unsafe.

**Fix** — use `html.escape`:

```python
import html as _html
items_html = "".join(
    f"<li>{_html.escape(a.company_name)} — id={a.id}, "
    f"user={_html.escape(email or '')}, ...</li>"
    for a, email in rows
)
```

---

### L-5 · `core/config.py` ~line 12 — `APP_SECRET_KEY` has insecure default not validated

**File**: `app/core/config.py`

```python
APP_SECRET_KEY: str = "change-me"
```

`JWT_SECRET_KEY` is validated (raises `ValueError` if still `"change-me"` in production), but `APP_SECRET_KEY` has no such guard. It is used in share-link token generation and potentially in other signed URLs. If an operator deploys without setting this variable, tokens are trivially forgeable.

**Fix** — add the same validator:

```python
@model_validator(mode="after")
def validate_app_secret(self) -> "Settings":
    if self.APP_SECRET_KEY == "change-me" and self.ENVIRONMENT == "production":
        raise ValueError("APP_SECRET_KEY must be set in production.")
    return self
```

---

### L-6 · `routes/analysis.py` ~line 1695 — `get_valuation_history` query is unbounded

**File**: `app/routes/analysis.py`

```python
analyses = (await db.execute(
    select(Analysis)
    .where(
        Analysis.user_id == current_user.id,
        Analysis.company_name.ilike(f"%{safe_name}%"),
        ...
    )
    .order_by(Analysis.created_at.asc())
)).scalars().all()
```

No `.limit()` — all COMPLETED analyses matching the ILIKE search are loaded. A user with hundreds of re-analyses for the same company will load all of them. Additionally, `ilike(f"%{safe_name}%")` requires a full sequential scan of the `analyses` table (leading-wildcard LIKE cannot use a B-tree index).

**Fix**:

```python
.limit(200)
```

And consider adding a `trigram` index (`pg_trgm`) on `company_name` for production performance.

---

### L-7 · `routes/analysis.py` ~line 1310 — `note` update endpoint does not guard against SQL injection via `notes` field

**File**: `app/routes/analysis.py`, `update_notes`

The `notes` field accepts arbitrary text, which is stored via ORM (safe — parameterised). However there is no `max_length` validation, allowing unlimited payload sizes:

```python
notes: Optional[str] = Body(None, embed=True)   # unbounded
```

A malicious user can store megabytes of text per analysis, exhausting DB storage.

**Fix**:

```python
notes: Optional[str] = Body(None, max_length=50_000, embed=True)
```

---

### L-8 · `routes/analysis.py` — `generate_share_token` password-clear logic is inverted

**File**: `app/routes/analysis.py`, `generate_share_token`

```python
if body.password:
    analysis.share_password_hash = _share_pwd_ctx.hash(body.password)
else:
    # Explicitly passing no password clears any existing protection
    if body.password is not None:   # ← this is always False when body.password is falsy
        analysis.share_password_hash = None
```

The intent is: "if the client sends `{"password": null}` or omits the field, keep existing hash; if the client sends `{"password": ""}` (empty string), clear the hash." The current logic never clears the hash because `body.password is not None` is True only when `body.password` has a value, but the outer `else` branch is only reached when `body.password` is falsy (empty string or None).

```
body.password = None     → else branch → body.password is not None = False → no clear ✓ (intended)
body.password = ""       → else branch → body.password is not None = False → no clear ✗ (should clear)
body.password = "secret" → if branch  → hashes it ✓
```

So an empty string `""` silently fails to clear the password — the share link remains password-protected with no feedback to the user.

**Fix**:

```python
if body.password:
    analysis.share_password_hash = _share_pwd_ctx.hash(body.password)
elif body.password == "":          # empty string = explicit clear
    analysis.share_password_hash = None
# body.password is None = do not change existing hash
```

---

### L-9 · `tasks/__init__.py` — `cleanup_trash` does not delete `AnalysisVersion` snapshots

**File**: `app/tasks/__init__.py`, `cleanup_trash`

```python
for report in (await db.execute(...)).scalars().all():
    if report.file_path and os.path.exists(report.file_path):
        os.remove(report.file_path)
await db.delete(analysis)   # cascade deletes reports, but what about AnalysisVersion rows?
```

`Analysis` has `AnalysisVersion` children. Check models.py — if the `AnalysisVersion` FK to `Analysis` does not use `cascade="all, delete-orphan"` or `ondelete="CASCADE"`, those rows will be orphaned in the DB after hard-deletion, causing FK violations or accumulating dead rows indefinitely.

**Fix** — verify and add cascade:

```python
# In models.py, Analysis.versions relationship:
versions = relationship("AnalysisVersion", back_populates="analysis",
                        cascade="all, delete-orphan")
```

---

### L-10 · `routes/cnpj_routes.py` ~line 29 — CNPJ rate-limit counter is not atomic with expiry

**File**: `app/routes/cnpj_routes.py`

```python
async def _check_rate_limit(user_id: str) -> None:
    key = f"cnpj_rl:{user_id}"
    count = await redis_client.incr(key)
    if count == 1:
        await redis_client.expire(key, _RATE_LIMIT_TTL)
    if count > _RATE_LIMIT_MAX:
        raise HTTPException(429, ...)
```

There is a race condition between `INCR` and `EXPIRE`: two concurrent requests from the same user both see `count == 1` and both attempt to set `expire`. More critically, if the `EXPIRE` call fails (Redis timeout) after `INCR` succeeds, the key has no TTL and the user is permanently rate-limited.

**Fix** — use a single atomic pipeline:

```python
from app.core.redis import redis_client

async def _check_rate_limit(user_id: str) -> None:
    key = f"cnpj_rl:{user_id}"
    pipe = redis_client.pipeline()
    pipe.incr(key)
    pipe.expire(key, _RATE_LIMIT_TTL)
    results = await pipe.execute()
    count = results[0]
    if count > _RATE_LIMIT_MAX:
        raise HTTPException(429,
            f"Limite diário de {_RATE_LIMIT_MAX} consultas atingido.")
```

---

## Summary Table

| ID  | Severity | File | Issue |
|-----|----------|------|-------|
| C-1 | CRITICAL | `routes/diagnostico.py` | Email blocks HTTP response |
| C-2 | CRITICAL | `routes/analysis.py` | `net_margin` units inconsistent across 3 routes |
| C-3a | CRITICAL | `routes/analysis.py` | `inverse_projection` has no payment gate |
| C-3b | CRITICAL | `routes/analysis.py` | `inverse_projection` occupies thread pool with 30 serial engine calls |
| H-1 | HIGH | `routes/payments.py` | SSE stream leaks DB connection per poll tick |
| H-2 | HIGH | `routes/notifications_routes.py` | Paid payment notifications never shown (wrong enum case) |
| H-3 | HIGH | `routes/analysis.py` | Share-link password in GET query string → logged in plaintext |
| H-4 | HIGH | `routes/partner.py` | 4 admin routes bypass `get_current_admin` dependency |
| H-5 | HIGH | `routes/admin.py` | Coupon `discount_pct` not validated on PATCH |
| H-6 | HIGH | `routes/analysis.py` | Feedback submitted but never persisted |
| H-7 | HIGH | `tasks/__init__.py` | `cleanup_trash` skips R2-stored logos → storage leak |
| M-1 | MEDIUM | `routes/admin.py` | Revenue timeline uses 30-day approximation instead of calendar months |
| M-2 | MEDIUM | `valuation_engine/engine.py` | Sensitivity table can contain negative/zero discount rates |
| M-3 | MEDIUM | `routes/analysis.py` | `patch_analysis` accepts backdated `deleted_at`, bypassing 30-day retention |
| M-4 | MEDIUM | `routes/analysis.py` | `list_analyses` page_size up to 500 |
| M-5 | MEDIUM | `routes/analysis.py` | Feedback endpoint missing ownership check on `analysis_id` |
| M-6 | MEDIUM | `services/auth_service.py` | `register()` return type annotation wrong |
| M-7 | MEDIUM | `tasks/__init__.py` | Abandoned-analysis task holds DB open during SMTP |
| M-8 | MEDIUM | `routes/admin.py` | CSV exports hard-coded `.limit(10000)` loaded into memory |
| L-1 | LOW | `routes/partner.py` | Python-level `or` in SQLAlchemy filter (dead code) |
| L-2 | LOW | `routes/pitch_deck.py` | `== None` instead of `.is_(None)` |
| L-3 | LOW | `routes/admin.py` | Audit log `limit` up to 500 (misleading vs Redis cap of 1000) |
| L-4 | LOW | `tasks/__init__.py` | Unsanitised HTML in admin alert email body |
| L-5 | LOW | `core/config.py` | `APP_SECRET_KEY` insecure default not validated |
| L-6 | LOW | `routes/analysis.py` | `get_valuation_history` query is unbounded |
| L-7 | LOW | `routes/analysis.py` | `notes` field has no `max_length` → storage abuse |
| L-8 | LOW | `routes/analysis.py` | `generate_share_token` password-clear logic inverted |
| L-9 | LOW | `tasks/__init__.py` | `cleanup_trash` may orphan `AnalysisVersion` rows |
| L-10 | LOW | `routes/cnpj_routes.py` | CNPJ rate-limit INCR/EXPIRE is not atomic |

---

*End of audit — 4 CRITICAL · 7 HIGH · 8 MEDIUM · 10 LOW = 29 issues total*
