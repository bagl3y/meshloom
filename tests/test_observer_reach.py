import hashlib
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.decoder import outgoing_group_text_packet_hash
from app.path_utils import calculate_packet_hash, canonical_packet_hash
from app.repository import AppSettingsRepository, MessageRepository, RawPacketRepository
from app.services.observer_reach import (
    get_packet_observer_reach,
    get_packet_observer_reach_counts,
    hops_from_path_json,
    parse_batch_observations,
    parse_corescope_observers,
    parse_packet_observations,
    reset_observer_reach_cache,
)


def _group_text_packet(channel_key: bytes, timestamp: int, text: str) -> bytes:
    from app.decoder import encrypt_group_text

    payload = encrypt_group_text(channel_key, timestamp, text, 0)
    return bytes([0x15, 0x00]) + payload


class TestOutgoingGroupTextHash:
    def test_matches_incoming_flood_packet(self):
        channel_key = hashlib.sha256(b"#testchannel").digest()[:16]
        timestamp = 1_700_000_000
        text = "Alice: Hello world"
        raw = _group_text_packet(channel_key, timestamp, text)
        incoming = calculate_packet_hash(raw)
        outgoing = outgoing_group_text_packet_hash(channel_key.hex(), timestamp, text)
        assert outgoing == incoming
        assert canonical_packet_hash(outgoing) == incoming

    def test_utf8_over_max_waits_for_echo(self):
        channel_key = hashlib.sha256(b"#testchannel").digest()[:16]
        text = "A" * 200
        assert outgoing_group_text_packet_hash(channel_key.hex(), 1_700_000_000, text) is None


class TestPathJsonHops:
    def test_list_and_json_string(self):
        assert hops_from_path_json(["aa", "bb", "cc"]) == 3
        assert hops_from_path_json('["aa","bb"]') == 2
        assert hops_from_path_json("[]") == 0
        assert hops_from_path_json("{") is None


class TestObservationParsers:
    def test_packet_detail_observations(self):
        parsed = parse_packet_observations(
            {
                "observations": [
                    {
                        "observer_id": "obs-1",
                        "observer_name": "Lyon",
                        "snr": -4.5,
                        "path_json": ["ab", "cd"],
                    }
                ]
            }
        )
        assert len(parsed) == 1
        assert parsed[0].observer_id == "obs-1"
        assert parsed[0].hops == 2
        assert parsed[0].snr == -4.5

    def test_batch_results(self):
        parsed = parse_batch_observations(
            {
                "results": {
                    "aabbccddeeff0011": [
                        {"observer_id": "a", "path_json": []},
                        {"observer_id": "b", "path_json": ["11"]},
                    ]
                }
            }
        )
        assert parsed is not None
        assert len(parsed["AABBCCDDEEFF0011"]) == 2

    def test_batch_rejects_ingest_shaped_body(self):
        assert parse_batch_observations({"accepted": 2}) is None

    def test_batch_count_only_payload(self):
        parsed = parse_batch_observations(
            {"results": {"aabbccddeeff0011": {"observation_count": 4}}}
        )
        assert parsed is not None
        assert len(parsed["AABBCCDDEEFF0011"]) == 4

    def test_observers_join(self):
        geos = parse_corescope_observers(
            {
                "observers": [
                    {
                        "id": "obs-1",
                        "name": "Lyon",
                        "lat": 45.75,
                        "lon": 4.85,
                        "public_key": "a" * 64,
                    },
                    {"id": "obs-2", "name": "Null Island", "lat": 0.0, "lon": 0.0},
                ]
            }
        )
        assert geos["obs-1"].lat == 45.75
        assert geos["obs-2"].lat is None


