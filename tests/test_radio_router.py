"""Tests for radio router endpoint logic."""

import asyncio
from contextlib import asynccontextmanager
from unittest.mock import ANY, AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from meshcore import EventType
from pydantic import ValidationError

from app.models import Contact
from app.radio import RadioManager, radio_manager
from app.routers.radio import (
    PrivateKeyUpdate,
    RadioAdvertiseRequest,
    RadioConfigResponse,
    RadioConfigUpdate,
    RadioDiscoveryRequest,
    RadioSettings,
    disconnect_radio,
    discover_mesh,
    get_radio_config,
    reboot_radio,
    reconnect_radio,
    send_advertisement,
    set_private_key,
    update_radio_config,
)
from app.services.radio_runtime import RadioRuntime


def _radio_result(event_type=EventType.OK, payload=None):
    result = MagicMock()
    result.type = event_type
    result.payload = payload or {}
    return result


def _noop_radio_operation(mc=None):
    """Factory for a no-op radio_operation context manager that yields mc."""

    @asynccontextmanager
    async def _ctx(*_args, **_kwargs):
        yield mc

    return _ctx


def _runtime(manager):
    return RadioRuntime(lambda: manager)


@pytest.fixture(autouse=True)
def _reset_radio_state():
    """Save/restore radio_manager state so tests don't leak."""
    prev = radio_manager._meshcore
    prev_lock = radio_manager._operation_lock
    yield
    radio_manager._meshcore = prev
    radio_manager._operation_lock = prev_lock


def _mock_meshcore_with_info():
    mc = MagicMock()
    mc.self_info = {
        "public_key": "aa" * 32,
        "name": "NodeA",
        "adv_lat": 10.0,
        "adv_lon": 20.0,
        "tx_power": 17,
        "max_tx_power": 22,
        "radio_freq": 910.525,
        "radio_bw": 62.5,
        "radio_sf": 7,
        "radio_cr": 5,
        "adv_loc_policy": 2,
        "multi_acks": 0,
    }
    mc.commands = MagicMock()
    mc.commands.set_name = AsyncMock()
    mc.commands.set_coords = AsyncMock()
    mc.commands.set_tx_power = AsyncMock()
    mc.commands.set_radio = AsyncMock()
    mc.commands.set_advert_loc_policy = AsyncMock(return_value=_radio_result())
    mc.commands.set_multi_acks = AsyncMock(return_value=_radio_result())
    mc.commands.send_appstart = AsyncMock()
    mc.commands.import_private_key = AsyncMock(return_value=_radio_result())
    mc.commands.send_node_discover_req = AsyncMock(return_value=_radio_result())
    mc.stop_auto_message_fetching = AsyncMock()
    mc.start_auto_message_fetching = AsyncMock()
    return mc


class TestGetRadioConfig:
    @pytest.mark.asyncio
    async def test_maps_self_info_to_response(self):
        mc = _mock_meshcore_with_info()
        with patch("app.routers.radio.require_connected", return_value=mc):
            response = await get_radio_config()

        assert response.public_key == "aa" * 32
        assert response.name == "NodeA"
        assert response.lat == 10.0
        assert response.lon == 20.0
        assert response.radio.freq == 910.525
        assert response.radio.cr == 5
        assert response.advert_location_source == "current"
        assert response.multi_acks_enabled is False

    @pytest.mark.asyncio
    async def test_maps_multi_acks_to_response(self):
        mc = _mock_meshcore_with_info()
        mc.self_info["multi_acks"] = 1

        with patch("app.routers.radio.require_connected", return_value=mc):
            response = await get_radio_config()

        assert response.multi_acks_enabled is True

    @pytest.mark.asyncio
    async def test_maps_any_nonzero_advert_location_policy_to_current(self):
        mc = _mock_meshcore_with_info()
        mc.self_info["adv_loc_policy"] = 1

        with patch("app.routers.radio.require_connected", return_value=mc):
            response = await get_radio_config()

        assert response.advert_location_source == "current"

    @pytest.mark.asyncio
    async def test_returns_503_when_self_info_missing(self):
        mc = MagicMock()
        mc.self_info = None
        with patch("app.routers.radio.require_connected", return_value=mc):
            with pytest.raises(HTTPException) as exc:
                await get_radio_config()

        assert exc.value.status_code == 503


