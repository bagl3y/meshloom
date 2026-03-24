# Advanced Setup And Troubleshooting

## Remediation Environment Variables

These are intended for diagnosing or working around radios that behave oddly.

| Variable | Default | Description |
|----------|---------|-------------|
| `MESHCORE_ENABLE_MESSAGE_POLL_FALLBACK` | false | Run aggressive 10-second `get_msg()` fallback polling to check for messages |
| `MESHCORE_FORCE_CHANNEL_SLOT_RECONFIGURE` | false | Disable channel-slot reuse and force `set_channel(...)` before every channel send |
| `__CLOWNTOWN_DO_CLOCK_WRAPAROUND` | false | Highly experimental: if the radio clock is ahead of system time, try forcing the clock to `0xFFFFFFFF`, wait for uint32 wraparound, and then retry normal time sync before falling back to reboot |

By default the app relies on radio events plus MeshCore auto-fetch for incoming messages, and also runs a low-frequency hourly audit poll. That audit checks both:

- whether messages were left on the radio without reaching the app through event subscription
- whether the app's channel-slot expectations still match the radio's actual channel listing

If the audit finds a mismatch, you'll see an error in the application UI and your logs. If you see that warning, or if messages on the radio never show up in the app, try `MESHCORE_ENABLE_MESSAGE_POLL_FALLBACK=true` to switch that task into a more aggressive 10-second safety net. If room sends appear to be using the wrong channel slot or another client is changing slots underneath this app, try `MESHCORE_FORCE_CHANNEL_SLOT_RECONFIGURE=true` to force the radio to validate the channel slot is valid before sending (will delay sending by ~500ms).

`__CLOWNTOWN_DO_CLOCK_WRAPAROUND=true` is a last-resort clock remediation for nodes whose RTC is stuck in the future and where rescue-mode time setting or GPS-based time is not available. It intentionally relies on the clock rolling past the 32-bit epoch boundary, which is board-specific behavior and may not be safe or effective on all MeshCore targets. Treat it as highly experimental.

## HTTPS

WebGPU channel-finding requires a secure context when you are not on `localhost`.

Generate a local cert and start the backend with TLS:

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost'
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --ssl-keyfile=key.pem --ssl-certfile=cert.pem
```

For Docker Compose, generate the cert, mount it into the container, and override the launch command:

```yaml
services:
  remoteterm:
    volumes:
      - ./data:/app/data
      - ./cert.pem:/app/cert.pem:ro
      - ./key.pem:/app/key.pem:ro
    command: uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --ssl-keyfile=/app/key.pem --ssl-certfile=/app/cert.pem
```

Accept the browser warning, or use [mkcert](https://github.com/FiloSottile/mkcert) for locally-trusted certs.

## Systemd Service

Assumes you are running from `/opt/remoteterm`; adjust paths if you deploy elsewhere.

```bash
# Create service user
sudo useradd -r -m -s /bin/false remoteterm

# Install to /opt/remoteterm
sudo mkdir -p /opt/remoteterm
sudo cp -r . /opt/remoteterm/
sudo chown -R remoteterm:remoteterm /opt/remoteterm

# Install dependencies
cd /opt/remoteterm
sudo -u remoteterm uv venv
sudo -u remoteterm uv sync

# If deploying from a source checkout, build the frontend first
sudo -u remoteterm bash -lc 'cd /opt/remoteterm/frontend && npm install && npm run build'

# If deploying from the release zip artifact, frontend/prebuilt is already present
```

Create `/etc/systemd/system/remoteterm.service` with:

```ini
[Unit]
Description=RemoteTerm for MeshCore
After=network.target

[Service]
Type=simple
User=remoteterm
Group=remoteterm
WorkingDirectory=/opt/remoteterm
ExecStart=/opt/remoteterm/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
Environment=MESHCORE_DATABASE_PATH=/opt/remoteterm/data/meshcore.db
# Uncomment and set if auto-detection doesn't work:
# Environment=MESHCORE_SERIAL_PORT=/dev/ttyUSB0
SupplementaryGroups=dialout

[Install]
WantedBy=multi-user.target
```

Then install and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now remoteterm
sudo systemctl status remoteterm
sudo journalctl -u remoteterm -f
```

## Debug Logging And Bug Reports

If you're experiencing issues or opening a bug report, please start the backend with debug logging enabled. Debug mode provides a much more detailed breakdown of radio communication, packet processing, and other internal operations, which makes it significantly easier to diagnose problems.

```bash
MESHCORE_LOG_LEVEL=DEBUG uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

You can also navigate to `/api/debug` (or go to Settings -> About -> "Open debug support snapshot" at the bottom). This debug block contains information about the operating environment, expectations around keys and channels, and radio status. It also includes the most recent logs. **Non-log information reveals no keys, channel names, or other privilege information beyond the names of your bots. The logs, however, may contain channel names or keys (but never your private key).** If you do not wish to include this information, copy up to the `STOP COPYING HERE` marker in the debug body.

## Development Notes

For day-to-day development, see [CONTRIBUTING.md](CONTRIBUTING.md).

Windows note: I've seen an intermittent startup issue like `"Received empty packet: index out of range"` with failed contact sync. I can't figure out why this happens. The issue typically resolves on restart. If you can figure out why this happens, I will buy you a virtual or iRL six pack if you're in the PNW. As a former always-windows-girlie before embracing WSL2, I despise second-classing M$FT users, but I'm just stuck with this one.
