"""Web Push dispatch manager.

Handles filtering subscriptions by their preferences and sending push
notifications concurrently when a new message arrives.
"""

import asyncio
import json
import logging

from pywebpush import WebPushException

from app.push.send import send_push
from app.push.vapid import get_vapid_private_key
from app.repository.push_subscriptions import PushSubscriptionRepository

logger = logging.getLogger(__name__)

_SEND_TIMEOUT = 10  # seconds per push send
_VAPID_CLAIMS = {"sub": "mailto:noreply@meshcore.local"}


def _state_key_for_message(data: dict) -> str:
    """Derive the conversation state key from a message event payload."""
    msg_type = data.get("type", "")
    conversation_key = data.get("conversation_key", "")
    if msg_type == "PRIV":
        return f"contact-{conversation_key}"
    return f"channel-{conversation_key}"


def _matches_filter(sub: dict, data: dict) -> bool:
    """Check whether a message event matches a subscription's filter."""
    mode = sub.get("filter_mode", "all_messages")
    if mode == "all_messages":
        return True
    if mode == "all_dms":
        return data.get("type") == "PRIV"
    if mode == "selected":
        key = _state_key_for_message(data)
        return key in (sub.get("filter_conversations") or [])
    return False


def _build_payload(data: dict) -> str:
    """Build the push notification JSON payload from a message event."""
    msg_type = data.get("type", "")
    text = data.get("text", "")
    sender_name = data.get("sender_name") or ""
    channel_name = data.get("channel_name") or ""

    if msg_type == "PRIV":
        title = f"Message from {sender_name}" if sender_name else "New direct message"
        body = text
    else:
        # Channel messages include "SenderName: text" in the text field
        title = f"#{channel_name}" if channel_name else "Channel message"
        body = text

    conversation_key = data.get("conversation_key", "")
    if msg_type == "PRIV":
        url_hash = f"#contact/{conversation_key}"
    else:
        url_hash = f"#channel/{conversation_key}"

    return json.dumps(
        {
            "title": title,
            "body": body,
            "tag": f"meshcore-{data.get('id', '')}",
            "url_hash": url_hash,
        }
    )


def _subscription_info(sub: dict) -> dict:
    """Build the subscription_info dict that pywebpush expects."""
    return {
        "endpoint": sub["endpoint"],
        "keys": {
            "p256dh": sub["p256dh"],
            "auth": sub["auth"],
        },
    }


class PushManager:
    async def dispatch_message(self, data: dict) -> None:
        """Send push notifications for a message event to matching subscriptions."""
        # Don't notify for messages the operator just sent themselves
        if data.get("outgoing"):
            return

        try:
            subs = await PushSubscriptionRepository.get_all()
        except Exception:
            logger.debug("Push dispatch: failed to load subscriptions", exc_info=True)
            return

        if not subs:
            return

        matching = [s for s in subs if _matches_filter(s, data)]
        if not matching:
            return

        payload = _build_payload(data)
        vapid_key = get_vapid_private_key()
        if not vapid_key:
            logger.debug("Push dispatch: no VAPID key configured, skipping")
            return

        tasks = [self._send_one(sub, payload, vapid_key) for sub in matching]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _send_one(self, sub: dict, payload: str, vapid_key: str) -> None:
        sub_id = sub["id"]
        try:
            async with asyncio.timeout(_SEND_TIMEOUT):
                await send_push(
                    subscription_info=_subscription_info(sub),
                    payload=payload,
                    vapid_private_key=vapid_key,
                    vapid_claims=_VAPID_CLAIMS,
                )
            await PushSubscriptionRepository.record_success(sub_id)
        except WebPushException as e:
            status = getattr(e, "response", None)
            status_code = getattr(status, "status_code", 0) if status else 0
            if status_code in (404, 410):
                logger.info(
                    "Push subscription expired (HTTP %d), removing %s",
                    status_code,
                    sub_id,
                )
                await PushSubscriptionRepository.delete(sub_id)
            else:
                logger.warning("Push send failed for %s: %s", sub_id, e)
                await PushSubscriptionRepository.record_failure(sub_id)
        except TimeoutError:
            logger.warning("Push send timed out for %s", sub_id)
            await PushSubscriptionRepository.record_failure(sub_id)
        except Exception:
            logger.debug("Push send error for %s", sub_id, exc_info=True)
            await PushSubscriptionRepository.record_failure(sub_id)


push_manager = PushManager()
