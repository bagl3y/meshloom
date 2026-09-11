"""CoreScope hop-directory client. Documented /api/spec, /api/resolve-hops, /api/nodes."""

from __future__ import annotations

import ipaddress
import logging
import re
import time
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit

import httpx
from fastapi import HTTPException

from app.models import (
    DirectoryHopHit,
    DirectoryMapNode,
    DirectoryMapNodesResponse,
    DirectoryNeighbor,
    DirectoryNeighborsResponse,
    DirectoryNodeSearchHit,
    DirectoryNodeSearchResponse,
    DirectoryReachNode,
    DirectoryReachObserver,
    DirectoryReachResponse,
    DirectoryResolveHopsResponse,
)
from app.repository import AppSettingsRepository
from app.repository.directory import (
    DIRECTORY_SOURCE_CORESCOPE,
    DirectoryHopCacheRepository,
)

logger = logging.getLogger(__name__)

ALLOWED_HOP_HEX_LENS = frozenset({4, 6})
CACHE_TTL_SECONDS = 86400
RESOLVE_TIMEOUT_SECONDS = 4.0
SPEC_TIMEOUT_SECONDS = 5.0
NODES_TIMEOUT_SECONDS = 8.0
NODES_PAGE_SIZE = 500
NODES_MAX_PAGES = 8
NODES_CACHE_TTL_SECONDS = 600
REACH_TIMEOUT_SECONDS = 8.0
REACH_CACHE_TTL_SECONDS = 300
NEIGHBORS_TIMEOUT_SECONDS = 8.0
NEIGHBORS_CACHE_TTL_SECONDS = 300
SEARCH_TIMEOUT_SECONDS = 6.0
SEARCH_CACHE_TTL_SECONDS = 60
MAX_JSON_BYTES = 2_000_000
PUBKEY_HEX_LEN = 64
MAX_HOPS = 64
_HEX_RE = re.compile(r"^[0-9A-Fa-f]+$")
_SKIP_CONFIDENCE = frozenset({"no_match", "conflict", "ambiguous"})
_nodes_cache: tuple[float, str, list[DirectoryMapNode]] | None = None
_reach_cache: dict[tuple[str, str], tuple[float, DirectoryReachResponse]] = {}
_neighbors_cache: dict[tuple[str, str], tuple[float, DirectoryNeighborsResponse]] = {}
_search_cache: dict[tuple[str, str], tuple[float, DirectoryNodeSearchResponse]] = {}


def normalize_directory_origin(raw: str) -> str:
    """Return scheme+host[+port] only. Empty input stays empty."""
    text = raw.strip()
    if not text:
        return ""
    if any(c.isspace() for c in text):
        raise ValueError("Directory URL must not contain whitespace")
    parsed = urlsplit(text)
    if parsed.scheme.lower() not in {"http", "https"}:
        raise ValueError("Directory URL must use http or https")
    if parsed.username or parsed.password or "@" in (parsed.netloc or ""):
        raise ValueError("Directory URL must not include credentials")
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Directory URL must include a host")
    try:
        ip = ipaddress.ip_address(hostname)
        host = f"[{ip.compressed}]" if isinstance(ip, ipaddress.IPv6Address) else ip.compressed
    except ValueError:
        host = hostname.lower()
    netloc = f"{host}:{parsed.port}" if parsed.port else host
    return urlunsplit((parsed.scheme.lower(), netloc, "", "", ""))


def validate_hop_prefixes(hops: list[str]) -> list[str]:
    """Normalize 2/3-byte hex prefixes. Reject any 1-byte prefix with 400."""
    if len(hops) > MAX_HOPS:
        raise HTTPException(status_code=400, detail=f"At most {MAX_HOPS} hops per request")
    one_byte: list[str] = []
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in hops:
        prefix = raw.strip().upper()
        if not prefix or not _HEX_RE.fullmatch(prefix):
            raise HTTPException(status_code=400, detail=f"Invalid hop prefix: {raw!r}")
        if len(prefix) == 2:
            one_byte.append(prefix)
            continue
        if len(prefix) not in ALLOWED_HOP_HEX_LENS:
            raise HTTPException(
                status_code=400,
                detail=f"Hop prefix must be 4 or 6 hex chars: {prefix}",
            )
        if prefix not in seen:
            seen.add(prefix)
            normalized.append(prefix)
    if one_byte:
        raise HTTPException(
            status_code=400,
            detail="1-byte hop prefixes are not resolved",
        )
    return normalized


