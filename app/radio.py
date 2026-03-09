import asyncio
import glob
import logging
import platform
from contextlib import asynccontextmanager, nullcontext
from pathlib import Path

from meshcore import MeshCore

from app.config import settings

logger = logging.getLogger(__name__)


class RadioOperationError(RuntimeError):
    """Base class for shared radio operation lock errors."""


class RadioOperationBusyError(RadioOperationError):
    """Raised when a non-blocking radio operation cannot acquire the lock."""


class RadioDisconnectedError(RadioOperationError):
    """Raised when the radio disconnects between pre-check and lock acquisition."""


def detect_serial_devices() -> list[str]:
    """Detect available serial devices based on platform."""
    devices: list[str] = []
    system = platform.system()

    if system == "Darwin":
        # macOS: Use /dev/cu.* devices (callout devices, preferred over tty.*)
        patterns = [
            "/dev/cu.usb*",
            "/dev/cu.wchusbserial*",
            "/dev/cu.SLAB_USBtoUART*",
        ]
        for pattern in patterns:
            devices.extend(glob.glob(pattern))
        devices.sort()
    else:
        # Linux: Prefer /dev/serial/by-id/ for persistent naming
        by_id_path = Path("/dev/serial/by-id")
        if by_id_path.is_dir():
            devices.extend(str(p) for p in by_id_path.iterdir())

        # Also check /dev/ttyACM* and /dev/ttyUSB* as fallback
        resolved_paths = set()
        for dev in devices:
            try:
                resolved_paths.add(str(Path(dev).resolve()))
            except OSError:
                pass

        for pattern in ["/dev/ttyACM*", "/dev/ttyUSB*"]:
            for dev in glob.glob(pattern):
                try:
                    if str(Path(dev).resolve()) not in resolved_paths:
                        devices.append(dev)
                except OSError:
                    devices.append(dev)

        devices.sort()

    return devices


async def test_serial_device(port: str, baudrate: int, timeout: float = 3.0) -> bool:
    """Test if a MeshCore radio responds on the given serial port."""
    mc = None
    try:
        logger.debug("Testing serial device %s", port)
        mc = await asyncio.wait_for(
            MeshCore.create_serial(port=port, baudrate=baudrate),
            timeout=timeout,
        )

        # Check if we got valid self_info (indicates successful communication)
        if mc.is_connected and mc.self_info:
            logger.debug("Device %s responded with valid self_info", port)
            return True

        return False
    except asyncio.TimeoutError:
        logger.debug("Device %s timed out", port)
        return False
    except Exception as e:
        logger.debug("Device %s failed: %s", port, e)
        return False
    finally:
        if mc is not None:
            try:
                await mc.disconnect()
            except Exception:
                pass


async def find_radio_port(baudrate: int) -> str | None:
    """Find the first serial port with a responding MeshCore radio."""
    devices = detect_serial_devices()

    if not devices:
        logger.warning("No serial devices found")
        return None

    logger.info("Found %d serial device(s), testing for MeshCore radio...", len(devices))

    for device in devices:
        if await test_serial_device(device, baudrate):
            logger.info("Found MeshCore radio at %s", device)
            return device

    logger.warning("No MeshCore radio found on any serial device")
    return None


