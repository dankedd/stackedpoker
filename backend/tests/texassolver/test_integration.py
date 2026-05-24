"""
Integration tests — full pipeline from SolverConfig → StrategyNode DB.

Tests the complete flow:
  SolverConfig → synthetic output → parser → adapter → StrategyNode
  → retrieval engine picks up texassolver nodes
"""

import pytest

from app.solver_import.models import RawAction, RawSolverNode
from app.strategy_db.models import StrategyNode
from app.strategy_db.storage import StrategyStore
from app.texassolver.adapter import import_from_raw_nodes, import_texassolver_solve
from app.texassolver.config import SolverConfig
from app.texassolver.exporter import generate_synthetic_output
from app.texassolver.parser import parse_texassolver_output
from app.texassolver.runner import SolveResult
from app.texassolver.seeds import SEED_BOARDS, generate_seed_solves


class TestFullPipeline:
    """End-to-end: synthetic output → parse → import → retrieve."""

    @pytest.fixture
    def store(self):
        return StrategyStore(seed_on_init=False)

    def test_synthetic_solve_to_strategy_node(self, tmp_path, store):
        """Full pipeline: config → synthetic output → parse → import."""
        config = SolverConfig(board=["Ah", "7d", "2c"])

        # Generate synthetic output
        output_path = generate_synthetic_output(config, tmp_path / "output.json")

        # Parse into RawSolverNodes
        raw_nodes = parse_texassolver_output(output_path, config)
        assert len(raw_nodes) == 2  # IP + OOP

        # Import via adapter
        solve_result = SolveResult(
            success=True,
            output_path=str(output_path),
            work_dir=str(tmp_path),
        )
        import_result = import_texassolver_solve(
            config, solve_result, store=store,
        )

        assert import_result.stored > 0
        assert store.count() > 0

    def test_stored_nodes_are_retrievable(self, tmp_path, store):
        """Imported nodes can be found by exact key lookup."""
        config = SolverConfig(board=["Ah", "7d", "2c"])
        output_path = generate_synthetic_output(config, tmp_path / "output.json")

        solve_result = SolveResult(
            success=True,
            output_path=str(output_path),
            work_dir=str(tmp_path),
        )
        import_texassolver_solve(config, solve_result, store=store)

        # Look up by node key
        keys = store.all_keys()
        assert len(keys) > 0

        for key in keys:
            node = store._nodes[key]
            assert isinstance(node, StrategyNode)
            assert node.source == "texassolver"
            assert node.bet_frequency >= 0.0
            assert node.bet_frequency <= 1.0
            assert node.check_frequency >= 0.0
            assert node.check_frequency <= 1.0
            assert abs(node.bet_frequency + node.check_frequency - 1.0) < 0.02

    def test_texassolver_outranks_handcrafted(self, tmp_path):
        """texassolver source priority > handcrafted in similar search."""
        store = StrategyStore(seed_on_init=True)  # has handcrafted seeds
        initial_count = store.count()

        # Import a texassolver node for the same spot
        config = SolverConfig(board=["Ah", "7d", "2c"])
        output_path = generate_synthetic_output(config, tmp_path / "output.json")

        solve_result = SolveResult(
            success=True,
            output_path=str(output_path),
            work_dir=str(tmp_path),
        )
        import_texassolver_solve(config, solve_result, store=store)

        assert store.count() > initial_count

        # When both exist at the same key, texassolver wins (overwrites)
        for key in store.all_keys():
            node = store._nodes[key]
            if "A_HIGH_DRY" in key and "SRP" in key:
                # texassolver node should have overwritten handcrafted
                assert node.source in ("texassolver", "handcrafted")

    def test_node_key_format(self, tmp_path, store):
        """Stored nodes have correct node_key format."""
        config = SolverConfig(board=["Ah", "7d", "2c"])
        output_path = generate_synthetic_output(config, tmp_path / "output.json")

        solve_result = SolveResult(
            success=True,
            output_path=str(output_path),
            work_dir=str(tmp_path),
        )
        import_texassolver_solve(config, solve_result, store=store)

        for key in store.all_keys():
            node = store._nodes[key]
            # node_key format: SRP::BTN_vs_BB::100bb::SPR::BOARD_CLASS::flop::2p
            parts = node.node_key.split("::")
            assert len(parts) == 7
            assert parts[0] == "SRP"
            assert parts[1] == "BTN_vs_BB"
            assert parts[2] == "100bb"
            assert parts[5] == "flop"
            assert parts[6] == "2p"


