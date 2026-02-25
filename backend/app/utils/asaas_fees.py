"""
Utilitário para taxas e prazos de recebimento Asaas.

Taxas vigentes (pós-promoção 16/01/2026):
  PIX:    R$ 1,99 por cobrança recebida
  Boleto: R$ 1,99 por boleto pago
  Cartão à vista:    2,99% + R$ 0,49
  Cartão 2-6x:       3,49% + R$ 0,49
  Cartão 7-12x:      3,99% + R$ 0,49
  Cartão 13-21x:     4,29% + R$ 0,49

Prazos de recebimento:
  PIX:    Instantâneo
  Boleto: 1 dia útil após o pagamento
  Cartão: 32 dias após o pagamento
"""
from typing import Optional


# ─── Taxas ────────────────────────────────────────────────
def estimate_asaas_fee(amount: float, billing_type: str, installment_count: Optional[int] = None) -> float:
    """
    Estima a taxa Asaas para um valor e método de pagamento.
    Usado apenas quando o webhook não trouxer netValue (fallback).
    """
    billing_type = (billing_type or "").upper()

    if billing_type in ("PIX",):
        return 1.99

    if billing_type == "BOLETO":
        return 1.99

    if billing_type == "CREDIT_CARD":
        count = installment_count or 1
        if count <= 1:
            pct = 0.0299
        elif count <= 6:
            pct = 0.0349
        elif count <= 12:
            pct = 0.0399
        else:  # 13–21
            pct = 0.0429
        return round(amount * pct + 0.49, 2)

    return 0.0


def net_from_gross(amount: float, billing_type: str, installment_count: Optional[int] = None) -> float:
    """Calcula valor líquido estimado quando o Asaas não enviou netValue."""
    return round(amount - estimate_asaas_fee(amount, billing_type, installment_count), 2)


# ─── Prazos de recebimento ────────────────────────────────
SETTLEMENT_INFO = {
    "PIX": {
        "label": "Pix",
        "settlement": "Instantâneo",
        "settlement_days": 0,
        "description": "Recebimento imediato após confirmação.",
    },
    "BOLETO": {
        "label": "Boleto Bancário",
        "settlement": "1 dia útil",
        "settlement_days": 1,
        "description": "Recebimento em 1 dia útil após o pagamento.",
    },
    "CREDIT_CARD": {
        "label": "Cartão de Crédito",
        "settlement": "32 dias",
        "settlement_days": 32,
        "description": "Recebimento em 32 dias após o pagamento.",
    },
    "DEBIT_CARD": {
        "label": "Cartão de Débito",
        "settlement": "1 dia útil",
        "settlement_days": 1,
        "description": "Recebimento em 1 dia útil.",
    },
    "UNDEFINED": {
        "label": "Não identificado",
        "settlement": "—",
        "settlement_days": None,
        "description": "",
    },
}


def get_settlement_info(billing_type: Optional[str]) -> dict:
    key = (billing_type or "UNDEFINED").upper()
    return SETTLEMENT_INFO.get(key, SETTLEMENT_INFO["UNDEFINED"])


# ─── Descritivo para e-mail/painel do parceiro ────────────
def fee_breakdown_text(gross: float, net: float, fee: float, billing_type: str,
                       installment_count: Optional[int] = None) -> str:
    info = get_settlement_info(billing_type)
    label = info["label"]
    if billing_type == "CREDIT_CARD" and installment_count and installment_count > 1:
        label = f"Cartão de Crédito {installment_count}x"
    return (
        f"Valor bruto: R$ {gross:.2f} | "
        f"Taxa Asaas ({label}): R$ {fee:.2f} | "
        f"Valor líquido: R$ {net:.2f} | "
        f"Recebimento: {info['settlement']}"
    )
