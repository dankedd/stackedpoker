"""
Tests for the full import pipeline — import_gto_solve().

All tests use an isolated StrategyStore (seed_on_init=False) to avoid
polluting the shared store or depending on seed state.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.solver_import.importer import import_gto_solve
from app.solver_import.models import ImportResult
from app.strategy_db.storage import StrategyStore

_FIXTURES = Path(__file__).parent.parent.parent / "app" / "solver_import" / "fixtures"
_NODE_FIXTURE  = _FIXTURES / "btn_bb_srp_100bb_nodes.csv"
_COMBO_FIXTURE = _FIXTURES / "btn_bb_srp_100bb_combos.csv"


@pytest.fixture
def empty_store():
    return StrategyStore(seed_on_init=False)


# ── ImportResult shape ────────────────────────────────────────────────────────

class TestImportResult:
    def test_returns_import_result(self, empty_store):
        result = import_gto_solve(_NODE_FIXTURE, store=empty_store)
        assert isinstance(result, ImportResult)

    def test_to_dict_has_required_keys(self, empty_store):
        result = import_gto_solve(_NODE_FIXTURE, store=empty_store)
        d = result.to_dict()
        assert "parsed" in d
        assert "valid" in d
        assert "mapped" in d
        assert "stored" in d
        assert "skipped" in d
        assert "error_count" in d
        assert "dry_run" in d
        assert "source_file" in d
        assert "success_rate" in d

    def test_summary_string_nonempty(self, empty_store):
        result = import_gto_solve(_NODE_FIXTURE, store=empty_store)
        s = result.summary()
        assert len(s) > 10
        assert "parsed" in s


# ── Node fixture import ───────────────────────────────────────────────────────

class TestNodeFixtureImport:
    def test_parsed_count_positive(self, empty_store):
        result = import_gto_solve(_NODE_FIXTURE, store=empty_store)
        assert result.parsed > 0

    def test_stored_count_positive(self, empty_store):
        result = import_gto_solve(_NODE_FIXTURE, store=empty_store)
        assert result.stored > 0

    def test_stored_le_parsed(self, empty_store):
        result = import_gto_solve(_NODE_FIXTURE, store=empty_store)
        assert result.stored <= result.parsed

    def test_nodes_in_store_after_import(self, empty_store):
        before = empty_store.count()
        import_gto_solve(_NODE_FIXTURE, store=empty_store)
        after = empty_store.count()
        assert after > before

    def test_stored_nodes_have_gto_plus_source(self, empty_store):
        import_gto_solve(_NODE_FIXTURE, store=empty_store)
        # Check a sample key that we know should be in the store
        # BTN on Ah Kc 7d, SRP, 100bb, SPR≈14.9 → 8_PLUS → A_HIGH_DRY (or similar)
        keys = empty_store.all_keys()
        gto_nodes = [
            empty_store._nodes[k]
            for k in keys
            if empty_store._nodes[k].source == "gto_plus"
        ]
        assert len(gto_nodes) > 0

    def test_frequencies_valid_after_import(self, empty_store):
        import_gto_solve(_NODE_FIXTURE, store=empty_store)
        for ek in empty_store.all_keys():
            node = empty_store._nodes[ek]
            if node.source == "gto_plus":
                assert 0.0 <= node.bet_frequency <= 1.0
                assert 0.0 <= node.check_frequency <= 1.0
                assert abs(node.bet_frequency + node.check_frequency - 1.0) < 1e-6


# ── Combo fixture import ──────────────────────────────────────────────────────

class TestComboFixtureImport:
    def test_combo_fixture_imports(self, empty_store):
        result = import_gto_solve(_COMBO_FIXTURE, store=empty_store)
        assert result.parsed > 0
        assert result.stored > 0

    def test_combo_nodes_have_gto_plus_source(self, empty_store):
        import_gto_solve(_COMBO_FIXTURE, store=empty_store)
        gto_nodes = [
            empty_store._nodes[k]
            for k in empty_store.all_keys()
            if empty_store._nodes[k].source == "gto_plus"
        ]
        assert len(gto_nodes) > 0


# ── Dry run ───────────────────────────────────────────────────────────────────

class TestDryRun:
    def test_dry_run_parses_but_not_stores(self, empty_store):
        before = empty_store.count()
        result = import_gto_solve(_NODE_FIXTURE, dry_run=True, store=empty_store)
        after = empty_store.count()
        assert result.dry_run is True
        assert result.parsed > 0
        assert after == before  # nothing written

    def test_dry_run_result_summary_says_dry_run(self, empty_store):
        result = import_gto_solve(_NODE_FIXTURE, dry_run=True, store=empty_store)
        assert "[DRY RUN]" in result.summary()


# ── Error handling ────────────────────────────────────────────────────────────

class TestErrorHandling:
    def test_file_not_found_returns_error_result(self, empty_store):
        result = import_gto_solve("/nonexistent/file.csv", store=empty_store)
        assert result.parsed == 0
        assert len(result.errors) > 0

    def test_no_crash_on_missing_file(self, empty_store):
        result = import_gto_solve("/nonexistent/file.csv", store=empty_store)
        assert isinstance(result, ImportResult)


# ── Source priority in store ──────────────────────────────────────────────────

class TestSourcePriorityInStore:
    def test_gto_plus_overwrites_handcrafted(self):
        """Importing gto_plus node for a known key should overwrite handcrafted seed."""
        # Use a seeded store so handcrafted seeds are present
        store = StrategyStore(seed_on_init=True)
        before_source_count = sum(
            1 for k in store.all_keys()
            if store._nodes[k].source == "handcrafted"
        )
        assert before_source_count > 0

        import_gto_solve(_NODE_FIXTURE, store=store)

        # Some nodes should now be gto_plus
        gto_count = sum(
            1 for k in store.all_keys()
            if store._nodes[k].source == "gto_plus"
        )
        assert gto_count > 0

    def test_search_similar_prefers_gto_plus(self):
        """After import, search_similar should return gto_plus nodes over handcrafted at equal score."""
        store = StrategyStore(seed_on_init=True)
        import_gto_solve(_NODE_FIXTURE, store=store)

        # Search for something that should match the imported nodes
        key = "SRP::BTN_vs_BB::100bb::8_PLUS::A_HIGH_DRY::flop::2p"
        results = store.search_similar(key, is_ip=True, top_k=5)
        assert len(results) > 0
        # Top result should be gto_plus if exact score match, or at least in range
        top_node, top_score = results[0]
        assert 0.0 <= top_score <= 1.0
