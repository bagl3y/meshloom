"""Tests for Web Push delivery transport behavior."""

import json
from types import SimpleNamespace
from unittest.mock import patch

import pytest
import requests

from app.push.send import (
    DEFAULT_PUSH_CONNECT_TIMEOUT_SECONDS,
    DEFAULT_PUSH_READ_TIMEOUT_SECONDS,
    IPV4_FALLBACK_CONNECT_TIMEOUT_SECONDS,
    IPv4HTTPAdapter,
    send_push,
)
from app.push.vapid import get_vapid_claims


@pytest.mark.asyncio
async def test_send_push_prefers_default_dual_stack_session_before_any_ipv4_fallback():
    """Successful sends should use the normal requests transport without forcing IPv4."""
    captured_kwargs: dict = {}

    def fake_webpush(**kwargs):
        captured_kwargs.update(kwargs)
        return SimpleNamespace(status_code=201)

    with patch("app.push.send.webpush", side_effect=fake_webpush):
        status = await send_push(
            subscription_info={"endpoint": "https://push.example.test", "keys": {}},
            payload='{"message":"hello"}',
            vapid_private_key="private-key",
            vapid_claims={"sub": "mailto:test@example.com"},
        )

    assert status == 201
    session = captured_kwargs["requests_session"]
    assert not isinstance(session.adapters["https://"], IPv4HTTPAdapter)
    assert captured_kwargs["timeout"] == (
        DEFAULT_PUSH_CONNECT_TIMEOUT_SECONDS,
        DEFAULT_PUSH_READ_TIMEOUT_SECONDS,
    )


@pytest.mark.asyncio
async def test_send_push_retries_with_ipv4_session_after_connect_timeout():
    """Connect failures should retry through the isolated IPv4-only transport."""
    calls: list[dict] = []

    def fake_webpush(**kwargs):
        calls.append(kwargs)
        if len(calls) == 1:
            raise requests.exceptions.ConnectTimeout("ipv6 connect timed out")
        return SimpleNamespace(status_code=201)

    with patch("app.push.send.webpush", side_effect=fake_webpush):
        status = await send_push(
            subscription_info={"endpoint": "https://push.example.test", "keys": {}},
            payload='{"message":"hello"}',
            vapid_private_key="private-key",
            vapid_claims={"sub": "mailto:test@example.com"},
        )

    assert status == 201
    assert len(calls) == 2
    assert not isinstance(calls[0]["requests_session"].adapters["https://"], IPv4HTTPAdapter)
    assert isinstance(calls[1]["requests_session"].adapters["https://"], IPv4HTTPAdapter)
    assert calls[0]["timeout"] == (
        DEFAULT_PUSH_CONNECT_TIMEOUT_SECONDS,
        DEFAULT_PUSH_READ_TIMEOUT_SECONDS,
    )
    assert calls[1]["timeout"] == (
        IPV4_FALLBACK_CONNECT_TIMEOUT_SECONDS,
        DEFAULT_PUSH_READ_TIMEOUT_SECONDS,
    )


def test_get_vapid_claims_defaults_to_meshcore_local():
    """Default subject is unchanged so existing deployments behave identically."""
    assert get_vapid_claims() == {"sub": "mailto:noreply@meshcore.local"}


def test_get_vapid_claims_honors_configured_subject(monkeypatch):
    """MESHCORE_VAPID_SUBJECT overrides the outgoing subject (required for APNs/iOS)."""
    monkeypatch.setattr("app.config.settings.vapid_subject", "mailto:ops@example.net")
    assert get_vapid_claims() == {"sub": "mailto:ops@example.net"}


def test_build_payload_defaults_to_french_titles():
    from app.push.manager import _build_payload

    dm = json.loads(
        _build_payload(
            {
                "type": "PRIV",
                "text": "hello",
                "sender_name": "Alice",
                "conversation_key": "aa" * 32,
            }
        )
    )
    assert dm["title"] == "Message de Alice"

    unnamed = json.loads(
        _build_payload({"type": "PRIV", "text": "hello", "conversation_key": "bb"})
    )
    assert unnamed["title"] == "Nouveau message privé"

    channel = json.loads(
        _build_payload({"type": "CHAN", "text": "hi", "conversation_key": "cc", "channel_name": ""})
    )
    assert channel["title"] == "Message de canal"


def test_build_payload_english_titles():
    from app.push.manager import _build_payload

    dm = json.loads(
        _build_payload(
            {
                "type": "PRIV",
                "text": "hello",
                "sender_name": "Alice",
                "conversation_key": "aa" * 32,
            },
            language="en",
        )
    )
    assert dm["title"] == "Message from Alice"

    unnamed = json.loads(
        _build_payload({"type": "PRIV", "text": "hello", "conversation_key": "bb"}, language="en")
    )
    assert unnamed["title"] == "New direct message"

    channel = json.loads(
        _build_payload(
            {"type": "CHAN", "text": "hi", "conversation_key": "cc", "channel_name": ""},
            language="en",
        )
    )
    assert channel["title"] == "Channel message"


@pytest.mark.asyncio
async def test_push_subscription_persists_language(test_db):
    from app.repository.push_subscriptions import PushSubscriptionRepository

    created = await PushSubscriptionRepository.create(
        endpoint="https://push.example.test/en",
        p256dh="p256",
        auth="auth",
        label="Chrome",
        language="en",
    )
    assert created["language"] == "en"

    defaulted = await PushSubscriptionRepository.create(
        endpoint="https://push.example.test/fr",
        p256dh="p256",
        auth="auth",
    )
    assert defaulted["language"] == "fr"

    updated = await PushSubscriptionRepository.update(defaulted["id"], language="en")
    assert updated is not None
    assert updated["language"] == "en"