def hash_width_for_prefix(prefix: str) -> int:
    return len(prefix) // 2


@dataclass(frozen=True)
class ParsedDirectoryHop:
    name: str | None
    public_key: str | None = None
    lat: float | None = None
    lon: float | None = None


def _normalize_pubkey(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    key = value.strip().lower()
    if len(key) != PUBKEY_HEX_LEN or not _HEX_RE.fullmatch(key):
        return None
    return key


def _gps_from_resolution(value: dict[str, object]) -> tuple[str | None, float | None, float | None]:
    pubkey = _normalize_pubkey(value.get("pubkey"))
    candidates = value.get("candidates")
    if isinstance(candidates, list) and candidates:
        first = candidates[0]
        if isinstance(first, dict):
            if pubkey is None:
                pubkey = _normalize_pubkey(first.get("pubkey"))
            lat = _as_float(first.get("lat"))
            lon = _as_float(first.get("lon"))
            if lat is not None and lon is not None and _is_valid_map_location(lat, lon):
                return pubkey, lat, lon
    return pubkey, None, None


def parse_corescope_resolved_hits(payload: object) -> dict[str, ParsedDirectoryHop | None]:
    """Map prefix → hop (or None for a conclusive no-match). Ignore undocumented keys."""
    if not isinstance(payload, dict):
        return {}
    resolved = payload.get("resolved")
    if not isinstance(resolved, dict):
        return {}
    out: dict[str, ParsedDirectoryHop | None] = {}
    for key, value in resolved.items():
        if not isinstance(key, str) or not isinstance(value, dict):
            continue
        prefix = key.strip().upper()
        if len(prefix) not in ALLOWED_HOP_HEX_LENS or not _HEX_RE.fullmatch(prefix):
            continue
        confidence = value.get("confidence")
        if isinstance(confidence, str) and confidence.lower() in _SKIP_CONFIDENCE:
            out[prefix] = None
            continue
        conflicts = value.get("conflicts")
        if isinstance(conflicts, list) and conflicts:
            out[prefix] = None
            continue
        name = value.get("name")
        label = name.strip() if isinstance(name, str) and name.strip() else None
        pubkey, lat, lon = _gps_from_resolution(value)
        out[prefix] = ParsedDirectoryHop(name=label, public_key=pubkey, lat=lat, lon=lon)
    return out


def parse_corescope_resolved(payload: object) -> dict[str, str | None]:
    """Map prefix → name (or None for a conclusive no-match). Ignore undocumented keys."""
    return {
        prefix: (hit.name if hit else None)
        for prefix, hit in parse_corescope_resolved_hits(payload).items()
    }


async def validate_corescope_spec(origin: str) -> None:
    """GET {origin}/api/spec must succeed with OpenAPI JSON before the URL is saved."""
    url = f"{origin}/api/spec"
    try:
        async with httpx.AsyncClient(
            follow_redirects=False, timeout=SPEC_TIMEOUT_SECONDS
        ) as client:
            response = await client.get(url)
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=400, detail=f"Could not reach CoreScope spec: {exc}"
        ) from exc
    if response.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail=f"CoreScope spec check failed (HTTP {response.status_code})",
        )
    try:
        body = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="CoreScope spec was not JSON") from exc
    if not isinstance(body, dict) or "openapi" not in body:
        raise HTTPException(status_code=400, detail="CoreScope spec is not OpenAPI")


async def _fetch_corescope_hops(
    origin: str, prefixes: list[str]
) -> dict[str, ParsedDirectoryHop | None]:
    url = f"{origin}/api/resolve-hops"
    try:
        async with httpx.AsyncClient(
            follow_redirects=False, timeout=RESOLVE_TIMEOUT_SECONDS
        ) as client:
            response = await client.get(url, params={"hops": ",".join(prefixes)})
    except httpx.RequestError as exc:
        logger.warning("CoreScope resolve-hops failed: %s", exc)
        return {}
    if response.status_code != 200:
        logger.warning("CoreScope resolve-hops HTTP %s", response.status_code)
        return {}
    try:
        payload = response.json()
    except ValueError:
        logger.warning("CoreScope resolve-hops returned non-JSON")
        return {}
    return parse_corescope_resolved_hits(payload)


