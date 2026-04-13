"""Web Push subscription management endpoints."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.push.send import send_push
from app.push.vapid import get_vapid_private_key, get_vapid_public_key
from app.repository.push_subscriptions import PushSubscriptionRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/push", tags=["push"])


# ── Request/response models ─────────────────────────────────────────────


class VapidPublicKeyResponse(BaseModel):
    public_key: str


class PushSubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=1)
    p256dh: str = Field(min_length=1)
    auth: str = Field(min_length=1)
    label: str = ""


class PushSubscriptionUpdate(BaseModel):
    label: str | None = None
    filter_mode: str | None = None
    filter_conversations: list[str] | None = None


# ── Endpoints ────────────────────────────────────────────────────────────


@router.get("/vapid-public-key", response_model=VapidPublicKeyResponse)
async def vapid_public_key() -> VapidPublicKeyResponse:
    """Return the VAPID public key for browser PushManager.subscribe()."""
    key = get_vapid_public_key()
    if not key:
        raise HTTPException(status_code=503, detail="VAPID keys not initialized")
    return VapidPublicKeyResponse(public_key=key)


@router.post("/subscribe")
async def subscribe(body: PushSubscribeRequest) -> dict:
    """Register or update a push subscription. Upserts by endpoint."""
    sub = await PushSubscriptionRepository.create(
        endpoint=body.endpoint,
        p256dh=body.p256dh,
        auth=body.auth,
        label=body.label,
    )
    return sub


@router.get("/subscriptions")
async def list_subscriptions() -> list[dict]:
    """List all push subscriptions."""
    return await PushSubscriptionRepository.get_all()


@router.patch("/subscriptions/{subscription_id}")
async def update_subscription(subscription_id: str, body: PushSubscriptionUpdate) -> dict:
    """Update a subscription's label or filter preferences."""
    existing = await PushSubscriptionRepository.get(subscription_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Subscription not found")

    updates = {}
    if body.label is not None:
        updates["label"] = body.label
    if body.filter_mode is not None:
        if body.filter_mode not in ("all_messages", "all_dms", "selected"):
            raise HTTPException(status_code=400, detail="Invalid filter_mode")
        updates["filter_mode"] = body.filter_mode
    if body.filter_conversations is not None:
        updates["filter_conversations"] = body.filter_conversations

    result = await PushSubscriptionRepository.update(subscription_id, **updates)
    return result or existing


@router.delete("/subscriptions/{subscription_id}")
async def unsubscribe(subscription_id: str) -> dict:
    """Delete a push subscription."""
    deleted = await PushSubscriptionRepository.delete(subscription_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return {"deleted": True}


@router.post("/subscriptions/{subscription_id}/test")
async def test_push(subscription_id: str) -> dict:
    """Send a test notification to a subscription."""
    sub = await PushSubscriptionRepository.get(subscription_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    vapid_key = get_vapid_private_key()
    if not vapid_key:
        raise HTTPException(status_code=503, detail="VAPID keys not initialized")

    import json

    payload = json.dumps(
        {
            "title": "RemoteTerm Test",
            "body": "Push notifications are working!",
            "tag": "meshcore-test",
            "url_hash": "",
        }
    )

    try:
        await send_push(
            subscription_info={
                "endpoint": sub["endpoint"],
                "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
            },
            payload=payload,
            vapid_private_key=vapid_key,
            vapid_claims={"sub": "mailto:noreply@meshcore.local"},
        )
        return {"status": "sent"}
    except Exception as e:
        logger.warning("Test push failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Push delivery failed: {e}") from None
