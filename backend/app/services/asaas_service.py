"""
Asaas payment gateway integration.
https://docs.asaas.com/reference
"""
import httpx
from typing import Optional, Dict, Any
from app.core.config import settings


class AsaasService:
    """Client for Asaas payment API."""

    def __init__(self):
        self.api_url = settings.ASAAS_API_URL
        self.headers = {
            "access_token": settings.ASAAS_API_KEY,
            "Content-Type": "application/json",
        }

    async def _request(self, method: str, endpoint: str, data: dict = None) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            url = f"{self.api_url}/{endpoint}"
            response = await client.request(method, url, headers=self.headers, json=data, timeout=30)
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
        """Find existing customer by email, or create a new one."""
        # Search by email
        search = await self._request("GET", f"customers?email={email}")
        if not search.get("error") and search.get("data") and len(search["data"]) > 0:
            return search["data"][0]

        # Create new customer
        customer_data = {
            "name": name,
            "email": email,
        }
        if cpf_cnpj:
            customer_data["cpfCnpj"] = cpf_cnpj
        if phone:
            customer_data["mobilePhone"] = phone

        return await self._request("POST", "customers", customer_data)

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

    async def get_payment_pix_qr(self, payment_id: str) -> Dict[str, Any]:
        """Get PIX QR code for a payment."""
        return await self._request("GET", f"payments/{payment_id}/pixQrCode")

    async def get_payment_invoice_url(self, payment_id: str) -> Dict[str, Any]:
        """Get invoice/payment URL."""
        return await self._request("GET", f"payments/{payment_id}/identificationField")


asaas_service = AsaasService()
