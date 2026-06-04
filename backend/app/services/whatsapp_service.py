"""
WhatsApp notification service stub.
Valuora uses email as the primary notification channel.
This module is a placeholder for future WhatsApp integration.
"""
import logging

logger = logging.getLogger(__name__)


async def send_whatsapp_message(to_number: str, message: str) -> bool:
    """Send a WhatsApp message. Currently a no-op stub."""
    logger.info("[WhatsApp] stub — would send to %s: %s", to_number, message[:80])
    return False