class TestObserverReachPersistence:
    @pytest.mark.asyncio
    async def test_channel_echo_writes_hash_on_outgoing_row(self, test_db):
        from app.services.messages import create_outgoing_channel_message, handle_duplicate_message

        channel_key = hashlib.sha256(b"#echo").digest()[:16].hex().upper()
        timestamp = 1_700_000_111
        text = "Bob: ping"

        broadcasts: list[object] = []
        message = await create_outgoing_channel_message(
            conversation_key=channel_key,
            text=text,
            sender_timestamp=timestamp,
            received_at=timestamp,
            sender_name="Bob",
            sender_key=None,
            channel_name="#echo",
            broadcast_fn=lambda *args, **kwargs: broadcasts.append((args, kwargs)),
        )
        assert message is not None
        assert message.packet_hash
        assert message.observer_reach_eligible is True

        await handle_duplicate_message(
            packet_id=None,
            msg_type="CHAN",
            conversation_key=channel_key,
            text=text,
            sender_timestamp=timestamp,
            outgoing=True,
            path="aa",
            received_at=timestamp + 1,
            path_len=1,
            broadcast_fn=lambda *args, **kwargs: None,
            packet_hash="AABBCCDDEEFF0011",
            observer_reach_eligible=True,
        )
        stored = await MessageRepository.get_by_id(message.id)
        assert stored is not None
        assert stored.packet_hash == "AABBCCDDEEFF0011"

    @pytest.mark.asyncio
    async def test_priv_flood_stays_eligible_after_raw_purge(self, test_db):
        msg_id = await MessageRepository.create(
            msg_type="PRIV",
            text="hello",
            conversation_key="ab" * 32,
            sender_timestamp=1_700_000_000,
            received_at=1_700_000_000,
            outgoing=False,
            packet_hash="AABBCCDDEEFF0011",
            observer_reach_eligible=True,
        )
        assert msg_id is not None
        packet_id, _is_new = await RawPacketRepository.create(
            b"\x15\x00payload", timestamp=1_700_000_000
        )
        await RawPacketRepository.mark_decrypted(packet_id, msg_id)
        await RawPacketRepository.purge_linked_to_messages()
        stored = await MessageRepository.get_by_id(msg_id)
        assert stored is not None
        assert stored.observer_reach_eligible is True
        assert stored.packet_hash == "AABBCCDDEEFF0011"
        assert stored.packet_id is None


class TestObserverReachGate:
    @pytest.mark.asyncio
    async def test_directory_off_makes_no_http_call(self, test_db):
        reset_observer_reach_cache()
        with patch("app.services.directory.httpx.AsyncClient") as mock_client:
            result = await get_packet_observer_reach_counts(["AABBCCDDEEFF0011"])
        assert result.directory_enabled is False
        assert result.counts == {}
        mock_client.assert_not_called()

    @pytest.mark.asyncio
    async def test_batch_falls_back_when_instance_is_old(self, test_db):
        reset_observer_reach_cache()
        await AppSettingsRepository.update(
            directory_enabled=True, directory_url="https://corescope.test"
        )
        spec = MagicMock()
        spec.status_code = 200
        spec.json.return_value = {"openapi": "3.0.3", "paths": {}}
        spec.content = b"{}"
        packet = MagicMock()
        packet.status_code = 200
        packet.json.return_value = {
            "observations": [{"observer_id": "obs-1", "observer_name": "Lyon", "path_json": []}]
        }
        packet.content = b"{}"
        observers = MagicMock()
        observers.status_code = 200
        observers.json.return_value = {"observers": []}
        observers.content = b"{}"

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=[spec, packet, observers])
        mock_client.post = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.directory.httpx.AsyncClient", return_value=mock_client):
            result = await get_packet_observer_reach_counts(["AABBCCDDEEFF0011"])

        assert result.directory_enabled is True
        assert result.counts["AABBCCDDEEFF0011"] == 1
        mock_client.post.assert_not_called()

    @pytest.mark.asyncio
    async def test_empty_batch_falls_back_to_packet_detail(self, test_db):
        reset_observer_reach_cache()
        await AppSettingsRepository.update(
            directory_enabled=True, directory_url="https://corescope.test"
        )
        spec = MagicMock()
        spec.status_code = 200
        spec.json.return_value = {
            "openapi": "3.0.3",
            "paths": {"/api/packets/observations": {"post": {}}},
        }
        spec.content = b"{}"
        batch = MagicMock()
        batch.status_code = 200
        batch.json.return_value = {"results": {"aabbccddeeff0011": []}}
        batch.content = b"{}"
        packet = MagicMock()
        packet.status_code = 200
        packet.json.return_value = {
            "observations": [{"observer_id": "obs-1", "observer_name": "Lyon", "path_json": []}]
        }
        packet.content = b"{}"
        observers = MagicMock()
        observers.status_code = 200
        observers.json.return_value = {"observers": []}
        observers.content = b"{}"

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=[spec, packet, observers])
        mock_client.post = AsyncMock(return_value=batch)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.directory.httpx.AsyncClient", return_value=mock_client):
            result = await get_packet_observer_reach_counts(["AABBCCDDEEFF0011"])

        assert result.counts["AABBCCDDEEFF0011"] == 1
        mock_client.post.assert_called()

    @pytest.mark.asyncio
    async def test_corescope_5xx_is_not_zero(self, test_db):
        reset_observer_reach_cache()
        await AppSettingsRepository.update(
            directory_enabled=True, directory_url="https://corescope.test"
        )
        failed = MagicMock()
        failed.status_code = 503
        failed.content = b"down"

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=failed)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.directory.httpx.AsyncClient", return_value=mock_client):
            with pytest.raises(HTTPException) as exc:
                await get_packet_observer_reach("AABBCCDDEEFF0011")
        assert exc.value.status_code == 500
