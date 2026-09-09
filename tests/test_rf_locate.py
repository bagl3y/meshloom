"""RF locate: 0-hop local extraction, identity rules, CoreScope reach merge."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi import HTTPException

from app.models import ContactUpsert
from app.repository import (
    AppSettingsRepository,
    ContactAdvertPathRepository,
    ContactRepository,
    MessageRepository,
)
from app.services.directory import reset_directory_nodes_cache
from app.services.rf_locate import locate_query


def _radio_info(lat: float = 48.85, lon: float = 2.35, name: str = "Home") -> MagicMock:
    runtime = MagicMock()
    runtime.meshcore = MagicMock(
        self_info={
            "adv_lat": lat,
            "adv_lon": lon,
            "name": name,
            "public_key": "ff" * 32,
        }
    )
    return runtime


async def _insert_contact(
    key: str,
    name: str,
    *,
    contact_type: int = 1,
    lat: float | None = None,
    lon: float | None = None,
) -> None:
    await ContactRepository.upsert(
        ContactUpsert(public_key=key, name=name, type=contact_type, lat=lat, lon=lon)
    )


class TestLocateIdentity:
    @pytest.mark.asyncio
    async def test_refuses_1_byte_hop(self, test_db):
        with pytest.raises(HTTPException) as exc:
            await locate_query("1a")
        assert exc.value.status_code == 400
        assert "1-byte" in str(exc.value.detail)

    @pytest.mark.asyncio
    async def test_ambiguous_prefix_is_409(self, test_db):
        await _insert_contact("abc123" + "11" * 29, "One")
        await _insert_contact("abc123" + "22" * 29, "Two")
        with pytest.raises(HTTPException) as exc:
            await locate_query("abc123")
        assert exc.value.status_code == 409
        assert exc.value.detail["reason"] == "ambiguous"
        assert len(exc.value.detail["candidates"]) == 2

    @pytest.mark.asyncio
    async def test_unique_prefix_promotes_to_pubkey(self, test_db):
        key = "abc123" + "33" * 29
        await _insert_contact(key, "Solo")
        result = await locate_query("abc123")
        assert result.identity is not None
        assert result.identity.public_key == key
        assert result.identity.inferred is False

    @pytest.mark.asyncio
    async def test_unknown_name_is_insufficient_identity(self, test_db):
        result = await locate_query("Nobody")
        assert result.identity is None
        assert result.empty_reason == "insufficient_identity"
        assert result.directory_enabled is False


class TestLocateLocalZeroHop:
    @pytest.mark.asyncio
    async def test_path_len_zero_advert_plus_radio_gps(self, test_db):
        key = "aa" * 32
        await _insert_contact(key, "Ghost")
        await ContactAdvertPathRepository.record_observation(key, "", 1_700_000_000, hop_count=0)
        with patch("app.services.rf_locate.radio_runtime", _radio_info()):
            result = await locate_query(key)
        assert result.heard_locally_0hop is True
        assert result.radio_has_gps is True
        assert result.source == "local"
        assert len(result.anchors) == 1
        assert result.anchors[0].kind == "local_0hop"
        assert result.anchors[0].lat == pytest.approx(48.85)
        assert result.anchors[0].radius_km == 20.0
        assert result.empty_reason is None

    @pytest.mark.asyncio
    async def test_zero_hop_message_path_counts(self, test_db):
        key = "bb" * 32
        await _insert_contact(key, "Talker")
        await MessageRepository.create(
            "PRIV",
            "hello",
            1_700_000_100,
            key,
            sender_timestamp=1_700_000_100,
            path="",
            path_len=0,
            snr=7.5,
        )
        with patch("app.services.rf_locate.radio_runtime", _radio_info()):
            result = await locate_query(key)
        assert result.heard_locally_0hop is True
        assert result.anchors[0].kind == "local_0hop"
        assert result.anchors[0].snr == pytest.approx(7.5)

    @pytest.mark.asyncio
    async def test_nearest_repeaters_first_hop_is_not_zero_hop(self, test_db):
        target = "cc" * 32
        repeater = "dd" * 32
        await _insert_contact(target, "Far")
        await _insert_contact(repeater, "Hill", contact_type=2, lat=45.0, lon=5.0)
        await ContactAdvertPathRepository.record_observation(
            target, repeater[:8], 1_700_000_000, hop_count=2
        )
        with patch("app.services.rf_locate.radio_runtime", _radio_info()):
            result = await locate_query(target)
        assert result.heard_locally_0hop is False
        kinds = {anchor.kind for anchor in result.anchors}
        assert "local_0hop" not in kinds
        assert "first_hop" in kinds
        assert result.anchors[0].calibratable is True

    @pytest.mark.asyncio
    async def test_ambiguous_first_hop_is_unresolved_not_silent(self, test_db):
        target = "ee" * 32
        await _insert_contact(target, "Target")
        await _insert_contact("abcd" + "11" * 30, "R1", contact_type=2, lat=1.0, lon=2.0)
        await _insert_contact("abcd" + "22" * 30, "R2", contact_type=2, lat=3.0, lon=4.0)
        await ContactAdvertPathRepository.record_observation(
            target, "abcd0000", 1_700_000_000, hop_count=2
        )
        result = await locate_query(target)
        assert result.anchors == []
        assert result.unresolved_hops[0].reason == "ambiguous"
        assert len(result.unresolved_hops[0].candidates) == 2

    @pytest.mark.asyncio
    async def test_never_heard_and_directory_off_is_cta(self, test_db):
        key = "11" * 32
        result = await locate_query(key)
        assert result.identity is not None
        assert result.identity.public_key == key
        assert result.anchors == []
        assert result.directory_enabled is False
        assert result.empty_reason == "directory_off"


class TestLocateDirectoryReach:
    @pytest.mark.asyncio
    async def test_corescope_observers_become_disks(self, test_db):
        reset_directory_nodes_cache()
        key = "22" * 32
        await AppSettingsRepository.update(
            directory_enabled=True, directory_url="https://corescope.test"
        )
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "node": {"pubkey": key, "name": "Ghost", "lat": None, "lon": None},
            "direct_observers": [
                {
                    "pubkey": "33" * 32,
                    "name": "ObsA",
                    "count": 4,
                    "avg_snr": 8.1,
                    "lat": 48.0,
                    "lon": 2.0,
                }
            ],
        }
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        with patch("app.services.directory.httpx.AsyncClient", return_value=mock_client):
            result = await locate_query(key)
        assert result.directory_enabled is True
        assert result.source == "corescope"
        assert result.anchors[0].kind == "corescope_0hop"
        assert result.anchors[0].snr == pytest.approx(8.1)
        assert result.empty_reason is None

    @pytest.mark.asyncio
    async def test_corescope_500_is_not_empty(self, test_db):
        reset_directory_nodes_cache()
        key = "44" * 32
        await AppSettingsRepository.update(
            directory_enabled=True, directory_url="https://corescope.test"
        )
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        with patch("app.services.directory.httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(HTTPException) as exc:
                await locate_query(key)
        assert exc.value.status_code == 500

    @pytest.mark.asyncio
    async def test_corescope_network_error_is_500(self, test_db):
        reset_directory_nodes_cache()
        key = "55" * 32
        await AppSettingsRepository.update(
            directory_enabled=True, directory_url="https://corescope.test"
        )
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.ConnectError("refused"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        with patch("app.services.directory.httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(HTTPException) as exc:
                await locate_query(key)
        assert exc.value.status_code == 500
        assert "empty" not in str(exc.value.detail).lower()

    @pytest.mark.asyncio
    async def test_mixte_source_when_local_and_corescope(self, test_db):
        reset_directory_nodes_cache()
        key = "66" * 32
        await _insert_contact(key, "Both")
        await ContactAdvertPathRepository.record_observation(key, "", 1_700_000_000, hop_count=0)
        await AppSettingsRepository.update(
            directory_enabled=True, directory_url="https://corescope.test"
        )
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "node": {"pubkey": key, "name": "Both"},
            "direct_observers": [
                {
                    "pubkey": "77" * 32,
                    "name": "ObsB",
                    "count": 1,
                    "avg_snr": -2.0,
                    "lat": 49.0,
                    "lon": 3.0,
                }
            ],
        }
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        with (
            patch("app.services.rf_locate.radio_runtime", _radio_info()),
            patch("app.services.directory.httpx.AsyncClient", return_value=mock_client),
        ):
            result = await locate_query(key)
        assert result.source == "mixte"
        assert {anchor.kind for anchor in result.anchors} == {"local_0hop", "corescope_0hop"}
