---
title: Other install paths
description: Docker, systemd, Portainer, and a checkout for development.
level: deep
order: 12
---

The [Installer](/en/docs/install/) one-liner covers the common case. This page explains it, plus Docker, Portainer, and a repository checkout.

## What the one-liner does

```bash
/bin/bash -c "$(curl -fsSL https://get.meshloom.app)"
```

`/bin/bash -c` matters because the script asks questions. On Linux it offers native systemd or Docker and only offers transports usable on that machine.

Native systemd installation uses `apt-get` or `dnf` when a package is available. It installs:

- the `meshloom` systemd unit
- `/etc/meshloom/meshloom.env`
- `/var/lib/meshloom`

Check it normally:

```bash
sudo systemctl status meshloom
```

## `install_service.sh` from a clone

From an existing checkout:

```bash
bash scripts/setup/install_service.sh
```

The script is repeatable. Run it again to change the transport, bot setting, or authentication credentials. It stops the service, rewrites the unit, reloads systemd, and starts it with the new configuration.

## Docker

The image is `ghcr.io/bagl3y/meshloom`. The repository includes `docker-compose.example.yml`. Important parts are:

- `./data:/app/data` for the SQLite database
- the radio device mapping, or `MESHCORE_TCP_HOST` / `MESHCORE_TCP_PORT`
- `MESHCORE_DATABASE_PATH: data/meshcore.db`
- `restart: unless-stopped`

The example also shows `user: "${UID:-1000}:${GID:-1000}"` to avoid root-owned files. This can complicate serial access and may require an extra group such as `dialout`. BLE needs further manual changes; see [Radio transports](/en/docs/deep/transports/).

## Portainer

For a stack built from the repository, use [`docker-compose.dev.yaml`](https://github.com/bagl3y/meshloom/blob/main/docker-compose.dev.yaml) and load `.env.example` values in Portainer:

```text
MESHLOOM_HTTP_PORT=8123
MESHLOOM_DATA_PATH=/opt/docker/meshloom/data
MESHCORE_DATABASE_PATH=data/meshcore.db
MESHCORE_TCP_HOST=192.168.1.100
MESHCORE_TCP_PORT=5000
MESHCORE_DISABLE_BOTS=false
MESHCORE_VAPID_SUBJECT=mailto:you@example.com
```

Do not commit real radio hosts, ports, or VAPID addresses.

## From a checkout

```bash
uv sync
uv run uvicorn app.main:app --reload
```

`uv sync` creates the project `.venv`; do not install these dependencies with `apt` or `dnf`. If `uv run uvicorn` reports `ModuleNotFoundError: No module named 'meshcore'`, start here. See [Troubleshooting](/en/docs/deep/troubleshooting/).

For frontend development:

```bash
cd frontend
npm install
npm run dev
```

Vite listens on `http://localhost:5173` and proxies `/api` to port 8000. For production:

```bash
cd frontend && npm install && npm run build && cd ..
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

If `frontend/dist` is absent, the backend checks `frontend/prebuilt`. If neither exists, it serves the API without static frontend routes. Run the repository quality checks from its root:

```bash
./scripts/quality/all_quality.sh
```

## Database and updates

| Installation | Database location |
|--------------|-------------------|
| systemd package | `/var/lib/meshloom` |
| Docker | `./data` (mounted at `/app/data`) |
| Checkout | `data/meshcore.db`, relative to the repository |

`MESHCORE_DATABASE_PATH` moves the database. Updates do not replace it; SQLite migrations run at startup in `user_version` order.

```bash
sudo apt upgrade
sudo dnf upgrade
sudo docker compose pull && sudo docker compose up -d
```

The default UI is `http://127.0.0.1:8000`. FastAPI’s generated API documentation is at `/docs`; it is not this site.
