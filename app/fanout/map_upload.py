"""Fanout module for uploading heard advert packets to map.meshcore.dev.

Mirrors the logic of the standalone map.meshcore.dev-uploader project:
- Listens on raw RF packets via on_raw
- Filters for ADVERT packets, skips CHAT nodes (device_role == 1)
- Skips nodes with no valid location (lat/lon None)
- Applies per-pubkey rate-limiting (1-hour window, matching the uploader)
- Signs the upload request with the radio's own Ed25519 private key
- POSTs to the map API (or logs in dry-run mode)

Dry-run mode (default: True) logs the full would-be payload at INFO level
without making any HTTP requests. Disable it only after verifying the log
output looks correct — in particular the radio params (freq/bw/sf/cr) and
the raw hex link.

Config keys
-----------
api_url : str, default ""
    Upload endpoint. Empty string falls back to the public map.meshcore.dev API.
dry_run : bool, default True
    When True, log the payload at INFO level instead of sending it.
geofence_enabled : bool, default False
    When True, only upload nodes whose location falls within the configured
    radius of the reference point below.
geofence_lat : float, default 0.0
    Latitude of the geofence centre (decimal degrees).
geofence_lon : float, default 0.0
    Longitude of the geofence centre (decimal degrees).
geofence_radius_km : float, default 0.0
    Radius of the geofence in kilometres. Nodes further than this distance
    from (geofence_lat, geofence_lon) are skipped.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math

import httpx

from app.decoder import parse_advertisement, parse_packet
from app.fanout.base import FanoutModule
from app.keystore import get_private_key, get_public_key
from app.services.radio_runtime import radio_runtime

logger = logging.getLogger(__name__)

_DEFAULT_API_URL = "https://map.meshcore.dev/api/v1/uploader/node"

# Re-upload guard: skip re-uploading a pubkey seen within this window (AU parity)
_REUPLOAD_SECONDS = 3600

# Device role 1 = CHAT — skip these; repeaters (2) and rooms (3) are the map targets
_SKIP_DEVICE_ROLES = {1}

# Ed25519 group order (L)
_L = 2**252 + 27742317777372353535851937790883648493


def _ed25519_sign_expanded(
    message: bytes, scalar: bytes, prefix: bytes, public_key: bytes
) -> bytes:
    """Sign using MeshCore's expanded Ed25519 key format.

    MeshCore stores 64-byte keys as scalar(32) || prefix(32). Standard
    Ed25519 libraries expect seed format and would re-SHA-512 the key, so
    we perform the signing manually using the already-expanded key material.

    Mirrors the implementation in app/fanout/community_mqtt.py.
    """
    import nacl.bindings

    r = int.from_bytes(hashlib.sha512(prefix + message).digest(), "little") % _L
    R = nacl.bindings.crypto_scalarmult_ed25519_base_noclamp(r.to_bytes(32, "little"))
    k = int.from_bytes(hashlib.sha512(R + public_key + message).digest(), "little") % _L
    s = (r + k * int.from_bytes(scalar, "little")) % _L
    return R + s.to_bytes(32, "little")


def _get_radio_params() -> dict:
    """Read radio frequency parameters from the connected radio's self_info.

    The standalone AU divides raw freq/bw values by 1000 before sending.
    The meshcore Python library returns radio_freq and radio_bw at the same
    scale as the JS library, so we apply the same /1000 division.

    IMPORTANT: verify the actual values in dry_run logs before enabling live
    sends. The units reported by the Python library should be confirmed; if
    the logged freq/bw look wrong (e.g. 0.915 instead of 915000), the
    division factor here may need adjusting.
    """
    try:
        mc = radio_runtime.meshcore
        if not mc:
            return {"freq": 0, "cr": 0, "sf": 0, "bw": 0}
        info = mc.self_info
        if not isinstance(info, dict):
            return {"freq": 0, "cr": 0, "sf": 0, "bw": 0}
        freq = info.get("radio_freq", 0) or 0
        bw = info.get("radio_bw", 0) or 0
        sf = info.get("radio_sf", 0) or 0
        cr = info.get("radio_cr", 0) or 0
        return {
            "freq": freq / 1000.0 if freq else 0,
            "cr": cr,
            "sf": sf,
            "bw": bw / 1000.0 if bw else 0,
        }
    except Exception:
        pass
    return {"freq": 0, "cr": 0, "sf": 0, "bw": 0}


_ROLE_NAMES: dict[int, str] = {2: "repeater", 3: "room", 4: "sensor"}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return the great-circle distance in kilometres between two lat/lon points."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


class MapUploadModule(FanoutModule):
    """Uploads heard ADVERT packets to the MeshCore community map."""

    def __init__(self, config_id: str, config: dict, *, name: str = "") -> None:
        super().__init__(config_id, config, name=name)
        self._client: httpx.AsyncClient | None = None
        self._last_error: str | None = None
        # Per-pubkey rate limiting: pubkey_hex -> last_uploaded_advert_timestamp
        self._seen: dict[str, int] = {}

    async def start(self) -> None:
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(15.0))
        self._last_error = None
        self._seen.clear()

    async def stop(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    async def on_raw(self, data: dict) -> None:
        if data.get("payload_type") != "ADVERT":
            return

        raw_hex = data.get("data", "")
        if not raw_hex:
            return

        try:
            raw_bytes = bytes.fromhex(raw_hex)
        except ValueError:
            return

        packet_info = parse_packet(raw_bytes)
        if packet_info is None:
            return

        advert = parse_advertisement(packet_info.payload, raw_packet=raw_bytes)
        if advert is None:
            return

        # TODO: advert Ed25519 signature verification is skipped here.
        # The radio has already validated the packet before passing it to RT,
        # so re-verification is redundant in practice. If added, verify that
        # nacl.bindings.crypto_sign_open(sig + (pubkey_bytes || timestamp_bytes),
        # advert.public_key_bytes) succeeds before proceeding.

        # Skip CHAT-type nodes (role 1) — map only shows repeaters (2) and rooms (3)
        if advert.device_role in _SKIP_DEVICE_ROLES:
            return

        # Skip nodes with no valid location — the decoder already nulls out
        # impossible values, so None means either no location flag or bad coords.
        if advert.lat is None or advert.lon is None:
            logger.debug(
                "MapUpload: skipping %s — no valid location",
                advert.public_key[:12],
            )
            return

        pubkey = advert.public_key.lower()

        # Rate-limit: skip if this pubkey's timestamp hasn't advanced enough
        last_seen = self._seen.get(pubkey)
        if last_seen is not None:
            if last_seen >= advert.timestamp:
                logger.debug(
                    "MapUpload: skipping %s — possible replay (last=%d, advert=%d)",
                    pubkey[:12],
                    last_seen,
                    advert.timestamp,
                )
                return
            if advert.timestamp < last_seen + _REUPLOAD_SECONDS:
                logger.debug(
                    "MapUpload: skipping %s — within 1-hr rate-limit window (delta=%ds)",
                    pubkey[:12],
                    advert.timestamp - last_seen,
                )
                return

        await self._upload(pubkey, advert.timestamp, advert.device_role, raw_hex, advert.lat, advert.lon)

    async def _upload(
        self,
        pubkey: str,
        advert_timestamp: int,
        device_role: int,
        raw_hex: str,
        lat: float,
        lon: float,
    ) -> None:
        # Geofence check: if enabled, skip nodes outside the configured radius
        if self.config.get("geofence_enabled"):
            fence_lat = float(self.config.get("geofence_lat", 0) or 0)
            fence_lon = float(self.config.get("geofence_lon", 0) or 0)
            fence_radius_km = float(self.config.get("geofence_radius_km", 0) or 0)
            dist_km = _haversine_km(fence_lat, fence_lon, lat, lon)
            if dist_km > fence_radius_km:
                logger.debug(
                    "MapUpload: skipping %s — outside geofence (%.2f km > %.2f km)",
                    pubkey[:12],
                    dist_km,
                    fence_radius_km,
                )
                return

        private_key = get_private_key()
        public_key = get_public_key()

        if private_key is None or public_key is None:
            logger.warning(
                "MapUpload: private key not available — cannot sign upload for %s. "
                "Ensure radio firmware has ENABLE_PRIVATE_KEY_EXPORT=1.",
                pubkey[:12],
            )
            return

        api_url = str(self.config.get("api_url", "") or _DEFAULT_API_URL).strip()
        dry_run = bool(self.config.get("dry_run", True))
        role_name = _ROLE_NAMES.get(device_role, f"role={device_role}")

        params = _get_radio_params()
        upload_data = {
            "params": params,
            "links": [f"meshcore://{raw_hex}"],
        }

        # Sign: SHA-256 the compact JSON, then Ed25519-sign the hash
        json_str = json.dumps(upload_data, separators=(",", ":"))
        data_hash = hashlib.sha256(json_str.encode()).digest()
        scalar = private_key[:32]
        prefix_bytes = private_key[32:]
        signature = _ed25519_sign_expanded(data_hash, scalar, prefix_bytes, public_key)

        request_payload = {
            "data": json_str,
            "signature": signature.hex(),
            "publicKey": public_key.hex(),
        }

        if dry_run:
            logger.info(
                "MapUpload [DRY RUN] %s (%s) → would POST to %s\n  payload: %s",
                pubkey[:12],
                role_name,
                api_url,
                json.dumps(request_payload, separators=(",", ":")),
            )
            # Still update _seen so rate-limiting works during dry-run testing
            self._seen[pubkey] = advert_timestamp
            return

        if not self._client:
            return

        try:
            resp = await self._client.post(
                api_url,
                content=json.dumps(request_payload, separators=(",", ":")),
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            self._seen[pubkey] = advert_timestamp
            self._last_error = None
            logger.info(
                "MapUpload: uploaded %s (%s) → HTTP %d",
                pubkey[:12],
                role_name,
                resp.status_code,
            )
        except httpx.HTTPStatusError as exc:
            self._last_error = f"HTTP {exc.response.status_code}"
            logger.warning(
                "MapUpload: server returned %d for %s: %s",
                exc.response.status_code,
                pubkey[:12],
                exc.response.text[:200],
            )
        except httpx.RequestError as exc:
            self._last_error = str(exc)
            logger.warning("MapUpload: request error for %s: %s", pubkey[:12], exc)

    @property
    def status(self) -> str:
        if self._client is None:
            return "disconnected"
        if self._last_error:
            return "error"
        return "connected"


