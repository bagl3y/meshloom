"""Seed radio_transport into the e2e temp DB before uvicorn starts.

A fresh database starts with transport unconfigured, so the radio stays
paused. Leftover MESHCORE_SERIAL_PORT is copied into radio_serial_port
for hardware runs; an empty port means serial auto-detect.
"""

from __future__ import annotations

import asyncio
import os


async def main() -> None:
    from app.database import db

    port = (os.environ.get("MESHCORE_SERIAL_PORT") or "").strip()
    await db.connect()
    async with db.tx() as conn:
        await conn.execute(
            """
            UPDATE app_settings
            SET radio_transport = ?,
                radio_serial_port = ?,
                radio_serial_baudrate = 115200
            WHERE id = 1
            """,
            ("serial", port),
        )
    await db.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
