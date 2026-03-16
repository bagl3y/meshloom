import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

logger = logging.getLogger(__name__)

INDEX_CACHE_CONTROL = "no-store"
ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable"
STATIC_FILE_CACHE_CONTROL = "public, max-age=3600"
FRONTEND_BUILD_INSTRUCTIONS = (
    "Run 'cd frontend && npm install && npm run build', "
    "or use a release zip that includes frontend/prebuilt."
)


class CacheControlStaticFiles(StaticFiles):
    """StaticFiles variant that adds a fixed Cache-Control header."""

    def __init__(self, *args, cache_control: str, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.cache_control = cache_control

    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = self.cache_control
        return response


def _file_response(path: Path, *, cache_control: str) -> FileResponse:
    return FileResponse(path, headers={"Cache-Control": cache_control})


def _is_index_file(path: Path, index_file: Path) -> bool:
    """Return True when the requested file is the SPA shell index.html."""
    return path == index_file


def _resolve_request_origin(request: Request) -> str:
    """Resolve the external origin, honoring common reverse-proxy headers."""
    forwarded_proto = request.headers.get("x-forwarded-proto")
    forwarded_host = request.headers.get("x-forwarded-host")

    if forwarded_proto and forwarded_host:
        proto = forwarded_proto.split(",")[0].strip()
        host = forwarded_host.split(",")[0].strip()
        if proto and host:
            return f"{proto}://{host}"

    return str(request.base_url).rstrip("/")


def _validate_frontend_dir(frontend_dir: Path, *, log_failures: bool = True) -> tuple[bool, Path]:
    """Resolve and validate a built frontend directory."""
    frontend_dir = frontend_dir.resolve()
    index_file = frontend_dir / "index.html"

    if not frontend_dir.exists():
        if log_failures:
            logger.error("Frontend build directory not found at %s.", frontend_dir)
        return False, frontend_dir

    if not frontend_dir.is_dir():
        if log_failures:
            logger.error("Frontend build path is not a directory: %s.", frontend_dir)
        return False, frontend_dir

    if not index_file.exists():
        if log_failures:
            logger.error("Frontend index file not found at %s.", index_file)
        return False, frontend_dir

    return True, frontend_dir


def register_frontend_static_routes(app: FastAPI, frontend_dir: Path) -> bool:
    """Register frontend static file routes if a built frontend is available."""
    valid, frontend_dir = _validate_frontend_dir(frontend_dir)
    if not valid:
        return False

    index_file = frontend_dir / "index.html"
    assets_dir = frontend_dir / "assets"

    if assets_dir.exists() and assets_dir.is_dir():
        app.mount(
            "/assets",
            CacheControlStaticFiles(directory=assets_dir, cache_control=ASSET_CACHE_CONTROL),
            name="assets",
        )
    else:
        logger.warning(
            "Frontend assets directory missing at %s; /assets files will not be served",
            assets_dir,
        )

    @app.get("/")
    async def serve_index():
        """Serve the frontend index.html."""
        return _file_response(index_file, cache_control=INDEX_CACHE_CONTROL)

    @app.get("/site.webmanifest")
    async def serve_webmanifest(request: Request):
        """Serve a dynamic web manifest using the active request origin."""
        origin = _resolve_request_origin(request)
        manifest = {
            "name": "RemoteTerm for MeshCore",
            "short_name": "RemoteTerm",
            "id": f"{origin}/",
            "start_url": f"{origin}/",
            "scope": f"{origin}/",
            "display": "standalone",
            "display_override": ["window-controls-overlay", "standalone", "fullscreen"],
            "theme_color": "#111419",
            "background_color": "#111419",
            "icons": [
                {
                    "src": f"{origin}/web-app-manifest-192x192.png",
                    "sizes": "192x192",
                    "type": "image/png",
                    "purpose": "maskable",
                },
                {
                    "src": f"{origin}/web-app-manifest-512x512.png",
                    "sizes": "512x512",
                    "type": "image/png",
                    "purpose": "maskable",
                },
            ],
        }
        return JSONResponse(
            manifest,
            media_type="application/manifest+json",
            headers={"Cache-Control": "no-store"},
        )

    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        """Serve frontend files, falling back to index.html for SPA routing."""
        file_path = (frontend_dir / path).resolve()
        try:
            file_path.relative_to(frontend_dir)
        except ValueError:
            raise HTTPException(status_code=404, detail="Not found") from None

        if file_path.exists() and file_path.is_file():
            cache_control = (
                INDEX_CACHE_CONTROL
                if _is_index_file(file_path, index_file)
                else STATIC_FILE_CACHE_CONTROL
            )
            return _file_response(file_path, cache_control=cache_control)

        return _file_response(index_file, cache_control=INDEX_CACHE_CONTROL)

    logger.info("Serving frontend from %s", frontend_dir)
    return True


def register_first_available_frontend_static_routes(
    app: FastAPI, frontend_dirs: list[Path]
) -> Path | None:
    """Register frontend routes from the first valid build directory."""
    for i, candidate in enumerate(frontend_dirs):
        valid, resolved_candidate = _validate_frontend_dir(candidate, log_failures=False)
        if not valid:
            continue

        if register_frontend_static_routes(app, resolved_candidate):
            logger.info("Selected frontend build directory %s", resolved_candidate)
            return resolved_candidate

        if i < len(frontend_dirs) - 1:
            logger.warning("Frontend build at %s was unusable; trying fallback", resolved_candidate)

    logger.error(
        "No usable frontend build found. Searched: %s. %s API will continue without frontend routes.",
        ", ".join(str(path.resolve()) for path in frontend_dirs),
        FRONTEND_BUILD_INSTRUCTIONS,
    )
    return None


def register_frontend_missing_fallback(app: FastAPI) -> None:
    """Register a fallback route that tells the user to build the frontend."""

    @app.get("/", include_in_schema=False)
    async def frontend_not_built():
        return JSONResponse(
            status_code=404,
            content={"detail": f"Frontend not built. {FRONTEND_BUILD_INSTRUCTIONS}"},
        )
