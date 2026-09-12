"""REST for Meshloom Stats community join + thin Stats HTTP proxies."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from app.models import (
    CommunityIataBindRequest,
    CommunityIataBindResult,
    CommunityMeStats,
    CommunityPublicStats,
    CommunityStatus,
    CommunityUpdate,
)
from app.services.meshloom_community import (
    community_status,
    radio_gps_or_none,
    stats_json,
    update_community,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/community", tags=["community"])


@router.get("", response_model=CommunityStatus)
async def get_community() -> CommunityStatus:
    return await community_status()


@router.patch("", response_model=CommunityStatus)
async def patch_community(body: CommunityUpdate) -> CommunityStatus:
    await update_community(
        enabled=body.enabled,
        iata=body.iata,
        broker_host=body.broker_host,
        api_base=body.api_base,
    )
    return await community_status()


@router.get("/me/stats", response_model=CommunityMeStats)
async def get_me_stats() -> CommunityMeStats:
    payload = await stats_json("GET", "/v1/me/stats", auth=True)
    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail="Stats returned an unexpected body")
    return CommunityMeStats.model_validate(payload)


@router.put("/me/iata", response_model=CommunityIataBindResult)
async def put_me_iata(body: CommunityIataBindRequest) -> CommunityIataBindResult:
    lat = body.lat
    lon = body.lon
    if lat is None and lon is None:
        lat, lon = radio_gps_or_none()
    json_body: dict[str, Any] = {"iata": body.iata.upper()}
    if lat is not None and lon is not None:
        json_body["lat"] = lat
        json_body["lon"] = lon
    payload = await stats_json("PUT", "/v1/me/iata", auth=True, json_body=json_body)
    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail="Stats returned an unexpected body")
    result = CommunityIataBindResult.model_validate(payload)
    await update_community(iata=result.iata)
    return result


@router.post("/me/iata/override", response_model=CommunityIataBindResult)
async def post_me_iata_override() -> CommunityIataBindResult:
    payload = await stats_json("POST", "/v1/me/iata/override", auth=True)
    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail="Stats returned an unexpected body")
    return CommunityIataBindResult.model_validate(payload)


@router.get("/stats", response_model=CommunityPublicStats)
async def get_community_stats() -> CommunityPublicStats:
    payload = await stats_json("GET", "/v1/community/stats", auth=False)
    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail="Stats returned an unexpected body")
    return CommunityPublicStats.model_validate(payload)
