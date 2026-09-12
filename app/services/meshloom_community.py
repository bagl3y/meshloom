"""Meshloom Stats community state, JWT mint, and HTTP client.

Community is one opt-out: off means no Stats MQTT publish and no Stats HTTP.
Env names are MESHLOOM_* only — do not invent MESHCORE_COMMUNITY aliases.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit

import httpx
from fastapi import HTTPException

from app.models import CommunityStatus

logger = logging.getLogger(__name__)

SYSTEM_MESHLOOM_STATS_ID = "system:meshloom-stats"  # keep in sync with app.fanout.manager
DEFAULT_BROKER_HOST = "mqtt.example.invalid"
DEFAULT_API_BASE = "https://api.example.invalid"
DEFAULT_BROKER_PORT = 443
MQTT_KEEPALIVE_SECONDS = 30
_IATA_RE = re.compile(r"^[A-Z]{3}$")
_STATS_TIMEOUT_SECONDS = 8.0


def _env_raw(name: str) -> str:
    return os.environ.get(name, "").strip()


def community_locked() -> bool:
    return _env_raw("MESHLOOM_COMMUNITY_LOCKED") == "1"


def env_community_opt_in() -> bool:
    """True only when MESHLOOM_COMMUNITY=1. Unset or 0 is opted out."""
    return _env_raw("MESHLOOM_COMMUNITY") == "1"


def env_community_iata() -> str:
    return _normalize_iata(_env_raw("MESHLOOM_COMMUNITY_IATA"))


def env_community_broker_host() -> str:
    return _env_raw("MESHLOOM_COMMUNITY_BROKER_HOST")


def env_community_api_base() -> str:
    return _env_raw("MESHLOOM_COMMUNITY_API_BASE")


def _normalize_iata(raw: str) -> str:
    code = raw.upper().strip()
    return code if _IATA_RE.fullmatch(code) else ""


def normalize_api_base(raw: str) -> str:
    text = (raw or "").strip().rstrip("/")
    if not text:
        return ""
    parsed = urlsplit(text if "://" in text else f"https://{text}")
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise ValueError("API base must be an http(s) origin")
    host = parsed.hostname.lower()
    netloc = f"{host}:{parsed.port}" if parsed.port else host
    return f"{parsed.scheme.lower()}://{netloc}"


def host_without_scheme(url_or_host: str) -> str:
    text = (url_or_host or "").strip()
    if not text:
        return ""
    parsed = urlsplit(text if "://" in text else f"https://{text}")
    return (parsed.hostname or text).lower()


@dataclass(frozen=True)
class CommunityRecord:
    enabled: bool
    iata: str
    broker_host: str
    api_base: str


@dataclass(frozen=True)
class CommunityEffective:
    enabled: bool
    locked: bool
    iata: str
    broker_host: str
    api_base: str
    api_audience: str
    mqtt_audience: str

    @property
    def publisher_configured(self) -> bool:
        return self.enabled and bool(self.iata)


async def get_community_record() -> CommunityRecord:
    from app.repository.settings import AppSettingsRepository

    return await AppSettingsRepository.get_community()


async def get_community_effective() -> CommunityEffective:
    row = await get_community_record()
    iata = env_community_iata() or row.iata
    broker = env_community_broker_host() or row.broker_host or DEFAULT_BROKER_HOST
    api_base = env_community_api_base() or row.api_base or DEFAULT_API_BASE
    try:
        api_base = normalize_api_base(api_base) or DEFAULT_API_BASE
    except ValueError:
        api_base = DEFAULT_API_BASE
    return CommunityEffective(
        enabled=row.enabled,
        locked=community_locked(),
        iata=_normalize_iata(iata),
        broker_host=broker,
        api_base=api_base,
        api_audience=host_without_scheme(api_base),
        mqtt_audience=host_without_scheme(broker),
    )


async def community_enabled() -> bool:
    return (await get_community_effective()).enabled


async def seed_community_from_env(*, new_install: bool) -> None:
    """Write env defaults only for a brand-new database. Existing DBs stay opted out."""
    from app.repository.settings import AppSettingsRepository

    if not new_install:
        return
    row = await get_community_record()
    if row.enabled or row.iata or row.broker_host or row.api_base:
        return
    enabled = env_community_opt_in()
    iata = env_community_iata()
    broker = env_community_broker_host()
    api_raw = env_community_api_base()
    api_base = ""
    if api_raw:
        try:
            api_base = normalize_api_base(api_raw)
        except ValueError:
            logger.warning("Ignoring invalid MESHLOOM_COMMUNITY_API_BASE")
    await AppSettingsRepository.update_community(
        enabled=enabled,
        iata=iata,
        broker_host=broker,
        api_base=api_base,
    )
    if enabled:
        logger.info("Seeded Meshloom Stats community on from MESHLOOM_COMMUNITY=1")


async def update_community(
    *,
    enabled: bool | None = None,
    iata: str | None = None,
    broker_host: str | None = None,
    api_base: str | None = None,
) -> CommunityEffective:
    from app.repository.settings import AppSettingsRepository

    row = await get_community_record()
    if enabled is True and community_locked():
        raise HTTPException(
            status_code=403, detail="Community enable is locked by MESHLOOM_COMMUNITY_LOCKED"
        )
    next_iata = row.iata
    if iata is not None:
        normalized = _normalize_iata(iata)
        if iata.strip() and not normalized:
            raise HTTPException(status_code=400, detail="IATA must be exactly 3 uppercase letters")
        next_iata = normalized
    next_broker = row.broker_host
    if broker_host is not None:
        next_broker = broker_host.strip()
    next_api = row.api_base
    if api_base is not None:
        raw = api_base.strip()
        if raw:
            try:
                next_api = normalize_api_base(raw)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
        else:
            next_api = ""
    await AppSettingsRepository.update_community(
        enabled=enabled,
        iata=next_iata if iata is not None else None,
        broker_host=next_broker if broker_host is not None else None,
        api_base=next_api if api_base is not None else None,
    )
    state = await get_community_effective()
    await _reload_system_publisher()
    return state


async def _reload_system_publisher() -> None:
    from app.fanout.manager import fanout_manager

    await fanout_manager.reload_system_module(SYSTEM_MESHLOOM_STATS_ID)


def mint_stats_jwt(*, audience: str, iata: str = "", require_iata: bool = False) -> str:
    from app.fanout.community_mqtt import _generate_jwt_token
    from app.keystore import get_private_key, get_public_key

    private_key = get_private_key()
    public_key = get_public_key()
    if private_key is None or public_key is None:
        raise HTTPException(status_code=503, detail="Radio key is not available")
    if require_iata and not iata:
        raise HTTPException(status_code=400, detail="IATA is required for Meshloom Stats tokens")
    return _generate_jwt_token(private_key, public_key, audience=audience, iata=iata)


def radio_gps_or_none() -> tuple[float | None, float | None]:
    from app.services.radio_runtime import radio_runtime as radio_manager

    try:
        info = radio_manager.meshcore.self_info if radio_manager.meshcore else None
        if not isinstance(info, dict):
            return None, None
        lat = float(info.get("adv_lat") or 0.0)
        lon = float(info.get("adv_lon") or 0.0)
        if lat == 0.0 and lon == 0.0:
            return None, None
        return lat, lon
    except (TypeError, ValueError, AttributeError):
        return None, None


def publisher_connected() -> bool:
    from app.fanout.manager import fanout_manager

    entry = fanout_manager._modules.get(SYSTEM_MESHLOOM_STATS_ID)
    if entry is None:
        return False
    return entry[0].status == "connected"


async def community_status() -> CommunityStatus:
    state = await get_community_effective()
    return CommunityStatus(
        enabled=state.enabled,
        locked=state.locked,
        iata=state.iata,
        broker_host=state.broker_host,
        api_base=state.api_base,
        publisher_configured=state.publisher_configured,
        publisher_connected=publisher_connected(),
        env_seeded=env_community_opt_in(),
    )


def _require_enabled(state: CommunityEffective) -> None:
    if not state.enabled:
        raise HTTPException(status_code=403, detail="Community is disabled")


async def stats_request(
    method: str,
    path: str,
    *,
    auth: bool,
    params: dict[str, str | int] | None = None,
    json_body: dict[str, Any] | None = None,
    timeout: float = _STATS_TIMEOUT_SECONDS,
) -> httpx.Response:
    """HTTP to Meshloom Stats. Raises 403 when community is off (never calls)."""
    state = await get_community_effective()
    _require_enabled(state)
    headers: dict[str, str] = {}
    if auth:
        # jwt.md: API `iata` is required for `/v1/me/*` writes, not directory reads.
        # Directory must keep working when community is on but IATA is still unbound.
        headers["Authorization"] = (
            f"Bearer {mint_stats_jwt(audience=state.api_audience, iata=state.iata, require_iata=path.startswith('/v1/me/'))}"
        )
    url = f"{state.api_base}{path}"
    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=timeout) as client:
            return await client.request(method, url, params=params, json=json_body, headers=headers)
    except httpx.RequestError as exc:
        logger.warning("Meshloom Stats %s %s failed: %s", method, path, exc)
        raise HTTPException(status_code=500, detail="Stats request failed") from exc


def _json_or_500(response: httpx.Response, *, path: str) -> object:
    if response.status_code == 429:
        raise HTTPException(status_code=429, detail="Stats IATA change cap reached")
    if response.status_code == 401:
        raise HTTPException(status_code=502, detail="Stats rejected the radio token")
    if response.status_code == 400:
        raise HTTPException(status_code=400, detail="Stats rejected the request")
    if response.status_code != 200:
        logger.warning("Meshloom Stats %s HTTP %s", path, response.status_code)
        raise HTTPException(
            status_code=500,
            detail=f"Stats request failed (HTTP {response.status_code})",
        )
    try:
        return response.json()
    except ValueError as exc:
        logger.warning("Meshloom Stats %s returned non-JSON", path)
        raise HTTPException(status_code=500, detail="Stats returned non-JSON") from exc


async def stats_json(
    method: str,
    path: str,
    *,
    auth: bool,
    params: dict[str, str | int] | None = None,
    json_body: dict[str, Any] | None = None,
) -> object:
    response = await stats_request(method, path, auth=auth, params=params, json_body=json_body)
    return _json_or_500(response, path=path)


def unwrap_directory_envelope(payload: object) -> object:
    """Map Stats directory envelope. unavailable / invalid → HTTP 500, never []."""
    if not isinstance(payload, dict):
        raise HTTPException(status_code=500, detail="Stats directory unavailable")
    status = payload.get("status")
    if status == "unavailable":
        raise HTTPException(status_code=500, detail="Stats directory unavailable")
    if status not in {"complete", "partial"}:
        raise HTTPException(status_code=500, detail="Stats directory unavailable")
    data = payload.get("data")
    if not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="Stats directory unavailable")
    return data


async def stats_directory_get(
    path: str,
    *,
    params: dict[str, str | int] | None = None,
) -> object:
    payload = await stats_json("GET", path, auth=True, params=params)
    return unwrap_directory_envelope(payload)


async def stats_directory_post(path: str, json_body: dict[str, Any]) -> object:
    payload = await stats_json("POST", path, auth=True, json_body=json_body)
    return unwrap_directory_envelope(payload)
