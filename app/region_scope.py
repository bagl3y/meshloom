"""Helpers for normalizing MeshCore flood-scope / region names."""


def normalize_region_scope(scope: str | None) -> str:
    """Normalize a user-facing region scope into MeshCore's internal form.

    Region names are now user-facing plain strings like ``Esperance``.
    Internally, MeshCore still expects hashtag-style names like ``#Esperance``.

    Backward compatibility:
    - blank/None stays disabled (`""`)
    - existing leading ``#`` is preserved
    """

    stripped = (scope or "").strip()
    if not stripped:
        return ""
    if stripped.startswith("#"):
        return stripped
    return f"#{stripped}"