class RadioManager:
    """Manages the MeshCore radio connection."""

    def __init__(self):
        self._meshcore: MeshCore | None = None
        self._connection_info: str | None = None
        self._reconnect_task: asyncio.Task | None = None
        self._last_connected: bool = False
        self._reconnect_lock: asyncio.Lock | None = None
        self._operation_lock: asyncio.Lock | None = None
        self._setup_lock: asyncio.Lock | None = None
        self._setup_in_progress: bool = False
        self._setup_complete: bool = False
        self.path_hash_mode: int = 0
        self.path_hash_mode_supported: bool = False

    async def _acquire_operation_lock(
        self,
        name: str,
        *,
        blocking: bool,
    ) -> None:
        """Acquire the shared radio operation lock."""

        if self._operation_lock is None:
            self._operation_lock = asyncio.Lock()

        if not blocking:
            if self._operation_lock.locked():
                raise RadioOperationBusyError(f"Radio is busy (operation: {name})")
            await self._operation_lock.acquire()
        else:
            await self._operation_lock.acquire()

        logger.debug("Acquired radio operation lock (%s)", name)

    def _release_operation_lock(self, name: str) -> None:
        """Release the shared radio operation lock."""
        if self._operation_lock and self._operation_lock.locked():
            self._operation_lock.release()
            logger.debug("Released radio operation lock (%s)", name)
        else:
            logger.error("Attempted to release unlocked radio operation lock (%s)", name)

    @asynccontextmanager
    async def radio_operation(
        self,
        name: str,
        *,
        pause_polling: bool = False,
        suspend_auto_fetch: bool = False,
        blocking: bool = True,
    ):
        """Acquire shared radio lock and optionally pause polling / auto-fetch.

        After acquiring the lock, resolves the current MeshCore instance and
        yields it.  Callers get a fresh reference via ``async with ... as mc:``,
        avoiding stale-reference bugs when a reconnect swaps ``_meshcore``
        between the pre-check and the lock acquisition.

        Args:
            name: Human-readable operation name for logs/errors.
            pause_polling: Pause fallback message polling while held.
            suspend_auto_fetch: Stop MeshCore auto message fetching while held.
            blocking: If False, fail immediately when lock is held.

        Raises:
            RadioDisconnectedError: If the radio disconnected before the lock
                was acquired (``_meshcore`` is ``None``).
        """
        await self._acquire_operation_lock(name, blocking=blocking)

        mc = self._meshcore
        if mc is None:
            self._release_operation_lock(name)
            raise RadioDisconnectedError("Radio disconnected")

        poll_context = nullcontext()
        if pause_polling:
            from app.radio_sync import pause_polling as pause_polling_context

            poll_context = pause_polling_context()

        auto_fetch_paused = False

        try:
            async with poll_context:
                if suspend_auto_fetch:
                    await mc.stop_auto_message_fetching()
                    auto_fetch_paused = True
                yield mc
        finally:
            try:
                if auto_fetch_paused:
                    try:
                        await mc.start_auto_message_fetching()
                    except Exception as e:
                        logger.warning("Failed to restart auto message fetching (%s): %s", name, e)
            finally:
                self._release_operation_lock(name)

    async def post_connect_setup(self) -> None:
        """Full post-connection setup: handlers, key export, sync, advertisements, polling.

        Called after every successful connection or reconnection.
        Idempotent — safe to call repeatedly (periodic tasks have start guards).
        """
        from app.event_handlers import register_event_handlers
        from app.keystore import export_and_store_private_key
        from app.radio_sync import (
            drain_pending_messages,
            send_advertisement,
            start_message_polling,
            start_periodic_advert,
            start_periodic_sync,
            sync_and_offload_all,
            sync_radio_time,
        )

        if not self._meshcore:
            return

        if self._setup_lock is None:
            self._setup_lock = asyncio.Lock()

        async with self._setup_lock:
            if not self._meshcore:
                return
            self._setup_in_progress = True
            self._setup_complete = False
            mc = self._meshcore
            try:
                # Register event handlers (no radio I/O, just callback setup)
                register_event_handlers(mc)

                # Hold the operation lock for all radio I/O during setup.
                # This prevents user-initiated operations (send message, etc.)
                # from interleaving commands on the serial link.
                await self._acquire_operation_lock("post_connect_setup", blocking=True)
                try:
                    await export_and_store_private_key(mc)

                    # Sync radio clock with system time
                    await sync_radio_time(mc)

                    # Apply flood scope from settings (best-effort; older firmware
                    # may not support set_flood_scope)
                    from app.repository import AppSettingsRepository

                    app_settings = await AppSettingsRepository.get()
                    scope = app_settings.flood_scope
                    try:
                        await mc.commands.set_flood_scope(scope if scope else "")
                        logger.info("Applied flood_scope=%r", scope or "(disabled)")
                    except Exception as exc:
                        logger.warning(
                            "set_flood_scope failed (firmware may not support it): %s", exc
                        )

                    # Query path hash mode support (best-effort; older firmware won't report it).
                    # If the library's parsed payload is missing path_hash_mode (e.g. stale
                    # .pyc on WSL2 Windows mounts), fall back to raw-frame extraction.
                    reader = mc._reader
                    _original_handle_rx = reader.handle_rx
                    _captured_frame: list[bytes] = []

                    async def _capture_handle_rx(data: bytearray) -> None:
                        from meshcore.packets import PacketType

                        if len(data) > 0 and data[0] == PacketType.DEVICE_INFO.value:
                            _captured_frame.append(bytes(data))
                        return await _original_handle_rx(data)

                    reader.handle_rx = _capture_handle_rx
                    self.path_hash_mode = 0
                    self.path_hash_mode_supported = False
                    try:
                        device_query = await mc.commands.send_device_query()
                        if device_query and "path_hash_mode" in device_query.payload:
                            self.path_hash_mode = device_query.payload["path_hash_mode"]
                            self.path_hash_mode_supported = True
                        elif _captured_frame:
                            # Raw-frame fallback: byte 1 = fw_ver, byte 81 = path_hash_mode
                            raw = _captured_frame[-1]
                            fw_ver = raw[1] if len(raw) > 1 else 0
                            if fw_ver >= 10 and len(raw) >= 82:
                                self.path_hash_mode = raw[81]
                                self.path_hash_mode_supported = True
                                logger.warning(
                                    "path_hash_mode=%d extracted from raw frame "
                                    "(stale .pyc? try: rm %s)",
                                    self.path_hash_mode,
                                    getattr(
                                        __import__("meshcore.reader", fromlist=["reader"]),
                                        "__cached__",
                                        "meshcore __pycache__/reader.*.pyc",
                                    ),
                                )
                        if self.path_hash_mode_supported:
                            logger.info("Path hash mode: %d (supported)", self.path_hash_mode)
                        else:
                            logger.debug("Firmware does not report path_hash_mode")
                    except Exception as exc:
                        logger.debug("Failed to query path_hash_mode: %s", exc)
                    finally:
                        reader.handle_rx = _original_handle_rx

                    # Sync contacts/channels from radio to DB and clear radio
                    logger.info("Syncing and offloading radio data...")
                    result = await sync_and_offload_all(mc)
                    logger.info("Sync complete: %s", result)

                    # Send advertisement to announce our presence (if enabled and not throttled)
                    if await send_advertisement(mc):
                        logger.info("Advertisement sent")
                    else:
                        logger.debug("Advertisement skipped (disabled or throttled)")

                    # Drain any messages that were queued before we connected.
                    # This must happen BEFORE starting auto-fetch, otherwise both
                    # compete on get_msg() with interleaved radio I/O.
                    drained = await drain_pending_messages(mc)
                    if drained > 0:
                        logger.info("Drained %d pending message(s)", drained)

                    await mc.start_auto_message_fetching()
                    logger.info("Auto message fetching started")
                finally:
                    self._release_operation_lock("post_connect_setup")

                # Start background tasks AFTER releasing the operation lock.
                # These tasks acquire their own locks when they need radio access.
                start_periodic_sync()
                start_periodic_advert()
                start_message_polling()

                self._setup_complete = True
            finally:
                self._setup_in_progress = False

        logger.info("Post-connect setup complete")

    @property
    def meshcore(self) -> MeshCore | None:
        return self._meshcore

    @property
    def connection_info(self) -> str | None:
        return self._connection_info

    @property
    def is_connected(self) -> bool:
        return self._meshcore is not None and self._meshcore.is_connected

    @property
    def is_reconnecting(self) -> bool:
        return self._reconnect_lock is not None and self._reconnect_lock.locked()

    @property
    def is_setup_in_progress(self) -> bool:
        return self._setup_in_progress

    @property
    def is_setup_complete(self) -> bool:
        return self._setup_complete

    async def connect(self) -> None:
        """Connect to the radio using the configured transport."""
        if self._meshcore is not None:
            await self.disconnect()

        connection_type = settings.connection_type
        if connection_type == "tcp":
            await self._connect_tcp()
        elif connection_type == "ble":
            await self._connect_ble()
        else:
            await self._connect_serial()

    async def _connect_serial(self) -> None:
        """Connect to the radio over serial."""
        port = settings.serial_port

        # Auto-detect if no port specified
        if not port:
            logger.info("No serial port specified, auto-detecting...")
            port = await find_radio_port(settings.serial_baudrate)
            if not port:
                raise RuntimeError("No MeshCore radio found. Please specify MESHCORE_SERIAL_PORT.")

        logger.debug(
            "Connecting to radio at %s (baud %d)",
            port,
            settings.serial_baudrate,
        )
        self._meshcore = await MeshCore.create_serial(
            port=port,
            baudrate=settings.serial_baudrate,
            auto_reconnect=True,
            max_reconnect_attempts=10,
        )
        self._connection_info = f"Serial: {port}"
        self._last_connected = True
        self._setup_complete = False
        logger.debug("Serial connection established")

    async def _connect_tcp(self) -> None:
        """Connect to the radio over TCP."""
        host = settings.tcp_host
        port = settings.tcp_port

        logger.debug("Connecting to radio at %s:%d (TCP)", host, port)
        self._meshcore = await MeshCore.create_tcp(
            host=host,
            port=port,
            auto_reconnect=True,
            max_reconnect_attempts=10,
        )
        self._connection_info = f"TCP: {host}:{port}"
        self._last_connected = True
        self._setup_complete = False
        logger.debug("TCP connection established")

    async def _connect_ble(self) -> None:
        """Connect to the radio over BLE."""
        address = settings.ble_address
        pin = settings.ble_pin

        logger.debug("Connecting to radio at %s (BLE)", address)
        self._meshcore = await MeshCore.create_ble(
            address=address,
            pin=pin,
            auto_reconnect=True,
            max_reconnect_attempts=15,
        )
        self._connection_info = f"BLE: {address}"
        self._last_connected = True
        self._setup_complete = False
        logger.debug("BLE connection established")

    async def disconnect(self) -> None:
        """Disconnect from the radio."""
        if self._meshcore is not None:
            logger.debug("Disconnecting from radio")
            await self._meshcore.disconnect()
            self._meshcore = None
            self._setup_complete = False
            self.path_hash_mode = 0
            self.path_hash_mode_supported = False
            logger.debug("Radio disconnected")

    async def reconnect(self, *, broadcast_on_success: bool = True) -> bool:
        """Attempt to reconnect to the radio.

        Returns True if reconnection was successful, False otherwise.
        Uses a lock to prevent concurrent reconnection attempts.
        """
        from app.websocket import broadcast_error, broadcast_health

        # Lazily initialize lock (can't create in __init__ before event loop exists)
        if self._reconnect_lock is None:
            self._reconnect_lock = asyncio.Lock()

        async with self._reconnect_lock:
            # If we became connected while waiting for the lock (another
            # reconnect succeeded ahead of us), skip the redundant attempt.
            if self.is_connected:
                logger.debug("Already connected after acquiring lock, skipping reconnect")
                return True

            logger.info("Attempting to reconnect to radio...")

            try:
                # Disconnect if we have a stale connection
                if self._meshcore is not None:
                    try:
                        await self._meshcore.disconnect()
                    except Exception:
                        pass
                    self._meshcore = None

                # Try to connect (will auto-detect if no port specified)
                await self.connect()

                if self.is_connected:
                    logger.info("Radio reconnected successfully at %s", self._connection_info)
                    if broadcast_on_success:
                        broadcast_health(True, self._connection_info)
                    return True
                else:
                    logger.warning("Reconnection failed: not connected after connect()")
                    return False

            except Exception as e:
                logger.warning("Reconnection failed: %s", e, exc_info=True)
                broadcast_error("Reconnection failed", str(e))
                return False

    async def start_connection_monitor(self) -> None:
        """Start background task to monitor connection and auto-reconnect."""
        if self._reconnect_task is not None:
            return

        async def monitor_loop():
            from app.websocket import broadcast_health

            CHECK_INTERVAL_SECONDS = 5
            UNRESPONSIVE_THRESHOLD = 3
            consecutive_setup_failures = 0

            while True:
                try:
                    await asyncio.sleep(CHECK_INTERVAL_SECONDS)

                    current_connected = self.is_connected

                    # Detect status change
                    if self._last_connected and not current_connected:
                        # Connection lost
                        logger.warning("Radio connection lost, broadcasting status change")
                        broadcast_health(False, self._connection_info)
                        self._last_connected = False
                        consecutive_setup_failures = 0

                    if not current_connected:
                        # Attempt reconnection on every loop while disconnected
                        if not self.is_reconnecting and await self.reconnect(
                            broadcast_on_success=False
                        ):
                            await self.post_connect_setup()
                            broadcast_health(True, self._connection_info)
                            self._last_connected = True
                            consecutive_setup_failures = 0

                    elif not self._last_connected and current_connected:
                        # Connection restored (might have reconnected automatically).
                        # Always run setup before reporting healthy.
                        logger.info("Radio connection restored")
                        await self.post_connect_setup()
                        broadcast_health(True, self._connection_info)
                        self._last_connected = True
                        consecutive_setup_failures = 0

                    elif current_connected and not self._setup_complete:
                        # Transport connected but setup incomplete — retry
                        logger.info("Retrying post-connect setup...")
                        await self.post_connect_setup()
                        broadcast_health(True, self._connection_info)
                        consecutive_setup_failures = 0

                except asyncio.CancelledError:
                    # Task is being cancelled, exit cleanly
                    break
                except Exception as e:
                    consecutive_setup_failures += 1
                    if consecutive_setup_failures == UNRESPONSIVE_THRESHOLD:
                        logger.error(
                            "Post-connect setup has failed %d times in a row. "
                            "The radio port appears open but the radio is not "
                            "responding to commands. Common causes: another "
                            "process has the serial port open (check for other "
                            "RemoteTerm instances, serial monitors, etc.), the "
                            "firmware is in repeater mode (not client), or the "
                            "radio needs a power cycle. Will keep retrying.",
                            consecutive_setup_failures,
                        )
                    elif consecutive_setup_failures < UNRESPONSIVE_THRESHOLD:
                        logger.exception("Error in connection monitor, continuing: %s", e)
                    # After the threshold, silently retry (avoid log spam)

        self._reconnect_task = asyncio.create_task(monitor_loop())
        logger.info("Radio connection monitor started")

    async def stop_connection_monitor(self) -> None:
        """Stop the connection monitor task."""
        if self._reconnect_task is not None:
            self._reconnect_task.cancel()
            try:
                await self._reconnect_task
            except asyncio.CancelledError:
                pass
            self._reconnect_task = None
            logger.info("Radio connection monitor stopped")


radio_manager = RadioManager()
