import pytest

from app.models import RadioTransportSnapshot
from app.repository.radio_transport import RadioTransportRepository, validate_transport_update
from app.services.radio_identity import wipe_mesh_identity_data
from app.services.radio_transport import maybe_import_legacy_env


def test_validate_transport_update_requires_tcp_host() -> None:
    with pytest.raises(ValueError, match="tcp_host"):
        validate_transport_update("tcp", tcp_host="")


def test_validate_transport_update_requires_ble_pin() -> None:
    with pytest.raises(ValueError, match="ble_pin"):
        validate_transport_update("ble", ble_address="AA:BB:CC:DD:EE:FF", ble_pin="")


@pytest.mark.asyncio
async def test_radio_transport_roundtrip(test_db):
    saved = await RadioTransportRepository.save(
        RadioTransportSnapshot(transport="tcp", tcp_host="192.168.1.8", tcp_port=5000)
    )
    loaded = await RadioTransportRepository.get()
    assert loaded.transport == "tcp"
    assert loaded.tcp_host == "192.168.1.8"
    assert loaded.configured is True
    assert saved.ble_pin == ""


@pytest.mark.asyncio
async def test_env_import_ignored_on_new_database(test_db, monkeypatch):
    monkeypatch.setenv("MESHCORE_TCP_HOST", "10.0.0.9")
    snapshot = await maybe_import_legacy_env(existing_database=False)
    assert snapshot.transport is None
    assert snapshot.env_imported is True


@pytest.mark.asyncio
async def test_env_import_once_on_existing_database(test_db, monkeypatch):
    monkeypatch.setenv("MESHCORE_TCP_HOST", "10.0.0.9")
    monkeypatch.setenv("MESHCORE_TCP_PORT", "4403")
    first = await maybe_import_legacy_env(existing_database=True)
    assert first.transport == "tcp"
    assert first.tcp_host == "10.0.0.9"
    assert first.tcp_port == 4403
    assert first.env_imported is True

    await RadioTransportRepository.save(RadioTransportSnapshot(transport=None, env_imported=True))
    monkeypatch.setenv("MESHCORE_TCP_HOST", "10.0.0.10")
    second = await maybe_import_legacy_env(existing_database=True)
    assert second.transport is None
    assert second.env_imported is True


@pytest.mark.asyncio
async def test_wipe_mesh_identity_data_keeps_channels(test_db, monkeypatch):
    import app.services.radio_identity as identity

    monkeypatch.setattr(identity, "db", test_db)
    async with test_db.tx() as conn:
        await conn.execute(
            "INSERT INTO contacts (public_key, name) VALUES (?, ?)",
            ("a" * 64, "Alice"),
        )
        await conn.execute(
            """
            INSERT INTO messages (type, conversation_key, text, received_at, outgoing)
            VALUES ('PRIV', ?, 'hi', 1, 0)
            """,
            ("a" * 64,),
        )
    await wipe_mesh_identity_data()
    async with test_db.readonly() as conn:
        async with conn.execute("SELECT COUNT(*) FROM contacts") as cursor:
            assert (await cursor.fetchone())[0] == 0
        async with conn.execute("SELECT COUNT(*) FROM messages") as cursor:
            assert (await cursor.fetchone())[0] == 0
        async with conn.execute("SELECT COUNT(*) FROM channels") as cursor:
            assert (await cursor.fetchone())[0] >= 0
