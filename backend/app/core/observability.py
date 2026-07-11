"""Small observability helper: log an exception AND report it to Sentry.

Use in critical `try/except` blocks (payment webhooks, PDF generation, valuation
engine) where the exception is swallowed so the flow continues, but we still want
real-time alerting instead of it being buried in logs.

`sentry_sdk.capture_exception` is a safe no-op when Sentry is not configured.
"""
import logging
from typing import Optional

logger = logging.getLogger("app.observability")

try:  # sentry-sdk is a hard dependency, but stay resilient if import fails
    import sentry_sdk
except Exception:  # pragma: no cover
    sentry_sdk = None


def report_exc(exc: BaseException, context: str, **tags) -> None:
    """Log `exc` as an error and forward it to Sentry with optional tags/context."""
    logger.error("[%s] %s: %s", context, type(exc).__name__, exc, exc_info=True)
    if sentry_sdk is None:
        return
    try:
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("context", context)
            for key, value in tags.items():
                if value is not None:
                    scope.set_tag(key, str(value))
            sentry_sdk.capture_exception(exc)
    except Exception:  # never let error-reporting raise
        pass
