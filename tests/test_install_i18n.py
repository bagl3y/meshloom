"""FR/EN message keys in scripts/setup/install.sh must stay in sync."""

from __future__ import annotations

import re
from pathlib import Path

INSTALL_SH = Path(__file__).resolve().parents[1] / "scripts" / "setup" / "install.sh"


def _keys(lang: str) -> set[str]:
    text = INSTALL_SH.read_text(encoding="utf-8")
    return set(re.findall(rf"{lang}:([A-Za-z0-9_]+)\)", text))


def test_install_sh_en_fr_keys_match() -> None:
    en = _keys("en")
    fr = _keys("fr")
    assert en, "expected English message keys in install.sh"
    assert en == fr, f"i18n key mismatch en-fr={en - fr!r} fr-en={fr - en!r}"


def test_install_sh_is_real_utf8() -> None:
    text = INSTALL_SH.read_text(encoding="utf-8")
    assert "Français" in text
    assert "recommandé" in text
    assert "FranÃ§ais" not in text
    assert "recommandÃ©" not in text


def test_release_asset_tempfile_uses_package_suffix() -> None:
    """apt rejects local files that do not end in .deb / .ddeb / .changes."""
    text = INSTALL_SH.read_text(encoding="utf-8")
    assert 'mktemp "/tmp/meshloom.XXXXXX${pkg_ext}"' in text
    assert 'pkg_ext=".deb"' in text
    assert 'pkg_ext=".rpm"' in text