def _hit_from_cache(row: object, hash_width: int) -> DirectoryHopHit | None:
    name = getattr(row, "name", None)
    source = getattr(row, "source", None)
    if not name or source != DIRECTORY_SOURCE_CORESCOPE:
        return None
    return DirectoryHopHit(
        name=name,
        source="corescope",
        hash_width=hash_width,
        public_key=getattr(row, "public_key", None),
        lat=getattr(row, "lat", None),
        lon=getattr(row, "lon", None),
    )


async def resolve_directory_hops(hops: list[str]) -> DirectoryResolveHopsResponse:
    prefixes = validate_hop_prefixes(hops)
    settings = await AppSettingsRepository.get()
    origin = (settings.directory_url or "").strip()
    if not settings.directory_enabled or not origin:
        return DirectoryResolveHopsResponse()

    keys = [(prefix, hash_width_for_prefix(prefix)) for prefix in prefixes]
    cached = await DirectoryHopCacheRepository.get_many(keys)
    resolved: dict[str, DirectoryHopHit] = {}
    misses: list[str] = []
    now = int(time.time())

    for prefix, hash_width in keys:
        row = cached.get((prefix, hash_width))
        if row is None or row.expired:
            misses.append(prefix)
            continue
        hit = _hit_from_cache(row, hash_width)
        if hit:
            resolved[prefix] = hit

    if misses:
        fetched = await _fetch_corescope_hops(origin, misses)
        expires_at = now + CACHE_TTL_SECONDS
        for prefix in misses:
            if prefix not in fetched:
                continue
            parsed = fetched[prefix]
            name = parsed.name if parsed else None
            hash_width = hash_width_for_prefix(prefix)
            await DirectoryHopCacheRepository.upsert(
                prefix,
                hash_width,
                name,
                DIRECTORY_SOURCE_CORESCOPE,
                expires_at,
                public_key=parsed.public_key if parsed else None,
                lat=parsed.lat if parsed else None,
                lon=parsed.lon if parsed else None,
            )
            if parsed and parsed.name:
                resolved[prefix] = DirectoryHopHit(
                    name=parsed.name,
                    source="corescope",
                    hash_width=hash_width,
                    public_key=parsed.public_key,
                    lat=parsed.lat,
                    lon=parsed.lon,
                )

    return DirectoryResolveHopsResponse(resolved=resolved)


async def reset_directory_cache() -> int:
    global _nodes_cache
    _nodes_cache = None
    _reach_cache.clear()
    _neighbors_cache.clear()
    _search_cache.clear()
    from app.services.observer_reach import reset_observer_reach_cache

    reset_observer_reach_cache()
    return await DirectoryHopCacheRepository.wipe()


def _is_valid_map_location(lat: float, lon: float) -> bool:
    if lat < -90 or lat > 90 or lon < -180 or lon > 180:
        return False
    return not (lat == 0.0 and lon == 0.0)


def _as_float(value: object) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int | float):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def parse_corescope_map_nodes(payload: object) -> tuple[list[DirectoryMapNode], int | None]:
    """Keep documented Node fields only: public_key, name, role, lat, lon."""
    if not isinstance(payload, dict):
        return [], None
    raw_nodes = payload.get("nodes")
    if not isinstance(raw_nodes, list):
        return [], None
    total = payload.get("total")
    total_n = total if isinstance(total, int) and total >= 0 else None
    nodes: list[DirectoryMapNode] = []
    seen: set[str] = set()
    for item in raw_nodes:
        if not isinstance(item, dict):
            continue
        public_key = item.get("public_key")
        if not isinstance(public_key, str):
            continue
        key = public_key.strip().lower()
        if len(key) != PUBKEY_HEX_LEN or not _HEX_RE.fullmatch(key) or key in seen:
            continue
        role = item.get("role")
        if not isinstance(role, str) or role.strip().lower() != "repeater":
            continue
        lat = _as_float(item.get("lat"))
        lon = _as_float(item.get("lon"))
        if lat is None or lon is None or not _is_valid_map_location(lat, lon):
            continue
        name = item.get("name")
        label = name.strip() if isinstance(name, str) and name.strip() else key[:12]
        seen.add(key)
        nodes.append(
            DirectoryMapNode(
                public_key=key,
                name=label,
                role="repeater",
                lat=lat,
                lon=lon,
                source="corescope",
            )
        )
    return nodes, total_n