class TestUpdateRadioConfig:
    @pytest.mark.asyncio
    async def test_updates_only_requested_fields_and_refreshes_info(self):
        mc = _mock_meshcore_with_info()
        expected = RadioConfigResponse(
            public_key="aa" * 32,
            name="NodeUpdated",
            lat=1.23,
            lon=20.0,
            tx_power=17,
            max_tx_power=22,
            radio=RadioSettings(freq=910.525, bw=62.5, sf=7, cr=5),
        )

        with (
            patch("app.routers.radio.require_connected", return_value=mc),
            patch.object(radio_manager, "_meshcore", mc),
            patch("app.routers.radio.sync_radio_time", new_callable=AsyncMock) as mock_sync_time,
            patch(
                "app.routers.radio.get_radio_config", new_callable=AsyncMock, return_value=expected
            ),
        ):
            result = await update_radio_config(RadioConfigUpdate(name="NodeUpdated", lat=1.23))

        mc.commands.set_name.assert_awaited_once_with("NodeUpdated")
        mc.commands.set_coords.assert_awaited_once_with(lat=1.23, lon=20.0)
        mc.commands.set_tx_power.assert_not_awaited()
        mc.commands.set_radio.assert_not_awaited()
        mc.commands.send_appstart.assert_awaited_once()
        mock_sync_time.assert_awaited_once()
        assert result == expected

    @pytest.mark.asyncio
    async def test_updates_advert_location_source(self):
        mc = _mock_meshcore_with_info()
        expected = RadioConfigResponse(
            public_key="aa" * 32,
            name="NodeA",
            lat=10.0,
            lon=20.0,
            tx_power=17,
            max_tx_power=22,
            radio=RadioSettings(freq=910.525, bw=62.5, sf=7, cr=5),
            path_hash_mode=0,
            path_hash_mode_supported=False,
            advert_location_source="current",
            multi_acks_enabled=False,
        )

        with (
            patch("app.routers.radio.require_connected", return_value=mc),
            patch.object(radio_manager, "_meshcore", mc),
            patch("app.routers.radio.sync_radio_time", new_callable=AsyncMock),
            patch(
                "app.routers.radio.get_radio_config", new_callable=AsyncMock, return_value=expected
            ),
        ):
            result = await update_radio_config(RadioConfigUpdate(advert_location_source="current"))

        mc.commands.set_advert_loc_policy.assert_awaited_once_with(1)
        assert result == expected

    @pytest.mark.asyncio
    async def test_updates_multi_acks_enabled(self):
        mc = _mock_meshcore_with_info()
        expected = RadioConfigResponse(
            public_key="aa" * 32,
            name="NodeA",
            lat=10.0,
            lon=20.0,
            tx_power=17,
            max_tx_power=22,
            radio=RadioSettings(freq=910.525, bw=62.5, sf=7, cr=5),
            path_hash_mode=0,
            path_hash_mode_supported=False,
            advert_location_source="current",
            multi_acks_enabled=True,
        )

        with (
            patch("app.routers.radio.require_connected", return_value=mc),
            patch.object(radio_manager, "_meshcore", mc),
            patch("app.routers.radio.sync_radio_time", new_callable=AsyncMock),
            patch(
                "app.routers.radio.get_radio_config", new_callable=AsyncMock, return_value=expected
            ),
        ):
            result = await update_radio_config(RadioConfigUpdate(multi_acks_enabled=True))

        mc.commands.set_multi_acks.assert_awaited_once_with(1)
        assert result == expected

    def test_model_rejects_negative_path_hash_mode(self):
        with pytest.raises(ValidationError):
            RadioConfigUpdate(path_hash_mode=-1)

    def test_model_rejects_too_large_path_hash_mode(self):
        with pytest.raises(ValidationError):
            RadioConfigUpdate(path_hash_mode=3)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("path_hash_mode", [-1, 3, 999])
    async def test_endpoint_rejects_invalid_path_hash_mode(self, client, path_hash_mode):
        response = await client.patch("/api/radio/config", json={"path_hash_mode": path_hash_mode})

        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_rejects_path_hash_mode_when_firmware_does_not_support_it(self):
        mc = _mock_meshcore_with_info()

        with (
            patch("app.routers.radio.require_connected", return_value=mc),
            patch.object(radio_manager, "_meshcore", mc),
            patch.object(radio_manager, "path_hash_mode_supported", False),
        ):
            with pytest.raises(HTTPException) as exc:
                await update_radio_config(RadioConfigUpdate(path_hash_mode=1))

        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_propagates_radio_error_when_setting_path_hash_mode(self):
        mc = _mock_meshcore_with_info()
        mc.commands.set_path_hash_mode = AsyncMock(
            return_value=_radio_result(EventType.ERROR, {"error": "nope"})
        )

        with (
            patch("app.routers.radio.require_connected", return_value=mc),
            patch.object(radio_manager, "_meshcore", mc),
            patch.object(radio_manager, "path_hash_mode_supported", True),
            patch.object(radio_manager, "path_hash_mode", 0),
        ):
            with pytest.raises(HTTPException) as exc:
                await update_radio_config(RadioConfigUpdate(path_hash_mode=1))

        assert exc.value.status_code == 500
        assert "Failed to set path hash mode" in str(exc.value.detail)
        assert radio_manager.path_hash_mode == 0
        mc.commands.send_appstart.assert_not_awaited()


