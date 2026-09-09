import logging

from fastapi import APIRouter

from app.models import (
    DirectoryCacheResetResponse,
    DirectoryMapNodesResponse,
    DirectoryNeighborsResponse,
    DirectoryNodeSearchResponse,
    DirectoryReachResponse,
    DirectoryResolveHopsRequest,
    DirectoryResolveHopsResponse,
)
from app.services.directory import (
    get_directory_node_neighbors,
    get_directory_node_reach,
    list_directory_map_nodes,
    reset_directory_cache,
    resolve_directory_hops,
    search_directory_nodes,
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


@router.get("/nodes/search", response_model=DirectoryNodeSearchResponse)
async def get_directory_node_search(q: str) -> DirectoryNodeSearchResponse:
    """Proxy CoreScope name/key search. Not for hop prefixes — use resolve-hops."""
    return await search_directory_nodes(q)


@router.get("/nodes/{pubkey}/reach", response_model=DirectoryReachResponse)
async def get_node_reach(pubkey: str) -> DirectoryReachResponse:
    """Proxy CoreScope 0-hop observers. HTTP 500 is a failure, not empty data."""
    return await get_directory_node_reach(pubkey)


@router.get("/nodes/{pubkey}/neighbors", response_model=DirectoryNeighborsResponse)
async def get_node_neighbors(pubkey: str) -> DirectoryNeighborsResponse:
    """Proxy CoreScope neighbor affinity for optional repeater-disk calibration."""
    return await get_directory_node_neighbors(pubkey)


@router.post("/cache/reset", response_model=DirectoryCacheResetResponse)
async def post_reset_directory_cache() -> DirectoryCacheResetResponse:
    """Wipe the directory hop cache only. RF contacts are untouched."""
    deleted = await reset_directory_cache()
    logger.info("Wiped directory hop cache (%d rows)", deleted)
    return DirectoryCacheResetResponse(deleted=deleted)