def reset_directory_nodes_cache() -> None:
    global _nodes_cache
    _nodes_cache = None
    _reach_cache.clear()
    _neighbors_cache.clear()
    _search_cache.clear()


async def _fetch_corescope_nodes_page(
    origin: str, offset: int
) -> tuple[list[DirectoryMapNode], int | None]:
    url = f"{origin}/api/nodes"
    try:
        async with httpx.AsyncClient(
            follow_redirects=False, timeout=NODES_TIMEOUT_SECONDS
        ) as client:
            response = await client.get(
                url,
                params={
                    "role": "repeater",
                    "limit": NODES_PAGE_SIZE,
                    "offset": offset,
                },
            )
    except httpx.RequestError as exc:
        logger.warning("CoreScope nodes failed: %s", exc)
        return [], None
    if response.status_code != 200:
        logger.warning("CoreScope nodes HTTP %s", response.status_code)
        return [], None
    try:
        payload = response.json()
    except ValueError:
        logger.warning("CoreScope nodes returned non-JSON")
        return [], None
    return parse_corescope_map_nodes(payload)


async def list_directory_map_nodes() -> DirectoryMapNodesResponse:
    """Repeater GPS pins from CoreScope. Empty when the directory is off."""
    global _nodes_cache
    settings = await AppSettingsRepository.get()
    origin = (settings.directory_url or "").strip()
    if not settings.directory_enabled or not origin:
        return DirectoryMapNodesResponse()

    now = time.time()
    if _nodes_cache is not None and _nodes_cache[0] > now and _nodes_cache[1] == origin:
        return DirectoryMapNodesResponse(nodes=list(_nodes_cache[2]))

    merged: dict[str, DirectoryMapNode] = {}
    offset = 0
    for _ in range(NODES_MAX_PAGES):
        page, total = await _fetch_corescope_nodes_page(origin, offset)
        if not page and offset == 0:
            break
        new_on_page = 0
        for node in page:
            if node.public_key not in merged:
                merged[node.public_key] = node
                new_on_page += 1
        offset += NODES_PAGE_SIZE
        if len(page) < NODES_PAGE_SIZE:
            break
        if total is not None and offset >= total:
            break
        if new_on_page == 0:
            break

    nodes = list(merged.values())
    _nodes_cache = (now + NODES_CACHE_TTL_SECONDS, origin, nodes)
    return DirectoryMapNodesResponse(nodes=nodes)


def is_valid_map_location(lat: float, lon: float) -> bool:
    return _is_valid_map_location(lat, lon)


def validate_directory_pubkey(pubkey: str) -> str:
    key = pubkey.strip().lower()
    if len(key) != PUBKEY_HEX_LEN or not _HEX_RE.fullmatch(key):
        raise HTTPException(status_code=400, detail="Public key must be 64 hex characters")
    return key


async def _require_directory_origin() -> str | None:
    settings = await AppSettingsRepository.get()
    origin = (settings.directory_url or "").strip()
    if not settings.directory_enabled or not origin:
        return None
    return origin


async def _corescope_get_json(
    origin: str,
    path: str,
    *,
    timeout: float,
    params: dict[str, str | int] | None = None,
    empty_on_404: bool = False,
) -> object | None:
    """GET JSON from the saved CoreScope origin. HTTP 5xx/network is 500, never empty."""
    url = f"{origin}{path}"
    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=timeout) as client:
            response = await client.get(url, params=params)
    except httpx.RequestError as exc:
        logger.warning("CoreScope %s failed: %s", path, exc)
        raise HTTPException(status_code=500, detail="CoreScope request failed") from exc
    if response.status_code == 404 and empty_on_404:
        return None
    if response.status_code == 400:
        raise HTTPException(status_code=400, detail="CoreScope rejected the request")
    if response.status_code != 200:
        logger.warning("CoreScope %s HTTP %s", path, response.status_code)
        raise HTTPException(
            status_code=500,
            detail=f"CoreScope request failed (HTTP {response.status_code})",
        )
    content = getattr(response, "content", None)
    if isinstance(content, (bytes, bytearray)) and len(content) > MAX_JSON_BYTES:
        raise HTTPException(status_code=500, detail="CoreScope response too large")
    try:
        return response.json()
    except ValueError as exc:
        logger.warning("CoreScope %s returned non-JSON", path)
        raise HTTPException(status_code=500, detail="CoreScope returned non-JSON") from exc