class TestPrivateKeyImport:
    @pytest.mark.asyncio
    async def test_rejects_invalid_hex(self):
        mc = _mock_meshcore_with_info()
        with patch("app.routers.radio.require_connected", return_value=mc):
            with pytest.raises(HTTPException) as exc:
                await set_private_key(PrivateKeyUpdate(private_key="not-hex"))

        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_returns_500_on_radio_error(self):
        mc = _mock_meshcore_with_info()
        mc.commands.import_private_key = AsyncMock(
            return_value=_radio_result(EventType.ERROR, {"error": "failed"})
        )
        with (
            patch("app.routers.radio.require_connected", return_value=mc),
            patch.object(radio_manager, "_meshcore", mc),
        ):
            with pytest.raises(HTTPException) as exc:
                await set_private_key(PrivateKeyUpdate(private_key="aa" * 64))

        assert exc.value.status_code == 500


class TestDiscoverMesh:
    @pytest.mark.asyncio
    async def test_discovers_repeaters_and_deduplicates_by_pubkey(self):
        mc = _mock_meshcore_with_info()
        callbacks = {}

        def _subscribe(event_type, callback, attribute_filters=None):
            callbacks["event_type"] = event_type
            callbacks["callback"] = callback
            callbacks["filters"] = attribute_filters
            subscription = MagicMock()
            subscription.unsubscribe = MagicMock()
            callbacks["subscription"] = subscription
            return subscription

        async def _send_node_discover_req(filter_bits, prefix_only=True, tag=None, since=None):
            assert filter_bits == (1 << 2)
            assert prefix_only is False
            assert since is None
            callbacks["callback"](
                _radio_result(
                    payload={
                        "pubkey": "11" * 32,
                        "node_type": 2,
                        "SNR": 7.5,
                        "RSSI": -101,
                        "SNR_in": 4.0,
                    }
                )
            )
            callbacks["callback"](
                _radio_result(
                    payload={
                        "pubkey": "11" * 32,
                        "node_type": 2,
                        "SNR": 9.0,
                        "RSSI": -99,
                        "SNR_in": 3.0,
                    }
                )
            )
            callbacks["callback"](
                _radio_result(
                    payload={
                        "pubkey": "22" * 32,
                        "node_type": 2,
                        "SNR": 2.5,
                        "RSSI": -110,
                        "SNR_in": 1.0,
                    }
                )
            )
            return _radio_result()

        mc.subscribe = MagicMock(side_effect=_subscribe)
        mc.commands.send_node_discover_req = AsyncMock(side_effect=_send_node_discover_req)

        with (
            patch("app.routers.radio.require_connected", return_value=mc),
            patch.object(radio_manager, "_meshcore", mc),
            patch("app.routers.radio.DISCOVERY_WINDOW_SECONDS", 0.01),
            patch(
                "app.routers.radio.ContactRepository.get_by_key",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch("app.routers.radio.ContactRepository.upsert", new_callable=AsyncMock),
            patch(
                "app.routers.radio.promote_prefix_contacts_for_contact",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch("app.routers.radio.broadcast_event"),
        ):
            response = await discover_mesh(RadioDiscoveryRequest(target="repeaters"))

        assert response.target == "repeaters"
        assert len(response.results) == 2
        assert response.results[0].public_key == "11" * 32
        assert response.results[0].node_type == "repeater"
        assert response.results[0].heard_count == 2
        assert response.results[0].local_snr == 9.0
        assert response.results[0].local_rssi == -99
        assert response.results[0].remote_snr == 4.0
        assert callbacks["event_type"] == EventType.DISCOVER_RESPONSE
        assert callbacks["subscription"].unsubscribe.called
        mc.stop_auto_message_fetching.assert_awaited_once()
        mc.start_auto_message_fetching.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_persists_newly_discovered_nodes_and_broadcasts_contact_updates(self):
        mc = _mock_meshcore_with_info()
        created_contact = Contact(
            public_key="44" * 32,
            name=None,
            type=2,
            flags=0,
            direct_path=None,
            direct_path_len=-1,
            direct_path_hash_mode=-1,
            last_advert=None,
            lat=None,
            lon=None,
            last_seen=123,
            on_radio=False,
            last_contacted=None,
            last_read_at=None,
            first_seen=123,
        )

        def _subscribe(_event_type, callback, _attribute_filters=None):
            callback(
                _radio_result(
                    payload={
                        "pubkey": "44" * 32,
                        "node_type": 2,
                        "SNR": 6.0,
                        "RSSI": -100,
                        "SNR_in": 2.5,
                    }
                )
            )
            return MagicMock(unsubscribe=MagicMock())

        mc.subscribe = MagicMock(side_effect=_subscribe)

        with (
            patch("app.routers.radio.require_connected", return_value=mc),
            patch.object(radio_manager, "_meshcore", mc),
            patch("app.routers.radio.DISCOVERY_WINDOW_SECONDS", 0.01),
            patch(
                "app.routers.radio.ContactRepository.get_by_key",
                new_callable=AsyncMock,
                # 1st: _persist check (not found), 2nd: _persist re-fetch (created),
                # 3rd: _attach_known_names lookup
                side_effect=[None, created_contact, created_contact],
            ) as mock_get_by_key,
            patch(
                "app.routers.radio.ContactRepository.upsert", new_callable=AsyncMock
            ) as mock_upsert,
            patch(
                "app.routers.radio.promote_prefix_contacts_for_contact",
                new_callable=AsyncMock,
                return_value=[],
            ) as mock_promote,
            patch("app.routers.radio.broadcast_event") as mock_broadcast,
        ):
            response = await discover_mesh(RadioDiscoveryRequest(target="repeaters"))

        assert len(response.results) == 1
        assert response.results[0].name is None  # created_contact has no name
        mock_get_by_key.assert_awaited()
        mock_upsert.assert_awaited_once()
        mock_promote.assert_awaited_once_with(public_key="44" * 32, log=ANY)
        upsert_arg = mock_upsert.await_args.args[0]
        assert upsert_arg.public_key == "44" * 32
        assert upsert_arg.type == 2
        assert upsert_arg.on_radio is False
        mock_broadcast.assert_called_once_with("contact", created_contact.model_dump())

    @pytest.mark.asyncio
    async def test_does_not_reinsert_existing_discovered_nodes(self):
        mc = _mock_meshcore_with_info()
        existing_contact = Contact(
            public_key="55" * 32,
            name="Known",
            type=4,
            flags=0,
            direct_path=None,
            direct_path_len=-1,
            direct_path_hash_mode=-1,
            last_advert=None,
            lat=None,
            lon=None,
            last_seen=123,
            on_radio=False,
            last_contacted=None,
            last_read_at=None,
            first_seen=123,
        )

        def _subscribe(_event_type, callback, _attribute_filters=None):
            callback(
                _radio_result(
                    payload={
                        "pubkey": "55" * 32,
                        "node_type": 4,
                        "SNR": 5.0,
                        "RSSI": -102,
                        "SNR_in": 1.5,
                    }
                )
            )
            return MagicMock(unsubscribe=MagicMock())

        mc.subscribe = MagicMock(side_effect=_subscribe)

        with (
            patch("app.routers.radio.require_connected", return_value=mc),
            patch.object(radio_manager, "_meshcore", mc),
            patch("app.routers.radio.DISCOVERY_WINDOW_SECONDS", 0.01),
            patch(
                "app.routers.radio.ContactRepository.get_by_key",
                new_callable=AsyncMock,
                return_value=existing_contact,
            ),
            patch(
                "app.routers.radio.ContactRepository.upsert", new_callable=AsyncMock
            ) as mock_upsert,
            patch("app.routers.radio.broadcast_event") as mock_broadcast,
        ):
            await discover_mesh(RadioDiscoveryRequest(target="sensors"))

        mock_upsert.assert_not_awaited()
        mock_broadcast.assert_not_called()

    @pytest.mark.asyncio
    async def test_discovers_all_supported_types(self):
        mc = _mock_meshcore_with_info()

        def _subscribe(_event_type, callback, _attribute_filters=None):
            callback(
                _radio_result(
                    payload={
                        "pubkey": "33" * 32,
                        "node_type": 4,
                        "SNR": 5.0,
                        "RSSI": -100,
                        "SNR_in": 2.0,
                    }
                )
            )
            subscription = MagicMock()
            subscription.unsubscribe = MagicMock()
            return subscription

        mc.subscribe = MagicMock(side_effect=_subscribe)

        with (
            patch("app.routers.radio.require_connected", return_value=mc),
            patch.object(radio_manager, "_meshcore", mc),
            patch("app.routers.radio.DISCOVERY_WINDOW_SECONDS", 0.01),
            patch(
                "app.routers.radio.ContactRepository.get_by_key",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch("app.routers.radio.ContactRepository.upsert", new_callable=AsyncMock),
            patch(
                "app.routers.radio.promote_prefix_contacts_for_contact",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch("app.routers.radio.broadcast_event"),
        ):
            response = await discover_mesh(RadioDiscoveryRequest(target="all"))

        mc.commands.send_node_discover_req.assert_awaited_once()
        assert mc.commands.send_node_discover_req.await_args.args[0] == (1 << 2) | (1 << 4)
        assert response.results[0].node_type == "sensor"

    @pytest.mark.asyncio
    async def test_raises_when_discovery_request_fails(self):
        mc = _mock_meshcore_with_info()
        mc.subscribe = MagicMock(return_value=MagicMock(unsubscribe=MagicMock()))
        mc.commands.send_node_discover_req = AsyncMock(
            return_value=_radio_result(EventType.ERROR, {"error": "nope"})
        )

        with (
            patch("app.routers.radio.require_connected", return_value=mc),
            patch.object(radio_manager, "_meshcore", mc),
        ):
            with pytest.raises(HTTPException) as exc:
                await discover_mesh(RadioDiscoveryRequest(target="sensors"))

        assert exc.value.status_code == 500
        assert exc.value.detail == "Failed to start mesh discovery"

    @pytest.mark.asyncio
    async def test_successful_import_refreshes_keystore(self):
        mc = _mock_meshcore_with_info()
        mc.commands.import_private_key = AsyncMock(return_value=_radio_result())
        with (
            patch("app.routers.radio.require_connected", return_value=mc),
            patch.object(radio_manager, "_meshcore", mc),
            patch(
                "app.keystore.export_and_store_private_key",
                new_callable=AsyncMock,
                return_value=True,
            ) as mock_export,
        ):
            result = await set_private_key(PrivateKeyUpdate(private_key="aa" * 64))

        assert result == {"status": "ok"}
        mock_export.assert_awaited_once_with(mc)

    @pytest.mark.asyncio
    async def test_import_ok_but_keystore_refresh_fails_returns_500(self):
        mc = _mock_meshcore_with_info()
        mc.commands.import_private_key = AsyncMock(return_value=_radio_result())
        with (
            patch("app.routers.radio.require_connected", return_value=mc),
            patch.object(radio_manager, "_meshcore", mc),
            patch(
                "app.keystore.export_and_store_private_key",
                new_callable=AsyncMock,
                return_value=False,
            ) as mock_export,
        ):
            with pytest.raises(HTTPException) as exc:
                await set_private_key(PrivateKeyUpdate(private_key="aa" * 64))

        assert exc.value.status_code == 500
        assert "keystore" in exc.value.detail.lower()
        # Called twice: initial attempt + one retry
        assert mock_export.await_count == 2

    @pytest.mark.asyncio
    async def test_keystore_refresh_succeeds_on_retry(self):
        mc = _mock_meshcore_with_info()
        mc.commands.import_private_key = AsyncMock(return_value=_radio_result())
        with (
            patch("app.routers.radio.require_connected", return_value=mc),
            patch.object(radio_manager, "_meshcore", mc),
            patch(
                "app.keystore.export_and_store_private_key",
                new_callable=AsyncMock,
                side_effect=[False, True],
            ) as mock_export,
        ):
            result = await set_private_key(PrivateKeyUpdate(private_key="aa" * 64))

        assert result == {"status": "ok"}
        assert mock_export.await_count == 2


class TestAdvertise:
    @pytest.mark.asyncio
    async def test_raises_when_send_fails(self):
        radio_manager._meshcore = MagicMock()
        with (
            patch("app.routers.radio.require_connected"),
            patch(
                "app.routers.radio.do_send_advertisement",
                new_callable=AsyncMock,
                return_value=False,
            ),
        ):
            with pytest.raises(HTTPException) as exc:
                await send_advertisement()

        assert exc.value.status_code == 500

    @pytest.mark.asyncio
    async def test_defaults_to_flood_mode(self):
        radio_manager._meshcore = MagicMock()
        with (
            patch("app.routers.radio.require_connected"),
            patch(
                "app.routers.radio.do_send_advertisement",
                new_callable=AsyncMock,
                return_value=True,
            ) as mock_send,
        ):
            result = await send_advertisement()

        assert result == {"status": "ok"}
        mock_send.assert_awaited_once()
        assert mock_send.await_args.kwargs["force"] is True
        assert mock_send.await_args.kwargs["mode"] == "flood"

    @pytest.mark.asyncio
    async def test_accepts_zero_hop_mode(self):
        radio_manager._meshcore = MagicMock()
        with (
            patch("app.routers.radio.require_connected"),
            patch(
                "app.routers.radio.do_send_advertisement",
                new_callable=AsyncMock,
                return_value=True,
            ) as mock_send,
        ):
            result = await send_advertisement(RadioAdvertiseRequest(mode="zero_hop"))

        assert result == {"status": "ok"}
        mock_send.assert_awaited_once()
        assert mock_send.await_args.kwargs["force"] is True
        assert mock_send.await_args.kwargs["mode"] == "zero_hop"

    @pytest.mark.asyncio
    async def test_concurrent_advertise_calls_are_serialized(self):
        active = 0
        max_active = 0

        async def fake_send(mc, *, force: bool, mode: str):
            nonlocal active, max_active
            assert force is True
            assert mode == "flood"
            active += 1
            max_active = max(max_active, active)
            await asyncio.sleep(0.05)
            active -= 1
            return True

        isolated_manager = RadioManager()
        isolated_manager._meshcore = MagicMock()
        with (
            patch("app.routers.radio.require_connected"),
            patch("app.routers.radio.radio_manager", _runtime(isolated_manager)),
            patch(
                "app.routers.radio.do_send_advertisement",
                new_callable=AsyncMock,
                side_effect=fake_send,
            ),
        ):
            await asyncio.gather(send_advertisement(), send_advertisement())

        assert max_active == 1


class TestRebootAndReconnect:
    @pytest.mark.asyncio
    async def test_reboot_connected_sends_reboot_command(self):
        mock_mc = MagicMock()
        mock_mc.commands.reboot = AsyncMock()

        mock_rm = MagicMock()
        mock_rm.is_connected = True
        mock_rm.meshcore = mock_mc
        mock_rm.radio_operation = _noop_radio_operation(mock_mc)

        with patch("app.routers.radio.radio_manager", _runtime(mock_rm)):
            result = await reboot_radio()

        assert result["status"] == "ok"
        mock_mc.commands.reboot.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_reboot_returns_pending_when_reconnect_in_progress(self):
        mock_rm = MagicMock()
        mock_rm.is_connected = False
        mock_rm.meshcore = None
        mock_rm.is_reconnecting = True
        mock_rm.radio_operation = _noop_radio_operation()

        with patch("app.routers.radio.radio_manager", _runtime(mock_rm)):
            result = await reboot_radio()

        assert result["status"] == "pending"
        assert result["connected"] is False

    @pytest.mark.asyncio
    async def test_reboot_attempts_reconnect_when_disconnected(self):
        mock_rm = MagicMock()
        mock_rm.is_connected = False
        mock_rm.meshcore = None
        mock_rm.is_reconnecting = False
        mock_rm.reconnect = AsyncMock(return_value=True)
        mock_rm.post_connect_setup = AsyncMock()
        mock_rm.radio_operation = _noop_radio_operation()
        mock_rm.connection_info = "TCP: test:4000"

        with patch("app.routers.radio.radio_manager", _runtime(mock_rm)):
            result = await reboot_radio()

        assert result["status"] == "ok"
        assert result["connected"] is True
        mock_rm.reconnect.assert_awaited_once()
        mock_rm.post_connect_setup.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_reconnect_returns_already_connected(self):
        mock_rm = MagicMock()
        mock_rm.is_connected = True
        mock_rm.radio_operation = _noop_radio_operation()
        mock_rm.is_setup_complete = True

        with patch("app.routers.radio.radio_manager", _runtime(mock_rm)):
            result = await reconnect_radio()

        assert result["status"] == "ok"
        assert result["connected"] is True

    @pytest.mark.asyncio
    async def test_reconnect_raises_503_on_failure(self):
        mock_rm = MagicMock()
        mock_rm.is_connected = False
        mock_rm.is_reconnecting = False
        mock_rm.reconnect = AsyncMock(return_value=False)
        mock_rm.radio_operation = _noop_radio_operation()

        with patch("app.routers.radio.radio_manager", _runtime(mock_rm)):
            with pytest.raises(HTTPException) as exc:
                await reconnect_radio()

        assert exc.value.status_code == 503

    @pytest.mark.asyncio
    async def test_disconnect_pauses_connection_attempts_and_broadcasts_health(self):
        mock_rm = MagicMock()
        mock_rm.pause_connection = AsyncMock()
        mock_rm.connection_info = "BLE: AA:BB:CC:DD:EE:FF"

        with (
            patch("app.routers.radio.radio_manager", _runtime(mock_rm)),
            patch("app.routers.radio.broadcast_health") as mock_broadcast,
        ):
            result = await disconnect_radio()

        assert result["status"] == "ok"
        assert result["connected"] is False
        assert result["paused"] is True
        mock_rm.pause_connection.assert_awaited_once()
        mock_broadcast.assert_called_once_with(False, "BLE: AA:BB:CC:DD:EE:FF")
