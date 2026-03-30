"""Fanout module for Apprise push notifications."""

from __future__ import annotations

import asyncio
import logging
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from app.fanout.base import FanoutModule, get_fanout_message_text
from app.path_utils import split_path_hex

logger = logging.getLogger(__name__)


def _parse_urls(raw: str) -> list[str]:
    """Split multi-line URL string into individual URLs."""
    return [line.strip() for line in raw.splitlines() if line.strip()]


def _normalize_discord_url(url: str) -> str:
    """Add avatar=no to Discord URLs to suppress identity override."""
    parts = urlsplit(url)
    scheme = parts.scheme.lower()
    host = parts.netloc.lower()

    is_discord = scheme in ("discord", "discords") or (
        scheme in ("http", "https")
        and host in ("discord.com", "discordapp.com")
        and parts.path.lower().startswith("/api/webhooks/")
    )
    if not is_discord:
        return url

    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["avatar"] = "no"
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def _format_body(data: dict, *, include_path: bool) -> str:
    """Build a human-readable notification body from message data."""
    msg_type = data.get("type", "")
    text = get_fanout_message_text(data)
    sender_name = data.get("sender_name") or "Unknown"

    via = ""
    if include_path:
        paths = data.get("paths")
        if paths and isinstance(paths, list) and len(paths) > 0:
            first_path = paths[0] if isinstance(paths[0], dict) else {}
            path_str = first_path.get("path", "")
            path_len = first_path.get("path_len")
        else:
            path_str = None
            path_len = None

        if msg_type == "PRIV" and path_str is None:
            via = " **via:** [`direct`]"
        elif path_str is not None:
            path_str = path_str.strip().lower()
            if path_str == "":
                via = " **via:** [`direct`]"
            else:
                hop_count = path_len if isinstance(path_len, int) else len(path_str) // 2
                hops = split_path_hex(path_str, hop_count)
                if hops:
                    hop_list = ", ".join(f"`{h}`" for h in hops)
                    via = f" **via:** [{hop_list}]"

    if msg_type == "PRIV":
        return f"**DM:** {sender_name}: {text}{via}"

    channel_name = data.get("channel_name") or data.get("conversation_key", "channel")
    return f"**{channel_name}:** {sender_name}: {text}{via}"


def _send_sync(urls_raw: str, body: str, *, preserve_identity: bool) -> bool:
    """Send notification synchronously via Apprise. Returns True on success."""
    import apprise as apprise_lib

    urls = _parse_urls(urls_raw)
    if not urls:
        return False

    notifier = apprise_lib.Apprise()
    for url in urls:
        if preserve_identity:
            url = _normalize_discord_url(url)
        notifier.add(url)

    return bool(notifier.notify(title="", body=body))


class AppriseModule(FanoutModule):
    """Sends push notifications via Apprise for incoming messages."""

    def __init__(self, config_id: str, config: dict, *, name: str = "") -> None:
        super().__init__(config_id, config, name=name)

    async def on_message(self, data: dict) -> None:
        # Skip outgoing messages — only notify on incoming
        if data.get("outgoing"):
            return

        urls = self.config.get("urls", "")
        if not urls or not urls.strip():
            return

        preserve_identity = self.config.get("preserve_identity", True)
        include_path = self.config.get("include_path", True)
        body = _format_body(data, include_path=include_path)

        try:
            success = await asyncio.to_thread(
                _send_sync, urls, body, preserve_identity=preserve_identity
            )
            self._set_last_error(None if success else "Apprise notify returned failure")
            if not success:
                logger.warning("Apprise notification failed for module %s", self.config_id)
        except Exception as exc:
            self._set_last_error(str(exc))
            logger.exception("Apprise send error for module %s", self.config_id)

    @property
    def status(self) -> str:
        if not self.config.get("urls", "").strip():
            return "disconnected"
        if self.last_error:
            return "error"
        return "connected"
