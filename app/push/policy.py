"""Pure conversation-enablement policy for Web Push.

Mute is a separate manager-level circuit breaker and is not evaluated here.
The frontend Vague C hook must mirror these cases exactly.
"""

from collections.abc import Mapping

from app.repository.settings import PushDefaults


def conversation_is_enabled(
    *,
    state_key: str,
    message_type: str,
    defaults: PushDefaults,
    overrides: Mapping[str, bool],
    is_hashtag: bool = False,
    is_public: bool = False,
    contact_type: int | None = None,
) -> bool:
    """Return whether a conversation should receive a push for a message.

    Precedence: explicit override > PRIV (DM and rooms) via ``new_dm`` >
    Public or hashtag ON > private channel OFF.

    ``contact_type`` is unused for enablement (rooms are PRIV). Kept so
    callers can pass it without a second signature.
    """
    _ = contact_type
    if state_key in overrides:
        return bool(overrides[state_key])
    if message_type == "PRIV":
        return bool(defaults["new_dm"])
    return bool(is_public or is_hashtag)
