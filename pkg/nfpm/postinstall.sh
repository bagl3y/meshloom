#!/bin/sh
set -e

if command -v systemd-sysusers >/dev/null 2>&1; then
    systemd-sysusers meshloom.conf >/dev/null 2>&1 || systemd-sysusers /usr/lib/sysusers.d/meshloom.conf || true
fi
if command -v systemd-tmpfiles >/dev/null 2>&1; then
    systemd-tmpfiles --create /usr/lib/tmpfiles.d/meshloom.conf || true
fi

if [ -d /run/systemd/system ] && command -v systemctl >/dev/null 2>&1; then
    systemctl daemon-reload || true
fi

echo "==> Edit /etc/meshloom/meshloom.env if you need a specific radio transport."
echo "==> Start Meshloom with: sudo systemctl enable --now meshloom"
echo "==> UI: http://localhost:8000"
