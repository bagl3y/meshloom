"""Contact group repository and router contracts."""

import pytest
from fastapi import HTTPException

from app.models import (
    ContactGroupCreate,
    ContactGroupMembersUpdate,
    ContactGroupUpdate,
    ContactUpsert,
)
from app.repository import ContactGroupRepository, ContactRepository
from app.routers.contact_groups import (
    create_contact_group,
    delete_contact_group,
    list_contact_groups,
    replace_contact_group_members,
    update_contact_group,
)


async def _contact(key: str, name: str = "Alice") -> None:
    await ContactRepository.upsert(ContactUpsert(public_key=key, name=name, type=1))


class TestContactGroupRepository:
    @pytest.mark.asyncio
    async def test_create_list_and_members(self, test_db):
        key = "aa" * 32
        await _contact(key)
        group = await ContactGroupRepository.create("  Home  ")
        assert group.name == "Home"
        assert group.public_keys == []

        updated = await ContactGroupRepository.set_members(group.id, [key, "zz" * 32])
        assert updated is not None
        assert updated.public_keys == [key]

        listed = await ContactGroupRepository.list_all()
        assert len(listed) == 1
        assert listed[0].public_keys == [key]

    @pytest.mark.asyncio
    async def test_duplicate_name_rejected(self, test_db):
        await ContactGroupRepository.create("Mesh")
        with pytest.raises(ValueError, match="already exists"):
            await ContactGroupRepository.create("mesh")

    @pytest.mark.asyncio
    async def test_membership_removed_when_contact_deleted(self, test_db):
        key = "bb" * 32
        await _contact(key, "Bob")
        group = await ContactGroupRepository.create("Crew")
        await ContactGroupRepository.set_members(group.id, [key])
        await ContactRepository.delete(key)
        refreshed = await ContactGroupRepository.get_by_id(group.id)
        assert refreshed is not None
        assert refreshed.public_keys == []


class TestContactGroupRouter:
    @pytest.mark.asyncio
    async def test_crud_round_trip(self, test_db):
        key = "cc" * 32
        await _contact(key, "Cara")
        created = await create_contact_group(ContactGroupCreate(name="Friends"))
        listed = await list_contact_groups()
        assert [g.id for g in listed] == [created.id]

        renamed = await update_contact_group(created.id, ContactGroupUpdate(name="Buddies"))
        assert renamed.name == "Buddies"

        with_members = await replace_contact_group_members(
            created.id, ContactGroupMembersUpdate(public_keys=[key])
        )
        assert with_members.public_keys == [key]

        result = await delete_contact_group(created.id)
        assert result["status"] == "ok"
        assert await list_contact_groups() == []

    @pytest.mark.asyncio
    async def test_missing_group_is_404(self, test_db):
        with pytest.raises(HTTPException) as exc:
            await delete_contact_group(999)
        assert exc.value.status_code == 404
