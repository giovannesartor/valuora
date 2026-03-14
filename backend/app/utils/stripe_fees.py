"""
Stripe fee calculation and settlement info for the US market.

Stripe US pricing (as of 2025):
- Cards:          2.9% + $0.30 per successful charge
- International:  +1.5% for international cards
- ACH Direct Debit: 0.8% (capped at $5.00)
- Link:           2.9% + $0.30 (same as cards)
"""


def calculate_stripe_fee(amount: float, method: str = "CREDIT_CARD", international: bool = False) -> dict:
    """Calculate Stripe processing fee for a given amount and method."""
    if method in ("CREDIT_CARD", "DEBIT_CARD", "LINK"):
        pct = 0.029
        if international:
            pct += 0.015  # +1.5% for international cards
        fee = round(amount * pct + 0.30, 2)
    elif method == "ACH":
        fee = min(round(amount * 0.008, 2), 5.00)
    else:
        fee = round(amount * 0.029 + 0.30, 2)  # default to card rate

    net = round(amount - fee, 2)
    return {"fee": fee, "net": net, "rate_label": f"{fee / amount * 100:.1f}%" if amount > 0 else "0%"}


def get_settlement_info(method: str | None) -> dict:
    """Return settlement timing info for a payment method."""
    method = (method or "").upper()
    info = {
        "CREDIT_CARD": {"settlement": "2 business days", "settlement_days": 2},
        "DEBIT_CARD":  {"settlement": "2 business days", "settlement_days": 2},
        "ACH":         {"settlement": "3-5 business days", "settlement_days": 5},
        "LINK":        {"settlement": "2 business days", "settlement_days": 2},
    }
    return info.get(method, {"settlement": "2 business days", "settlement_days": 2})
