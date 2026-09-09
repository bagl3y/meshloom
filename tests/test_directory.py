"""CoreScope directory hop resolver: 1-byte reject, opt-in no-op, cache, SSRF."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi import HTTPException

from app.models import DirectoryResolveHopsRequest
from app.repository import AppSettingsRepository
from app.repository.directory import DirectoryHopCacheRepository
from app.routers.directory import post_reset_directory_cache, post_resolve_hops
from app.routers.settings import AppSettingsUpdate, update_settings
from app.services.directory import (
    list_directory_map_nodes,
    normalize_directory_origin,
    parse_corescope_map_nodes,
    parse_corescope_resolved,
    reset_directory_nodes_cache,
    resolve_directory_hops,
    validate_hop_prefixes,
)


class TestNormalizeDirectoryOrigin:
    def test_empty_stays_empty(self):
        assert normalize_directory_origin("  ") == ""

    def test_strips_path_to_origin(self):
        assert normalize_directory_origin("https://analyzer.example/api/docs") == (
            "https://analyzer.example"
        )

    def test_rejects_file_scheme(self):
        with pytest.raises(ValueError, match="http or https"):
            normalize_directory_origin("file:///etc/passwd")

    def test_rejects_credentials(self):
        with pytest.raises(ValueError, match="credentials"):
            normalize_directory_origin("https://user:pass@evil.example")

    def test_rejects_whitespace(self):
        with pytest.raises(ValueError, match="whitespace"):
            normalize_directory_origin("https://evil.example /path")


class TestValidateHopPrefixes:
    def test_accepts_2_and_3_byte(self):
        assert validate_hop_prefixes(["a1b2", "C3D4E5"]) == ["A1B2", "C3D4E5"]

    def test_rejects_1_byte(self):
        with pytest.raises(HTTPException) as exc:
            validate_hop_prefixes(["1A"])
        assert exc.value.status_code == 400
        assert "1-byte" in str(exc.value.detail)

    def test_rejects_mixed_1_byte_without_forwarding(self):
        with pytest.raises(HTTPException) as exc:
            validate_hop_prefixes(["A1B2", "1A"])
        assert exc.value.status_code == 400

    def test_rejects_odd_length(self):
        with pytest.raises(HTTPException) as exc:
            validate_hop_prefixes(["ABC"])
        assert exc.value.status_code == 400


class TestParseCorescopeResolved:
    def test_unique_name(self):
        parsed = parse_corescope_resolved(
            {
                "resolved": {
                    "A1B2": {
                        "name": "HillTop",
                        "candidates": [],
                        "conflicts": [],
                        "confidence": "unique",
                    }
                }
            }
        )
        assert parsed == {"A1B2": "HillTop"}

    def test_keeps_candidate_gps(self):
        from app.services.directory import parse_corescope_resolved_hits

        parsed = parse_corescope_resolved_hits(
            {
                "resolved": {
                    "A1B2": {
                        "name": "HillTop",
                        "pubkey": "ab" * 32,
                        "candidates": [{"name": "HillTop", "pubkey": "ab" * 32, "lat": 48.1, "lon": 2.2}],
                        "conflicts": [],
                        "confidence": "unique",
                    }
                }
            }
        )
        hit = parsed["A1B2"]
        assert hit is not None
        assert hit.name == "HillTop"
        assert hit.public_key == "ab" * 32
        assert hit.lat == 48.1
        assert hit.lon == 2.2

    def test_no_match_and_1_byte_ignored(self):
        parsed = parse_corescope_resolved(
            {
                "resolved": {
                    "A1": {
                        "name": "Nope",
                        "candidates": [],
                        "conflicts": [],
                        "confidence": "unique",
                    },
                    "FFFF": {
                        "name": None,
                        "candidates": [],
                        "conflicts": [],
                        "confidence": "no_match",
                    },
                }
            }
        )
        assert "A1" not in parsed
        assert parsed["FFFF"] is None


class TestResolveDirectoryHops:
    @pytest.mark.asyncio
    async def test_disabled_is_noop(self, test_db):
        result = await resolve_directory_hops(["A1B2"])
        assert result.resolved == {}

    @pytest.mark.asyncio
    async def test_enabled_without_url_is_noop(self, test_db):
        await AppSettingsRepository.update(directory_enabled=True, directory_url="")
        result = await resolve_directory_hops(["A1B2"])
        assert result.resolved == {}

    @pytest.mark.asyncio
    async def test_rejects_1_byte_even_when_enabled(self, test_db):
        await AppSettingsRepository.update(
            directory_enabled=True, directory_url="https://corescope.test"
        )
        with pytest.raises(HTTPException) as exc:
            await resolve_directory_hops(["1A"])
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_proxies_only_saved_origin_and_caches(self, test_db):
        await AppSettingsRepository.update(
            directory_enabled=True, directory_url="https://corescope.test"
        )
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "resolved": {
                "A1B2": {
                    "name": "HillTop",
                    "candidates": [],
                    "conflicts": [],
                    "confidence": "unique",
                }
            }
        }
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.directory.httpx.AsyncClient", return_value=mock_client):
            first = await resolve_directory_hops(["A1B2"])
            second = await resolve_directory_hops(["A1B2"])

        assert first.resolved["A1B2"].name == "HillTop"
        assert first.resolved["A1B2"].source == "corescope"
        assert first.resolved["A1B2"].hash_width == 2
        assert second.resolved["A1B2"].name == "HillTop"
        assert mock_client.get.call_count == 1
        called_url = mock_client.get.call_args.args[0]
        assert called_url == "https://corescope.test/api/resolve-hops"
        assert mock_client.get.call_args.kwargs["params"]["hops"] == "A1B2"

    @pytest.mark.asyncio
    async def test_reset_wipes_directory_cache_only(self, test_db):
        await DirectoryHopCacheRepository.upsert("A1B2", 2, "HillTop", "corescope", 9_999_999_999)
        result = await post_reset_directory_cache()
        assert result.deleted == 1
        cached = await DirectoryHopCacheRepository.get_many([("A1B2", 2)])
        assert cached == {}


class TestDirectorySettingsValidation:
    @pytest.mark.asyncio
    async def test_empty_url_persists_without_spec_check(self, test_db):
        result = await update_settings(AppSettingsUpdate(directory_url=""))
        assert result.directory_url == ""
        assert result.directory_enabled is False

    @pytest.mark.asyncio
    async def test_url_requires_successful_spec(self, test_db):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"openapi": "3.0.3", "info": {"title": "CoreScope API"}}
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.directory.httpx.AsyncClient", return_value=mock_client):
            result = await update_settings(
                AppSettingsUpdate(directory_url="https://analyzer.example/extra")
            )

        assert result.directory_url == "https://analyzer.example"
        assert mock_client.get.call_args.args[0] == "https://analyzer.example/api/spec"

    @pytest.mark.asyncio
    async def test_file_url_rejected(self, test_db):
        with pytest.raises(HTTPException) as exc:
            await update_settings(AppSettingsUpdate(directory_url="file:///tmp/x"))
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_spec_failure_does_not_persist(self, test_db):
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.ConnectError("refused"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.directory.httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(HTTPException) as exc:
                await update_settings(AppSettingsUpdate(directory_url="https://nope.example"))
        assert exc.value.status_code == 400
        fresh = await AppSettingsRepository.get()
        assert fresh.directory_url == ""


class TestDirectoryRouter:
    @pytest.mark.asyncio
    async def test_post_resolve_rejects_1_byte(self, test_db):
        with pytest.raises(HTTPException) as exc:
            await post_resolve_hops(DirectoryResolveHopsRequest(hops=["AB"]))
        assert exc.value.status_code == 400


class TestParseCorescopeMapNodes:
    def test_keeps_repeater_gps_and_drops_sentinel(self):
        nodes, total = parse_corescope_map_nodes(
            {
                "total": 3,
                "nodes": [
                    {
                        "public_key": "ab" * 32,
                        "name": "HillTop",
                        "role": "repeater",
                        "lat": 48.1,
                        "lon": 2.2,
                    },
                    {
                        "public_key": "cd" * 32,
                        "name": "ZeroIsland",
                        "role": "repeater",
                        "lat": 0,
                        "lon": 0,
                    },
                    {
                        "public_key": "ef" * 32,
                        "name": "Companion",
                        "role": "companion",
                        "lat": 48.2,
                        "lon": 2.3,
                    },
                ],
            }
        )
        assert total == 3
        assert [(n.public_key, n.name, n.source) for n in nodes] == [
            ("ab" * 32, "HillTop", "corescope")
        ]

    def test_rejects_non_object_payload(self):
        assert parse_corescope_map_nodes(["nope"]) == ([], None)


class TestListDirectoryMapNodes:
    @pytest.mark.asyncio
    async def test_disabled_is_noop(self, test_db):
        reset_directory_nodes_cache()
        result = await list_directory_map_nodes()
        assert result.nodes == []

    @pytest.mark.asyncio
    async def test_proxies_repeaters_and_caches(self, test_db):
        reset_directory_nodes_cache()
        await AppSettingsRepository.update(
            directory_enabled=True, directory_url="https://corescope.test"
        )
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "total": 1,
            "nodes": [
                {
                    "public_key": "11" * 32,
                    "name": "NetRelay",
                    "role": "repeater",
                    "lat": 45.0,
                    "lon": 5.0,
                }
            ],
        }
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.directory.httpx.AsyncClient", return_value=mock_client):
            first = await list_directory_map_nodes()
            second = await list_directory_map_nodes()

        assert first.nodes[0].name == "NetRelay"
        assert first.nodes[0].lat == 45.0
        assert first.nodes[0].source == "corescope"
        assert second.nodes[0].name == "NetRelay"
        assert mock_client.get.call_count == 1
        assert mock_client.get.call_args.args[0] == "https://corescope.test/api/nodes"
        assert mock_client.get.call_args.kwargs["params"]["role"] == "repeater"
