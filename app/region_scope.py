"""Helpers for normalizing MeshCore flood-scope / region names."""

_UNSCOPED_SENTINELS = {"", "0", "*"}


def normalize_region_scope(scope: str | None) -> str:
    """Normalize a user-facing region scope into MeshCore's internal form.

    Region names are user-facing plain strings like ``Esperance``. Internally,
    MeshCore still expects hashtag-style names like ``#Esperance``.

    Backward compatibility / firmware parity:
    - blank/None stays unscoped (``""``)
    - ``"0"`` and ``"*"`` also mean explicit unscoped/plain flood
    - existing leading ``#`` is preserved
    """

    stripped = (scope or "").strip()
    if stripped in _UNSCOPED_SENTINELS:
        return ""
    if stripped.startswith("#"):
        return stripped
    return f"#{stripped}"
