from app.region_scope import normalize_region_scope


def test_normalize_region_scope_preserves_regions():
    assert normalize_region_scope("Esperance") == "#Esperance"
    assert normalize_region_scope("#Esperance") == "#Esperance"


def test_normalize_region_scope_unscoped_sentinels():
    assert normalize_region_scope(None) == ""
    assert normalize_region_scope("") == ""
    assert normalize_region_scope("   ") == ""
    assert normalize_region_scope("0") == ""
    assert normalize_region_scope("*") == ""
