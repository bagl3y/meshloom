"""Shared dependencies for FastAPI routers."""

from fastapi import HTTPException

from app.services.radio_runtime import RadioRuntime
from app.services.radio_runtime import radio_runtime as radio_manager


def require_connected():
    """Dependency that ensures radio is connected and returns meshcore instance.

    Raises HTTPException 503 if radio is not connected.
    """
    if isinstance(radio_manager, RadioRuntime):
        return radio_manager.require_connected()
    if getattr(radio_manager, "is_setup_in_progress", False) is True:
        raise HTTPException(status_code=503, detail="Radio is initializing")
    mc = getattr(radio_manager, "meshcore", None)
    if not getattr(radio_manager, "is_connected", False) or mc is None:
        raise HTTPException(status_code=503, detail="Radio not connected")
    return mc
