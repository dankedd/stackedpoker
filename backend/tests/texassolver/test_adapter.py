"""Tests for TexasSolver adapter — pipeline integration."""

import json
import pytest

from app.solver_import.models import RawAction, RawSolverNode
from app.strategy_db.storage import StrategyStore
from app.texassolver.adapter import (
    _TEXASSOLVER_SOURCE,
    _TEXASSOLVER_VERSION,
    import_from_raw_nodes,
    import_texassolver_solve,
)
from app.texassolver.config import SolverConfig
from app.texassolver.runner import SolveResult


@pytest.fixture
def store():
    return StrategyStore(seed_on_init=False)


@pytest.fixture
def config():
    return SolverConfig(board=["Ah", "7d", "2c"])


@pytest.fixture
def valid_solve_output(tmp_path, config):
    """Create a valid solve output file and SolveResult."""
    data = {
        "ip_strategy": {
            "actions": ["CHECK", "BET 33", "BET 75"],
            "strategy": [0.30, 0.45, 0.25],
        },
        "oop_strategy": {
            "actions": ["CHECK", "BET 33"],
            "strategy": [0.55, 0.45],
        },
    }
    path = tmp_path / "output.json"
    path.write_text(json.dumps(data))

    solve_result = SolveResult(
        success=True,
        output_path=str(path),
        work_dir=str(tmp_path),
    )
    return solve_result


class TestImportTexasSolverSolve:
    def test_successful_import(self, config, valid_solve_output, store):
        result = import_texassolver_solve(
            config, valid_solve_output, store=store,
        )
        assert result.parsed == 2
        assert result.stored > 0
        assert len(result.errors) == 0

    def test_source_is_texassolver(self, config, valid_solve_output, store):
        import_texassolver_solve(config, valid_solve_output, store=store)

        for key in store.all_keys():
            node = store._nodes[key]
            assert node.source == _TEXASSOLVER_SOURCE
            assert node.version == _TEXASSOLVER_VERSION

    def test_dry_run_no_store(self, config, valid_solve_output, store):
        result = import_texassolver_solve(
            config, valid_solve_output, dry_run=True, store=store,
        )
        assert result.stored > 0  # counted but not written
        assert store.count() == 0

    def test_failed_solve_returns_error(self, config, store):
        solve_result = SolveResult(success=False, error="timed out")
        result = import_texassolver_solve(
            config, solve_result, store=store,
        )
        assert result.stored == 0
        assert len(result.errors) > 0

    def test_missing_output_file(self, config, store):
        solve_result = SolveResult(success=True, output_path=None)
        result = import_texassolver_solve(
            config, solve_result, store=store,
        )
        assert result.stored == 0
        assert len(result.errors) > 0

    def test_rationale_mentions_texassolver(self, config, valid_solve_output, store):
        import_texassolver_solve(config, valid_solve_output, store=store)

        for key in store.all_keys():
            node = store._nodes[key]
            assert "TexasSolver" in node.rationale


class TestImportFromRawNodes:
    def test_basic_import(self, store):
        nodes = [
            RawSolverNode(
                node_id="test_ip",
                board="Ah 7d 2c",
                position="BTN",
                pot_chips=6.5,
                stack_chips=96.75,
                street="flop",
                spot_type="SRP",
                actions=[
                    RawAction("check", 0.35),
                    RawAction("bet_33pct", 0.40),
                    RawAction("bet_75pct", 0.25),
                ],
            ),
        ]
        result = import_from_raw_nodes(nodes, store=store)
        assert result.stored == 1
        assert result.parsed == 1

    def test_source_tagged(self, store):
        nodes = [
            RawSolverNode(
                node_id="test_ip",
                board="Ah 7d 2c",
                position="BTN",
                pot_chips=6.5,
                stack_chips=96.75,
                street="flop",
                spot_type="SRP",
                actions=[
                    RawAction("check", 0.40),
                    RawAction("bet_33pct", 0.60),
                ],
            ),
        ]
        import_from_raw_nodes(nodes, store=store)

        for key in store.all_keys():
            assert store._nodes[key].source == "texassolver"

    def test_empty_nodes(self, store):
        result = import_from_raw_nodes([], store=store)
        assert result.parsed == 0
        assert result.stored == 0

    def test_dry_run(self, store):
        nodes = [
            RawSolverNode(
                node_id="test_ip",
                board="Ah 7d 2c",
                position="BTN",
                pot_chips=6.5,
                stack_chips=96.75,
                street="flop",
                spot_type="SRP",
                actions=[
                    RawAction("check", 0.50),
                    RawAction("bet_33pct", 0.50),
                ],
            ),
        ]
        result = import_from_raw_nodes(nodes, dry_run=True, store=store)
        assert result.stored > 0  # counted
        assert store.count() == 0  # not written
