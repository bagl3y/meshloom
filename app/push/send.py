"""Thin wrapper around pywebpush for sending push notifications.

Isolates the pywebpush dependency and runs the synchronous send in
a thread executor to avoid blocking the event loop.
"""

import asyncio
import logging

from pywebpush import webpush

logger = logging.getLogger(__name__)


async def send_push(
    subscription_info: dict,
    payload: str,
    vapid_private_key: str,
    vapid_claims: dict,
) -> int:
    """Send an encrypted push notification.

    Args:
        subscription_info: {"endpoint": ..., "keys": {"p256dh": ..., "auth": ...}}
        payload: JSON string to encrypt and send
        vapid_private_key: PEM-encoded VAPID private key
        vapid_claims: {"sub": "mailto:..."} or {"sub": "https://..."}

    Returns:
        HTTP status code from the push service.

    Raises:
        WebPushException: on push service error (caller handles 404/410 cleanup).
    """
    loop = asyncio.get_running_loop()
    response = await loop.run_in_executor(
        None,
        lambda: webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=vapid_private_key,
            vapid_claims=vapid_claims,
        ),
    )
    return response.status_code  # type: ignore[union-attr]
