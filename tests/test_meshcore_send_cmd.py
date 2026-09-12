"""Contract tests for meshcore 2.3.9+ ``send_cmd`` destination handling."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from meshcore.commands.messaging import MessagingCommands
from meshcore.events import EventType
from meshcore.packets import TxtType

from app.models import Contact
from app.routers.server_control import _send_cmd_destination


def _handler() -> MessagingCommands:
    handler = MessagingCommands()
    handler.send = AsyncMock(return_value=MagicMock(type=EventType.MSG_SENT, payload={}))
    return handler


@pytest.mark.asyncio
async def test_library_send_cmd_rejects_public_key_string():
    """meshcore 2.3.9.1 reads dst['type']; a hex key crashes instead of sending."""
    handler = _handler()
    with pytest.raises(TypeError, match="string indices must be integers"):
        await handler.send_cmd("aa" * 32, "ver")
    handler.send.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("contact_type", "expected_txt_type"),
    [
        (1, TxtType.CLI_CMD.value),
        (2, TxtType.CLI_DATA.value),
        (3, TxtType.CLI_DATA.value),
        (4, TxtType.CLI_DATA.value),
    ],
)
async def test_library_send_cmd_uses_contact_type_for_txt_type(contact_type, expected_txt_type):
    handler = _handler()
    dst = {"public_key": "aa" * 32, "type": contact_type}

    await handler.send_cmd(dst, "ver")

    payload = handler.send.await_args.args[0]
    assert payload[0] == 2  # CommandType.SEND_TXT_MSG
    assert payload[1] == expected_txt_type


def test_send_cmd_destination_is_radio_contact_dict():
    contact = Contact(public_key="bb" * 32, name="Rpt", type=2)
    dst = _send_cmd_destination(contact)
    assert dst["public_key"] == "bb" * 32
    assert dst["type"] == 2
    assert "adv_name" in dst
