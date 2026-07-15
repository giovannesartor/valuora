"""
Asaas payment gateway integration.
https://docs.asaas.com/reference
"""
import httpx
from typing import Optional, Dict, Any, List
from app.core.config import settings


# Shared persistent httpx client — avoids creating a new connection pool per request.
# Initialized lazily on first use so settings are available at import time.
_asaas_client: Optional[httpx.AsyncClient] = None


def _get_asaas_client(headers: dict) -> httpx.AsyncClient:
    global _asaas_client
    if _asaas_client is None or _asaas_client.is_closed:
        _asaas_client = httpx.AsyncClient(
            headers=headers,
            timeout=30.0,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
    return _asaas_client


class AsaasService:
    """Client for Asaas payment API."""

    def __init__(self):
        self.api_url = settings.ASAAS_API_URL
        self.headers = {
            "access_token": settings.ASAAS_API_KEY,
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, endpoint: str, data: dict = None) -> Dict[str, Any]:
        client = _get_asaas_client(self.headers)
        url = f"{self.api_url}/{endpoint}"
        response = await client.request(method, url, json=data)
        if response.status_code >= 400:
            error_data = response.json() if response.text else {}
            error_detail = error_data.get("errors", [{}])[0].get("description", "") if isinstance(error_data.get("errors"), list) else str(error_data)
            raise Exception(f"Asaas API error ({response.status_code}): {error_detail or response.text}")
        return response.json()

    async def find_or_create_customer(
        self,
        name: str,
        email: str,
        cpf_cnpj: Optional[str] = None,
        phone: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Find an existing customer by email or CPF/CNPJ, or create a new one.

        Reusing an existing customer lets the same person buy again (valuation,
        ebook, etc.) instead of failing — Asaas may block creating a second
        customer with a CPF/CNPJ that already exists.
        """
        from urllib.parse import quote

        # 1) Search by email
        search = await self._request("GET", f"customers?email={quote(email, safe='')}")
        if not search.get("error") and search.get("data") and len(search["data"]) > 0:
            return search["data"][0]

        # 2) Search by CPF/CNPJ (same person may reuse a different e-mail)
        if cpf_cnpj:
            by_doc = await self._request("GET", f"customers?cpfCnpj={quote(cpf_cnpj, safe='')}")
            if not by_doc.get("error") and by_doc.get("data") and len(by_doc["data"]) > 0:
                return by_doc["data"][0]

        # 3) Create a new customer
        customer_data = {
            "name": name,
            "email": email,
        }
        if cpf_cnpj:
            customer_data["cpfCnpj"] = cpf_cnpj
        if phone:
            customer_data["mobilePhone"] = phone

        try:
            return await self._request("POST", "customers", customer_data)
        except Exception:
            # Asaas can reject a duplicate CPF/CNPJ — fall back to the existing record
            if cpf_cnpj:
                retry = await self._request("GET", f"customers?cpfCnpj={quote(cpf_cnpj, safe='')}")
                if not retry.get("error") and retry.get("data") and len(retry["data"]) > 0:
                    return retry["data"][0]
            raise

    async def create_payment(
        self,
        customer_id: str,
        value: float,
        description: str,
        external_reference: str,
        billing_type: str = "UNDEFINED",  # PIX, BOLETO, CREDIT_CARD, UNDEFINED (all options)
        due_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a payment/charge on Asaas.
        billingType: UNDEFINED shows all options, PIX is most common in BR.
        """
        from datetime import datetime, timedelta

        if not due_date:
            due_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")

        payment_data = {
            "customer": customer_id,
            "billingType": billing_type,
            "value": value,
            "dueDate": due_date,
            "description": description,
            "externalReference": external_reference,
        }

        return await self._request("POST", "payments", payment_data)

    async def get_payment(self, payment_id: str) -> Dict[str, Any]:
        """Get payment details."""
        return await self._request("GET", f"payments/{payment_id}")

    async def get_customer(self, customer_id: str) -> Dict[str, Any]:
        """Get customer details by Asaas customer id."""
        return await self._request("GET", f"customers/{customer_id}")

    async def get_payment_pix_qr(self, payment_id: str) -> Dict[str, Any]:
        """Get PIX QR code for a payment."""
        return await self._request("GET", f"payments/{payment_id}/pixQrCode")

    async def get_payment_invoice_url(self, payment_id: str) -> Dict[str, Any]:
        """Get invoice/payment URL."""
        return await self._request("GET", f"payments/{payment_id}/identificationField")

    async def list_payments_by_reference(self, external_reference: str) -> List[Dict[str, Any]]:
        """List Asaas payments filtered by externalReference (our analysis UUID)."""
        result = await self._request("GET", f"payments?externalReference={external_reference}&limit=10")
        return result.get("data", [])

    async def refund_payment(self, payment_id: str) -> Dict[str, Any]:
        """Refund a payment."""
        return await self._request("POST", f"payments/{payment_id}/refund")


asaas_service = AsaasService()