async def _corescope_post_json(
    origin: str,
    path: str,
    *,
    timeout: float,
    body: dict[str, object],
    empty_on_404: bool = False,
) -> object | None:
    """POST JSON to the saved CoreScope origin. HTTP 5xx/network is 500, never empty."""
    url = f"{origin}{path}"
    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=timeout) as client:
            response = await client.post(url, json=body)
    except httpx.RequestError as exc:
        logger.warning("CoreScope %s failed: %s", path, exc)
        raise HTTPException(status_code=500, detail="CoreScope request failed") from exc
    if response.status_code == 404 and empty_on_404:
        return None
    if response.status_code == 400:
        raise HTTPException(status_code=400, detail="CoreScope rejected the request")
    if response.status_code != 200:
        logger.warning("CoreScope %s HTTP %s", path, response.status_code)
        raise HTTPException(
            status_code=500,
            detail=f"CoreScope request failed (HTTP {response.status_code})",
        )
    content = getattr(response, "content", None)
    if isinstance(content, (bytes, bytearray)) and len(content) > MAX_JSON_BYTES:
        raise HTTPException(status_code=500, detail="CoreScope response too large")
    try:
        return response.json()
    except ValueError as exc:
        logger.warning("CoreScope %s returned non-JSON", path)
        raise HTTPException(status_code=500, detail="CoreScope returned non-JSON") from exc


def parse_corescope_reach(payload: object, pubkey: str) -> DirectoryReachResponse:
    """Keep documented reach fields: node GPS + 0-hop direct_observers."""
    if not isinstance(payload, dict):
        return DirectoryReachResponse(directory_enabled=True)
    node_payload = payload.get("node")
    node: DirectoryReachNode | None = None
    if isinstance(node_payload, dict):
        key = _normalize_pubkey(node_payload.get("pubkey") or node_payload.get("public_key"))
        name = node_payload.get("name")
        role = node_payload.get("role")
        lat = _as_float(node_payload.get("lat"))
        lon = _as_float(node_payload.get("lon"))
        if lat is not None and lon is not None and not _is_valid_map_location(lat, lon):
            lat, lon = None, None
        node = DirectoryReachNode(
            public_key=key or pubkey,
            name=name.strip() if isinstance(name, str) and name.strip() else None,
            role=role.strip() if isinstance(role, str) and role.strip() else None,
            lat=lat,
            lon=lon,
        )
    observers: list[DirectoryReachObserver] = []
    seen: set[str] = set()
    raw_observers = payload.get("direct_observers")
    if isinstance(raw_observers, list):
        for item in raw_observers:
            if not isinstance(item, dict):
                continue
            key = _normalize_pubkey(item.get("pubkey") or item.get("public_key"))
            if not key or key in seen:
                continue
            lat = _as_float(item.get("lat"))
            lon = _as_float(item.get("lon"))
            if lat is None or lon is None or not _is_valid_map_location(lat, lon):
                continue
            name = item.get("name")
            label = name.strip() if isinstance(name, str) and name.strip() else key[:12]
            count = item.get("count")
            snr = _as_float(item.get("avg_snr"))
            seen.add(key)
            observers.append(
                DirectoryReachObserver(
                    public_key=key,
                    name=label,
                    count=count if isinstance(count, int) and count >= 0 else 0,
                    avg_snr=snr,
                    lat=lat,
                    lon=lon,
                )
            )
    return DirectoryReachResponse(node=node, observers=observers, directory_enabled=True)


def parse_corescope_neighbors(payload: object) -> DirectoryNeighborsResponse:
    if not isinstance(payload, dict):
        return DirectoryNeighborsResponse(directory_enabled=True)
    raw = payload.get("neighbors")
    if not isinstance(raw, list):
        return DirectoryNeighborsResponse(directory_enabled=True)
    neighbors: list[DirectoryNeighbor] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        if item.get("unresolved") is True:
            continue
        ambiguous = bool(item.get("ambiguous"))
        key = _normalize_pubkey(item.get("pubkey") or item.get("public_key"))
        prefix_raw = item.get("prefix")
        prefix = (
            prefix_raw.strip().upper()
            if isinstance(prefix_raw, str) and _HEX_RE.fullmatch(prefix_raw.strip())
            else None
        )
        name = item.get("name")
        lat = _as_float(item.get("lat"))
        lon = _as_float(item.get("lon"))
        if lat is not None and lon is not None and not _is_valid_map_location(lat, lon):
            lat, lon = None, None
        count = item.get("count")
        score = _as_float(item.get("score"))
        snr = _as_float(item.get("avg_snr"))
        neighbors.append(
            DirectoryNeighbor(
                public_key=key,
                prefix=prefix,
                name=name.strip() if isinstance(name, str) and name.strip() else None,
                count=count if isinstance(count, int) and count >= 0 else 0,
                score=score,
                avg_snr=snr,
                lat=lat,
                lon=lon,
                ambiguous=ambiguous,
            )
        )
    return DirectoryNeighborsResponse(neighbors=neighbors, directory_enabled=True)


