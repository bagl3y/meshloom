"""Tests for app startup/lifespan behavior."""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from app.main import _install_meshcore_serial_junk_prefix_patch, app, lifespan


class TestStartupLifespan:
    @pytest.mark.asyncio
    async def test_meshcore_serial_patch_discards_leading_junk_before_frame(self):
        class RecordingReader:
            def __init__(self):
                self.frames = []

            async def handle_rx(self, data):
                self.frames.append(bytes(data))

        class FakeSerialConnection:
            def __init__(self):
                self.header = b""
                self.reader = None
                self.frame_expected_size = 0
                self.inframe = b""

            def set_reader(self, reader):
                self.reader = reader

            def handle_rx(self, data: bytearray):
                if len(self.header) == 0:
                    idx = data.find(b"\x3e")
                    if idx < 0:
                        return
                    self.header = data[0:1]
                    data = data[1:]

                if len(self.header) < 3:
                    while len(self.header) < 3 and len(data) > 0:
                        self.header = self.header + data[0:1]
                        data = data[1:]
                    if len(self.header) < 3:
                        return

                    self.frame_expected_size = int.from_bytes(
                        self.header[1:], "little", signed=False
                    )
                    if self.frame_expected_size > 300:
                        self.header = b""
                        self.inframe = b""
                        self.frame_expected_size = 0
                        if len(data) > 0:
                            self.handle_rx(data)
                            return

                upbound = self.frame_expected_size - len(self.inframe)
                if len(data) < upbound:
                    self.inframe = self.inframe + data
                    return

                self.inframe = self.inframe + data[0:upbound]
                data = data[upbound:]
                if self.reader is not None:
                    asyncio.create_task(self.reader.handle_rx(self.inframe))
                self.inframe = b""
                self.header = b""
                self.frame_expected_size = 0
                if len(data) > 0:
                    self.handle_rx(data)

        _install_meshcore_serial_junk_prefix_patch(FakeSerialConnection)

        conn = FakeSerialConnection()
        reader = RecordingReader()
        conn.set_reader(reader)

        payload = b"\x00\x01\x02\x53"
        frame = b"\x3e" + len(payload).to_bytes(2, "little") + payload

        conn.handle_rx(b"junk bytes\r\n" + frame)
        await asyncio.sleep(0)

        assert reader.frames == [payload]

    @pytest.mark.asyncio
    async def test_lifespan_does_not_wait_for_radio_setup(self):
        """HTTP serving should start before post-connect setup finishes."""
        setup_started = asyncio.Event()
        release_setup = asyncio.Event()

        async def slow_setup():
            setup_started.set()
            await release_setup.wait()

        with (
            patch("app.main.db.connect", new=AsyncMock()),
            patch("app.main.db.disconnect", new=AsyncMock()),
            patch("app.radio_sync.ensure_default_channels", new=AsyncMock()),
            patch("app.radio.radio_manager.start_connection_monitor", new=AsyncMock()),
            patch("app.radio.radio_manager.stop_connection_monitor", new=AsyncMock()),
            patch("app.radio.radio_manager.disconnect", new=AsyncMock()),
            patch("app.radio.radio_manager.reconnect", new=AsyncMock(return_value=True)),
            patch(
                "app.radio.radio_manager.post_connect_setup", new=AsyncMock(side_effect=slow_setup)
            ),
            patch("app.fanout.manager.fanout_manager.load_from_db", new=AsyncMock()),
            patch("app.fanout.manager.fanout_manager.stop_all", new=AsyncMock()),
            patch("app.radio_sync.stop_message_polling", new=AsyncMock()),
            patch("app.radio_sync.stop_periodic_advert", new=AsyncMock()),
            patch("app.radio_sync.stop_periodic_sync", new=AsyncMock()),
            patch("app.websocket.broadcast_health"),
        ):
            cm = lifespan(app)
            await asyncio.wait_for(cm.__aenter__(), timeout=0.2)

            await asyncio.wait_for(setup_started.wait(), timeout=0.2)
            startup_task = app.state.startup_radio_task
            assert startup_task.done() is False

            release_setup.set()
            await asyncio.wait_for(cm.__aexit__(None, None, None), timeout=0.5)
