# RemoteTerm for MeshCore

Backend server + browser interface for MeshCore mesh radio networks. Connect your radio over Serial, TCP, or BLE, and then you can:

* Send and receive DMs and channel messages
* Cache all received packets, decrypting as you gain keys
* Run multiple Python bots that can analyze messages and respond to DMs and channels
* Monitor unlimited contacts and channels (radio limits don't apply -- packets are decrypted server-side)
* Access your radio remotely over your network or VPN
* Search for hashtag channel names for channels you don't have keys for yet
* Forward packets to MQTT, LetsMesh, MeshRank, SQS, Apprise, etc.
* Use the more recent 1.14 firmwares which support multibyte pathing
* Visualize the mesh as a map or node set, view repeater stats, and more!

**Warning:** This app is for trusted environments only. _Do not put this on an untrusted network, or open it to the public._ You can optionally set `MESHCORE_BASIC_AUTH_USERNAME` and `MESHCORE_BASIC_AUTH_PASSWORD` for app-wide HTTP Basic auth, but that is only a coarse gate and must be paired with HTTPS. The bots can execute arbitrary Python code which means anyone who gets access to the app can, too. To completely disable the bot system, start the server with `MESHCORE_DISABLE_BOTS=true` — this prevents all bot execution and blocks bot configuration changes via the API. If you need stronger access control, consider using a reverse proxy like Nginx, or extending FastAPI; full access control and user management are outside the scope of this app.

![Screenshot of the application's web interface](app_screenshot.png)

## Disclaimer

This is developed with very heavy agentic assistance -- there is no warranty of fitness for any purpose. It's been lovingly guided by an engineer with a passion for clean code and good tests, but it's still mostly LLM output, so you may find some bugs.

If extending, have your LLM read the three `AGENTS.md` files: `./AGENTS.md`, `./frontend/AGENTS.md`, and `./app/AGENTS.md`.

## Start Here

Most users should choose one of these paths:

1. Clone and build from source.
2. Download the prebuilt release zip if you are on a resource-constrained system and do not want to build the frontend locally.
3. Use Docker if that better matches how you deploy.

For advanced setup, troubleshooting, HTTPS, systemd service setup, and remediation environment variables, see [README_ADVANCED.md](README_ADVANCED.md).

If you plan to contribute, read [CONTRIBUTING.md](CONTRIBUTING.md).

## Requirements

- Python 3.10+
- Node.js LTS or current (20, 22, 24, 25) if you're not using a prebuilt release
- [UV](https://astral.sh/uv) package manager: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- MeshCore radio connected via USB serial, TCP, or BLE

<details>
<summary>Finding your serial port</summary>

```bash
#######
# Linux
#######
ls /dev/ttyUSB* /dev/ttyACM*

#######
# macOS
#######
ls /dev/cu.usbserial-* /dev/cu.usbmodem*

###########
# Windows
###########
# In PowerShell:
Get-CimInstance Win32_SerialPort | Select-Object DeviceID, Caption

######
# WSL2
######
# Run this in an elevated PowerShell (not WSL) window
winget install usbipd
# restart console
# then find device ID
usbipd list
# make device shareable
usbipd bind --busid 3-8 # (or whatever the right ID is)
# attach device to WSL (run this each time you plug in the device)
usbipd attach --wsl --busid 3-8
# device will appear in WSL as /dev/ttyUSB0 or /dev/ttyACM0
```
</details>

## Path 1: Clone And Build

**This approach is recommended over Docker due to intermittent serial communications issues I've seen on \*nix systems.**

```bash
git clone https://github.com/jkingsman/Remote-Terminal-for-MeshCore.git
cd Remote-Terminal-for-MeshCore

uv sync
cd frontend && npm install && npm run build && cd ..

uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Access the app at http://localhost:8000.

Source checkouts expect a normal frontend build in `frontend/dist`.

On Linux, if you want this installed as a persistent `systemd` service that starts on boot and restarts automatically on failure, run `bash scripts/install_service.sh` from the repo root.

## Path 1.5: Use The Prebuilt Release Zip

Release zips can be found as an asset within the [releases listed here](https://github.com/jkingsman/Remote-Terminal-for-MeshCore/releases). This can be beneficial on resource constrained systems that cannot cope with the RAM-hungry frontend build process.

If you downloaded the release zip instead of cloning the repo, unpack it and run:

```bash
cd Remote-Terminal-for-MeshCore
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The release bundle includes `frontend/prebuilt`, so it does not require a local frontend build.

Alternatively, if you have already cloned the repo, you can fetch just the prebuilt frontend into your working tree without downloading the full release zip via `python3 scripts/fetch_prebuilt_frontend.py`.

## Path 2: Docker

> **Warning:** Docker has had reports intermittent issues with serial event subscriptions. The native method above is more reliable.

Local Docker builds are architecture-native by default. On Apple Silicon Macs and ARM64 Linux hosts such as Raspberry Pi, `docker compose build` / `docker compose up --build` will produce an ARM64 image unless you override the platform.

Edit `docker-compose.yaml` to set a serial device for passthrough, or uncomment your transport (serial or TCP). Then:

```bash
docker compose up -d
```

The database is stored in `./data/` (bind-mounted), so the container shares the same database as the native app. To rebuild after pulling updates:

```bash
docker compose up -d --build
```

To use the prebuilt Docker Hub image instead of building locally, replace:

```yaml
build: .
```

with:

```yaml
image: jkingsman/remoteterm-meshcore:latest
```

Then run:

```bash
docker compose pull
docker compose up -d
```

Published Docker tags are intended to be multi-arch (`linux/amd64` and `linux/arm64`). If you are building and publishing manually, use Docker Buildx:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t jkingsman/remoteterm-meshcore:latest \
  --push .
```

The container runs as root by default for maximum serial passthrough compatibility across host setups. On Linux, if you switch between native and Docker runs, `./data` can end up root-owned. If you do not need that serial compatibility behavior, you can enable the optional `user: "${UID:-1000}:${GID:-1000}"` line in `docker-compose.yaml` to keep ownership aligned with your host user.

To stop:

```bash
docker compose down
```

## Standard Environment Variables

Only one transport may be active at a time. If multiple are set, the server will refuse to start.

| Variable | Default | Description |
|----------|---------|-------------|
| `MESHCORE_SERIAL_PORT` | (auto-detect) | Serial port path |
| `MESHCORE_SERIAL_BAUDRATE` | 115200 | Serial baud rate |
| `MESHCORE_TCP_HOST` | | TCP host (mutually exclusive with serial/BLE) |
| `MESHCORE_TCP_PORT` | 4000 | TCP port |
| `MESHCORE_BLE_ADDRESS` | | BLE device address (mutually exclusive with serial/TCP) |
| `MESHCORE_BLE_PIN` | | BLE PIN (required when BLE address is set) |
| `MESHCORE_LOG_LEVEL` | INFO | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `MESHCORE_DATABASE_PATH` | `data/meshcore.db` | SQLite database path |
| `MESHCORE_DISABLE_BOTS` | false | Disable bot system entirely (blocks execution and config; an intermediate security precaution, but not as good as basic auth) |
| `MESHCORE_BASIC_AUTH_USERNAME` | | Optional app-wide HTTP Basic auth username; must be set together with `MESHCORE_BASIC_AUTH_PASSWORD` |
| `MESHCORE_BASIC_AUTH_PASSWORD` | | Optional app-wide HTTP Basic auth password; must be set together with `MESHCORE_BASIC_AUTH_USERNAME` |

Common launch patterns:

```bash
# Serial (explicit port)
MESHCORE_SERIAL_PORT=/dev/ttyUSB0 uv run uvicorn app.main:app --host 0.0.0.0 --port 8000

# TCP
MESHCORE_TCP_HOST=192.168.1.100 MESHCORE_TCP_PORT=4000 uv run uvicorn app.main:app --host 0.0.0.0 --port 8000

# BLE
MESHCORE_BLE_ADDRESS=AA:BB:CC:DD:EE:FF MESHCORE_BLE_PIN=123456 uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

On Windows (PowerShell), set environment variables as a separate statement:

```powershell
$env:MESHCORE_SERIAL_PORT="COM8" # or your COM port
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

If you enable Basic Auth, protect the app with HTTPS. HTTP Basic credentials are not safe on plain HTTP. Also note that the app's permissive CORS policy is a deliberate trusted-network tradeoff, so cross-origin browser JavaScript is not a reliable way to use that Basic Auth gate.

## Where To Go Next

- Advanced setup, troubleshooting, HTTPS, systemd, remediation variables, and debug logging: [README_ADVANCED.md](README_ADVANCED.md)
- Contributing, tests, linting, E2E notes, and important AGENTS files: [CONTRIBUTING.md](CONTRIBUTING.md)
- Live API docs after the backend is running: http://localhost:8000/docs