def parse_corescope_node_search(payload: object) -> DirectoryNodeSearchResponse:
    if not isinstance(payload, dict):
        return DirectoryNodeSearchResponse(directory_enabled=True)
    raw = payload.get("nodes")
    if not isinstance(raw, list):
        return DirectoryNodeSearchResponse(directory_enabled=True)
    nodes: list[DirectoryNodeSearchHit] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        key = _normalize_pubkey(item.get("public_key") or item.get("pubkey"))
        if not key or key in seen:
            continue
        lat = _as_float(item.get("lat"))
        lon = _as_float(item.get("lon"))
        if lat is not None and lon is not None and not _is_valid_map_location(lat, lon):
            lat, lon = None, None
        name = item.get("name")
        role = item.get("role")
        last_seen = item.get("last_seen")
        seen.add(key)
        nodes.append(
            DirectoryNodeSearchHit(
                public_key=key,
                name=name.strip() if isinstance(name, str) and name.strip() else None,
                role=role.strip() if isinstance(role, str) and role.strip() else None,
                lat=lat,
                lon=lon,
                last_seen=last_seen if isinstance(last_seen, str) else None,
            )
        )
    return DirectoryNodeSearchResponse(nodes=nodes, directory_enabled=True)


async def get_directory_node_reach(pubkey: str) -> DirectoryReachResponse:
    key = validate_directory_pubkey(pubkey)
    origin = await _require_directory_origin()
    if origin is None:
        return DirectoryReachResponse()
    now = time.time()
    cached = _reach_cache.get((origin, key))
    if cached is not None and cached[0] > now:
        return cached[1]
    payload = await _corescope_get_json(
        origin,
        f"/api/nodes/{key}/reach",
        timeout=REACH_TIMEOUT_SECONDS,
        empty_on_404=True,
    )
    result = (
        DirectoryReachResponse(directory_enabled=True)
        if payload is None
        else parse_corescope_reach(payload, key)
    )
    _reach_cache[(origin, key)] = (now + REACH_CACHE_TTL_SECONDS, result)
    return result


async def get_directory_node_neighbors(pubkey: str) -> DirectoryNeighborsResponse:
    key = validate_directory_pubkey(pubkey)
    origin = await _require_directory_origin()
    if origin is None:
        return DirectoryNeighborsResponse()
    now = time.time()
    cached = _neighbors_cache.get((origin, key))
    if cached is not None and cached[0] > now:
        return cached[1]
    payload = await _corescope_get_json(
        origin,
        f"/api/nodes/{key}/neighbors",
        timeout=NEIGHBORS_TIMEOUT_SECONDS,
        empty_on_404=True,
    )
    result = (
        DirectoryNeighborsResponse(directory_enabled=True)
        if payload is None
        else parse_corescope_neighbors(payload)
    )
    _neighbors_cache[(origin, key)] = (now + NEIGHBORS_CACHE_TTL_SECONDS, result)
    return result


async def search_directory_nodes(query: str) -> DirectoryNodeSearchResponse:
    q = query.strip()
    if not q:
        raise HTTPException(status_code=400, detail="Search query is required")
    origin = await _require_directory_origin()
    if origin is None:
        return DirectoryNodeSearchResponse()
    now = time.time()
    cache_key = (origin, q.lower())
    cached = _search_cache.get(cache_key)
    if cached is not None and cached[0] > now:
        return cached[1]
    payload = await _corescope_get_json(
        origin,
        "/api/nodes/search",
        timeout=SEARCH_TIMEOUT_SECONDS,
        params={"q": q},
    )
    result = parse_corescope_node_search(payload)
    _search_cache[cache_key] = (now + SEARCH_CACHE_TTL_SECONDS, result)
    return result
