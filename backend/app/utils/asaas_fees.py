"""
Payment fee utilities for Valuora (Stripe / USD).

Stripe standard rates (US):
  Card (domestic): 2.9% + $0.30 per successful charge
  Card (international): 3.9% + $0.30
  ACH / bank transfer: 0.8%, capped at $5.00
  Wire transfer: $0 fee (bank fees may apply on sender side)

Settlement timing:
  Card: 2 business days after payment
  ACH:  3–5 business days
  Wire: 1–2 business days

Note: actual net amounts come from Stripe webhook events (charge.succeeded → balance_transaction).
These helpers are used only as fallback estimates when Stripe hasn't yet reported net_amount.
"""
from typing import Optional


# ─── Fee estimation ───────────────────────────────────────
def estimate_stripe_fee(
    amount: float,
    billing_type: str,
    is_international: bool = False,
) -> float:
    """
    Estimate the Stripe fee for a given amount and billing type.
    Used as a fallback when the webhook has not yet delivered net_amount.
    """
    billing_type = (billing_type or "").upper()

    if billing_type in ("CARD", "CREDIT_CARD"):
        pct = 0.039 if is_international else 0.029
        return round(amount * pct + 0.30, 2)

    if billing_type in ("ACH", "BANK_TRANSFER", "BANK_DEBIT"):
        fee = amount * 0.008
        return round(min(fee, 5.00), 2)

    if billing_type in ("WIRE", "WIRE_TRANSFER"):
        return 0.0

    # Unknown / default — use card domestic rate
    return round(amount * 0.029 + 0.30, 2)


# Backwards-compat alias (used by routes that imported asaas_fees.estimate_asaas_fee)
estimate_asaas_fee = estimate_stripe_fee


def net_from_gross(
    amount: float,
    billing_type: str,
    is_international: bool = False,
) -> float:
    """Return estimated net amount after Stripe fees."""
    return round(amount - estimate_stripe_fee(amount, billing_type, is_international), 2)


# ─── Settlement info ──────────────────────────────────────
SETTLEMENT_INFO = {
    "CARD": {
        "label": "Credit / Debit Card",
        "settlement": "2 business days",
        "settlement_days": 2,
        "description": "Funds arrive in 2 business days after payment.",
    },
    "CREDIT_CARD": {
        "label": "Credit Card",
        "settlement": "2 business days",
        "settlement_days": 2,
        "description": "Funds arrive in 2 business days after payment.",
    },
    "ACH": {
        "label": "ACH / Bank Transfer",
        "settlement": "3–5 business days",
        "settlement_days": 5,
        "description": "Funds arrive in 3–5 business days.",
    },
    "BANK_TRANSFER": {
        "label": "Bank Transfer",
        "settlement": "3–5 business days",
        "settlement_days": 5,
        "description": "Funds arrive in 3–5 business days.",
    },
    "WIRE": {
        "label": "Wire Transfer",
        "settlement": "1–2 business days",
        "settlement_days": 2,
        "description": "Funds arrive in 1–2 business days.",
    },
    "WIRE_TRANSFER": {
        "label": "Wire Transfer",
        "settlement": "1–2 business days",
        "settlement_days": 2,
        "description": "Funds arrive in 1–2 business days.",
    },
    "UNDEFINED": {
        "label": "Not identified",
        "settlement": "—",
        "settlement_days": None,
        "description": "",
    },
}


def get_settlement_info(billing_type: Optional[str]) -> dict:
    key = (billing_type or "UNDEFINED").upper()
    return SETTLEMENT_INFO.get(key, SETTLEMENT_INFO["UNDEFINED"])


def fee_breakdown_text(
    gross: float,
    net: float,
    fee: float,
    billing_type: str,
    is_international: bool = False,
) -> str:
    info = get_settlement_info(billing_type)
    label = info["label"]
    return (
        f"Gross: ${gross:.2f} | "
        f"Stripe fee ({label}): ${fee:.2f} | "
        f"Net: ${net:.2f} | "
        f"Settlement: {info['settlement']}"
    )
