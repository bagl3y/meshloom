"""VAPID key management for Web Push.

Generates a P-256 key pair on first use and caches it in app_settings.
The public key is served to browsers for PushManager.subscribe().
"""

import base64
import logging

from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from py_vapid import Vapid

from app.database import db

logger = logging.getLogger(__name__)

_cached_private_key: str = ""
_cached_public_key: str = ""


async def ensure_vapid_keys() -> tuple[str, str]:
    """Read or generate VAPID keys. Call once at startup after DB connect."""
    global _cached_private_key, _cached_public_key

    cursor = await db.conn.execute(
        "SELECT vapid_private_key, vapid_public_key FROM app_settings WHERE id = 1"
    )
    row = await cursor.fetchone()

    if row and row["vapid_private_key"] and row["vapid_public_key"]:
        _cached_private_key = row["vapid_private_key"]
        _cached_public_key = row["vapid_public_key"]
        logger.info("VAPID keys loaded from database")
        return _cached_private_key, _cached_public_key

    # Generate new key pair
    vapid = Vapid()
    vapid.generate_keys()

    # Private key as PEM for pywebpush
    _cached_private_key = vapid.private_pem().decode("utf-8")

    # Public key as uncompressed P-256 point, base64url-encoded (no padding)
    # for the browser Push API's applicationServerKey
    raw_pub = vapid.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)  # type: ignore[union-attr]
    _cached_public_key = base64.urlsafe_b64encode(raw_pub).rstrip(b"=").decode("ascii")

    await db.conn.execute(
        "UPDATE app_settings SET vapid_private_key = ?, vapid_public_key = ? WHERE id = 1",
        (_cached_private_key, _cached_public_key),
    )
    await db.conn.commit()
    logger.info("Generated and stored new VAPID key pair")

    return _cached_private_key, _cached_public_key


def get_vapid_public_key() -> str:
    """Return the cached VAPID public key (base64url). Must call ensure_vapid_keys() first."""
    return _cached_public_key


def get_vapid_private_key() -> str:
    """Return the cached VAPID private key (PEM). Must call ensure_vapid_keys() first."""
    return _cached_private_key
