#!/bin/sh
set -e
if [ -d /run/systemd/system ] && command -v systemctl >/dev/null 2>&1; then
    systemctl daemon-reload || true
fi
echo "==> /var/lib/meshloom and /etc/meshloom were left in place."