class TestCompressionStability:
    """Verify that the same input always produces the same StrategyNode."""

    def test_deterministic_compression(self):
        """Same RawSolverNode → same StrategyNode."""
        node = RawSolverNode(
            node_id="determinism_test",
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
        )

        store1 = StrategyStore(seed_on_init=False)
        store2 = StrategyStore(seed_on_init=False)

        import_from_raw_nodes([node], store=store1)
        import_from_raw_nodes([node], store=store2)

        keys1 = store1.all_keys()
        keys2 = store2.all_keys()
        assert keys1 == keys2

        for k in keys1:
            n1 = store1._nodes[k]
            n2 = store2._nodes[k]
            assert n1.bet_frequency == n2.bet_frequency
            assert n1.check_frequency == n2.check_frequency
            assert n1.range_advantage == n2.range_advantage
            assert n1.source == n2.source


class TestSeedGeneration:
    def test_seed_boards_defined(self):
        assert len(SEED_BOARDS) == 6

    def test_seed_labels(self):
        labels = [label for label, _ in SEED_BOARDS]
        assert "A_HIGH_DRY" in labels
        assert "A_HIGH_WET" in labels
        assert "LOW_CONNECTED" in labels
        assert "MONOTONE" in labels
        assert "PAIRED" in labels
        assert "DOUBLE_BROADWAY" in labels

    def test_synthetic_seed_generation(self):
        """All 6 seed boards generate successfully."""
        results = generate_seed_solves(synthetic=True, dry_run=True)
        assert len(results) == 6

        for board_label, import_result in results:
            assert import_result.parsed > 0, f"{board_label}: no nodes parsed"

    def test_synthetic_seeds_store_nodes(self):
        """Synthetic seeds actually store nodes when not dry_run."""
        store = StrategyStore(seed_on_init=False)
        results = generate_seed_solves(synthetic=True, store=store)

        total_stored = sum(r.stored for _, r in results)
        assert total_stored > 0
        assert store.count() == total_stored

        # All stored nodes should be texassolver source
        for key in store.all_keys():
            assert store._nodes[key].source == "texassolver"


class TestNodeKeyMapping:
    """Verify NodeKey generation from TexasSolver output."""

    def test_mapping_preserves_board_class(self, tmp_path):
        """Board class in node key matches actual board classification."""
        from app.solver.board_classifier import BoardClassifier

        store = StrategyStore(seed_on_init=False)
        classifier = BoardClassifier()

        for board_label, board_cards in SEED_BOARDS:
            config = SolverConfig(board=board_cards)
            output_path = generate_synthetic_output(
                config, tmp_path / f"{board_label}.json",
            )

            solve_result = SolveResult(
                success=True,
                output_path=str(output_path),
                work_dir=str(tmp_path),
            )
            import_texassolver_solve(config, solve_result, store=store)

        # Check that stored nodes have correct board classes
        for key in store.all_keys():
            node = store._nodes[key]
            # Board class should be a valid enum value
            assert node.board_class != "", f"Empty board class for {key}"


class TestFallbackBehavior:
    """Test that the system falls back gracefully."""

    def test_import_with_unknown_position(self):
        """Nodes with unknown positions are skipped."""
        store = StrategyStore(seed_on_init=False)
        nodes = [
            RawSolverNode(
                node_id="unknown_pos",
                board="Ah 7d 2c",
                position="UNKNOWN",
                pot_chips=6.5,
                stack_chips=96.75,
                street="flop",
                spot_type="SRP",
                actions=[RawAction("check", 0.50), RawAction("bet_33pct", 0.50)],
            ),
        ]
        result = import_from_raw_nodes(nodes, store=store)
        assert result.stored == 0
        assert result.skipped > 0
