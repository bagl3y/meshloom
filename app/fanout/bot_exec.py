"""
Bot execution module for automatic message responses.

This module provides functionality for executing user-defined Python code
in response to incoming messages. The user's code can process message data
and optionally return a response string or a list of strings.

SECURITY WARNING: This executes arbitrary Python code provided by the user.
It should only be enabled on trusted systems where the user understands
the security implications.
"""

import asyncio
import inspect
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Limit concurrent bot executions to prevent resource exhaustion
_bot_semaphore = asyncio.Semaphore(100)

# Dedicated thread pool for bot execution (separate from default executor)
_bot_executor = ThreadPoolExecutor(max_workers=100, thread_name_prefix="bot_")

# Timeout for bot code execution (seconds)
BOT_EXECUTION_TIMEOUT = 10

# Minimum spacing between bot message sends (seconds)
# This ensures repeaters have time to return to listening mode
BOT_MESSAGE_SPACING = 2.0

# Global state for rate limiting bot sends
_bot_send_lock = asyncio.Lock()
_last_bot_send_time: float = 0.0


def execute_bot_code(
    code: str,
    sender_name: str | None,
    sender_key: str | None,
    message_text: str,
    is_dm: bool,
    channel_key: str | None,
    channel_name: str | None,
    sender_timestamp: int | None,
    path: str | None,
    is_outgoing: bool = False,
) -> str | list[str] | None:
    """
    Execute user-provided bot code with message context.

    The code should define a function:
    `bot(sender_name, sender_key, message_text, is_dm, channel_key, channel_name, sender_timestamp, path, is_outgoing)`
    that returns either None (no response), a string (single response message),
    or a list of strings (multiple messages sent in order).

    Legacy bot functions with 8 parameters (without is_outgoing) are detected
    via inspect and called without the new parameter for backward compatibility.

    Args:
        code: Python code defining the bot function
        sender_name: Display name of the sender (may be None)
        sender_key: 64-char hex public key of sender for DMs, None for channel messages
        message_text: The message content
        is_dm: True for direct messages, False for channel messages
        channel_key: 32-char hex channel key for channel messages, None for DMs
        channel_name: Channel name (e.g. "#general" with hash), None for DMs
        sender_timestamp: Sender's timestamp from the message (may be None)
        path: Hex-encoded routing path (may be None)
        is_outgoing: True if this is our own outgoing message

    Returns:
        Response string, list of strings, or None.

    Note: This executes arbitrary code. Only use with trusted input.
    """
    if not code or not code.strip():
        return None

    # Build execution namespace with allowed imports
    namespace: dict[str, Any] = {
        "__builtins__": __builtins__,
    }

    try:
        # Execute the user's code to define the bot function
        exec(code, namespace)
    except Exception:
        logger.exception("Bot code compilation failed")
        return None

    # Check if bot function was defined
    if "bot" not in namespace or not callable(namespace["bot"]):
        logger.debug("Bot code does not define a callable 'bot' function")
        return None

    bot_func = namespace["bot"]

    # Detect whether the bot function accepts is_outgoing (new 9-param signature)
    # or uses the legacy 8-param signature, for backward compatibility.
    # Three cases: explicit is_outgoing param or 9+ params (positional),
    # **kwargs (pass as keyword), or legacy 8-param (omit).
    call_style = "legacy"  # "positional", "keyword", or "legacy"
    try:
        sig = inspect.signature(bot_func)
        params = sig.parameters
        non_variadic = [
            p
            for p in params.values()
            if p.kind not in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD)
        ]
        if "is_outgoing" in params or len(non_variadic) >= 9:
            call_style = "positional"
        elif any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values()):
            call_style = "keyword"
    except (ValueError, TypeError):
        pass

    try:
        # Call the bot function with appropriate signature
        if call_style == "positional":
            result = bot_func(
                sender_name,
                sender_key,
                message_text,
                is_dm,
                channel_key,
                channel_name,
                sender_timestamp,
                path,
                is_outgoing,
            )
        elif call_style == "keyword":
            result = bot_func(
                sender_name,
                sender_key,
                message_text,
                is_dm,
                channel_key,
                channel_name,
                sender_timestamp,
                path,
                is_outgoing=is_outgoing,
            )
        else:
            result = bot_func(
                sender_name,
                sender_key,
                message_text,
                is_dm,
                channel_key,
                channel_name,
                sender_timestamp,
                path,
            )

        # Validate result
        if result is None:
            return None
        if isinstance(result, str):
            return result if result.strip() else None
        if isinstance(result, list):
            # Filter to non-empty strings only
            valid_messages = [msg for msg in result if isinstance(msg, str) and msg.strip()]
            return valid_messages if valid_messages else None

        logger.debug("Bot function returned unsupported type: %s", type(result))
        return None

    except Exception:
        logger.exception("Bot function execution failed")
        return None


async def process_bot_response(
    response: str | list[str],
    is_dm: bool,
    sender_key: str,
    channel_key: str | None,
) -> None:
    """
    Send the bot's response message(s) using the existing message sending endpoints.

    For DMs, sends a direct message back to the sender.
    For channel messages, sends to the same channel.

    Bot messages are rate-limited to ensure at least BOT_MESSAGE_SPACING seconds
    between sends, giving repeaters time to return to listening mode.

    Args:
        response: The response text to send, or a list of messages to send in order
        is_dm: Whether the original message was a DM
        sender_key: Public key of the original sender (for DM replies)
        channel_key: Channel key for channel message replies
    """
    # Normalize to list for uniform processing
    messages = [response] if isinstance(response, str) else response

    for message_text in messages:
        await _send_single_bot_message(message_text, is_dm, sender_key, channel_key)


async def _send_single_bot_message(
    message_text: str,
    is_dm: bool,
    sender_key: str,
    channel_key: str | None,
) -> None:
    """
    Send a single bot message with rate limiting.

    Args:
        message_text: The message text to send
        is_dm: Whether the original message was a DM
        sender_key: Public key of the original sender (for DM replies)
        channel_key: Channel key for channel message replies
    """
    global _last_bot_send_time

    from app.models import SendChannelMessageRequest, SendDirectMessageRequest
    from app.routers.messages import send_channel_message, send_direct_message

    # Serialize bot sends and enforce minimum spacing
    async with _bot_send_lock:
        # Calculate how long since last bot send
        now = time.monotonic()
        time_since_last = now - _last_bot_send_time

        if _last_bot_send_time > 0 and time_since_last < BOT_MESSAGE_SPACING:
            wait_time = BOT_MESSAGE_SPACING - time_since_last
            logger.debug("Rate limiting bot send, waiting %.2fs", wait_time)
            await asyncio.sleep(wait_time)

        try:
            if is_dm:
                logger.info("Bot sending DM reply to %s", sender_key[:12])
                request = SendDirectMessageRequest(destination=sender_key, text=message_text)
                await send_direct_message(request)
            elif channel_key:
                logger.info("Bot sending channel reply to %s", channel_key[:8])
                request = SendChannelMessageRequest(channel_key=channel_key, text=message_text)
                await send_channel_message(request)
            else:
                logger.warning("Cannot send bot response: no destination")
                return  # Don't update timestamp if we didn't send
        except HTTPException as e:
            logger.error("Bot failed to send response: %s", e.detail, exc_info=True)
            return  # Don't update timestamp on failure
        except Exception:
            logger.exception("Bot failed to send response")
            return  # Don't update timestamp on failure

        # Update last send time after successful send
        _last_bot_send_time = time.monotonic()
