import logging

from fastapi import APIRouter

from app.models import (
    DirectoryCacheResetResponse,
    DirectoryMapNodesResponse,
    DirectoryResolveHopsRequest,
    DirectoryResolveHopsResponse,
)
from app.services.directory import (
    list_directory_map_nodes,
    reset_directory_cache,
    resolve_directory_hops,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/directory", tags=["directory"])


@router.post("/resolve-hops", response_model=DirectoryResolveHopsResponse)
async def post_resolve_hops(request: DirectoryResolveHopsRequest) -> DirectoryResolveHopsResponse:
    """Proxy CoreScope hop resolution. Rejects 1-byte prefixes. No-op when disabled."""
    return await resolve_directory_hops(request.hops)


@router.get("/nodes", response_model=DirectoryMapNodesResponse)
async def get_directory_map_nodes() -> DirectoryMapNodesResponse:
    """Proxy CoreScope repeater GPS for the #map overlay. No-op when disabled."""
    return await list_directory_map_nodes()


@router.post("/cache/reset", response_model=DirectoryCacheResetResponse)
async def post_reset_directory_cache() -> DirectoryCacheResetResponse:
    """Wipe the directory hop cache only. RF contacts are untouched."""
    deleted = await reset_directory_cache()
    logger.info("Wiped directory hop cache (%d rows)", deleted)
    return DirectoryCacheResetResponse(deleted=deleted)
