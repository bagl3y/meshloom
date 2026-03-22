import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.config import settings as server_settings
from app.config import setup_logging
from app.database import db
from app.frontend_static import (
    register_first_available_frontend_static_routes,
    register_frontend_missing_fallback,
)
from app.radio import RadioDisconnectedError
from app.radio_sync import (
    stop_message_polling,
    stop_periodic_advert,
    stop_periodic_sync,
)
from app.routers import (
    channels,
    contacts,
    debug,
    fanout,
    health,
    messages,
    packets,
    radio,
    read_state,
    repeaters,
    rooms,
    settings,
    statistics,
    ws,
)
from app.security import add_optional_basic_auth_middleware
from app.services.radio_runtime import radio_runtime as radio_manager
from app.version_info import get_app_build_info

setup_logging()
logger = logging.getLogger(__name__)


def _install_meshcore_serial_junk_prefix_patch(serial_connection_cls=None) -> None:
    """Make meshcore serial framing tolerant of leading junk bytes.

    Some radios emit console/debug text on the same UART as the companion
    protocol. The current meshcore serial parser searches for the frame start
    marker but then incorrectly begins parsing at byte 0 of the chunk instead
    of the located marker offset, which can drop valid response frames.

    TODO: Remove this monkeypatch once meshcore_py includes the upstream fix:
    https://github.com/meshcore-dev/meshcore_py/pull/67
    """
    if serial_connection_cls is None:
        from meshcore.serial_cx import SerialConnection as serial_connection_cls

    original_handle_rx = serial_connection_cls.handle_rx
    if getattr(original_handle_rx, "_rtmesh_junk_prefix_patch", False):
        return

    def patched_handle_rx(self, data: bytearray):
        if len(self.header) == 0:
            idx = data.find(b"\x3e")
            if idx < 0:
                return
            if idx > 0:
                data = data[idx:]
        return original_handle_rx(self, data)

    patched_handle_rx._rtmesh_junk_prefix_patch = True
    serial_connection_cls.handle_rx = patched_handle_rx


_install_meshcore_serial_junk_prefix_patch()


async def _startup_radio_connect_and_setup() -> None:
    """Connect/setup the radio in the background so HTTP serving can start immediately."""
    try:
        connected = await radio_manager.reconnect_and_prepare(broadcast_on_success=True)
        if connected:
            logger.info("Connected to radio")
        else:
            logger.warning("Failed to connect to radio on startup")
    except Exception:
        logger.exception("Failed to connect to radio on startup")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage database and radio connection lifecycle."""
    await db.connect()
    logger.info("Database connected")

    # Ensure default channels exist in the database even before the radio
    # connects. Without this, a fresh or disconnected instance would return
    # zero channels from GET /channels until the first successful radio sync.
    from app.radio_sync import ensure_default_channels

    await ensure_default_channels()

    # Always start connection monitor (even if initial connection failed)
    await radio_manager.start_connection_monitor()

    # Start fanout modules (MQTT, etc.) from database configs
    from app.fanout.manager import fanout_manager

    try:
        await fanout_manager.load_from_db()
    except Exception:
        logger.exception("Failed to start fanout modules")

    startup_radio_task = asyncio.create_task(_startup_radio_connect_and_setup())
    app.state.startup_radio_task = startup_radio_task

    yield

    logger.info("Shutting down")
    if startup_radio_task and not startup_radio_task.done():
        startup_radio_task.cancel()
        try:
            await startup_radio_task
        except asyncio.CancelledError:
            pass
    await fanout_manager.stop_all()
    await radio_manager.stop_connection_monitor()
    await stop_message_polling()
    await stop_periodic_advert()
    await stop_periodic_sync()
    if radio_manager.meshcore:
        await radio_manager.meshcore.stop_auto_message_fetching()
    await radio_manager.disconnect()
    await db.disconnect()


app = FastAPI(
    title="RemoteTerm for MeshCore API",
    description="API for interacting with MeshCore mesh radio networks",
    version=get_app_build_info().version,
    lifespan=lifespan,
)

add_optional_basic_auth_middleware(app, server_settings)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RadioDisconnectedError)
async def radio_disconnected_handler(request: Request, exc: RadioDisconnectedError):
    """Return 503 when a radio disconnect race occurs during an operation."""
    return JSONResponse(status_code=503, content={"detail": "Radio not connected"})


# API routes - all prefixed with /api for production compatibility
app.include_router(health.router, prefix="/api")
app.include_router(debug.router, prefix="/api")
app.include_router(fanout.router, prefix="/api")
app.include_router(radio.router, prefix="/api")
app.include_router(contacts.router, prefix="/api")
app.include_router(repeaters.router, prefix="/api")
app.include_router(rooms.router, prefix="/api")
app.include_router(channels.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(packets.router, prefix="/api")
app.include_router(read_state.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(statistics.router, prefix="/api")
app.include_router(ws.router, prefix="/api")

# Serve frontend static files in production
FRONTEND_DIST_DIR = Path(__file__).parent.parent / "frontend" / "dist"
FRONTEND_PREBUILT_DIR = Path(__file__).parent.parent / "frontend" / "prebuilt"
if not register_first_available_frontend_static_routes(
    app, [FRONTEND_DIST_DIR, FRONTEND_PREBUILT_DIR]
):
    register_frontend_missing_fallback(app)
