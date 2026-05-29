"""Tests for TexasSolver runner."""

import pytest
from pathlib import Path

from app.texassolver.config import SolverConfig
from app.texassolver.runner import (
    SolveResult,
    _config_hash,
    _generate_input_file,
    run_texassolver,
)


class TestConfigHash:
    def test_deterministic(self):
        config = SolverConfig()
        h1 = _config_hash(config)
        h2 = _config_hash(config)
        assert h1 == h2

    def test_different_boards_different_hash(self):
        c1 = SolverConfig(board=["Ah", "7d", "2c"])
        c2 = SolverConfig(board=["Kh", "7d", "2c"])
        assert _config_hash(c1) != _config_hash(c2)

    def test_hash_length(self):
        config = SolverConfig()
        assert len(_config_hash(config)) == 12


class TestGenerateInputFile:
    def test_creates_file(self, tmp_path):
        config = SolverConfig()
        output_path = str(tmp_path / "solve_output.json")
        path = _generate_input_file(config, tmp_path, output_path)
        assert path.exists()
        assert path.name == "solve_input.txt"

    def test_contains_board(self, tmp_path):
        config = SolverConfig(board=["Ah", "7d", "2c"])
        output_path = str(tmp_path / "solve_output.json")
        path = _generate_input_file(config, tmp_path, output_path)
        content = path.read_text()
        # v0.2.0 uses comma-separated board
        assert "set_board Ah,7d,2c" in content

    def test_contains_pot_and_stack(self, tmp_path):
        config = SolverConfig()
        output_path = str(tmp_path / "solve_output.json")
        path = _generate_input_file(config, tmp_path, output_path)
        content = path.read_text()
        assert "set_pot" in content
        assert "set_effective_stack" in content

    def test_contains_bet_sizes(self, tmp_path):
        """set_bet_sizes commands must be present to avoid degenerate check-only solutions."""
        config = SolverConfig(bet_sizes=[0.33, 0.75], raise_sizes=[0.6])
        output_path = str(tmp_path / "solve_output.json")
        path = _generate_input_file(config, tmp_path, output_path)
        content = path.read_text()
        assert "set_bet_sizes oop,flop,bet,33,75" in content
        assert "set_bet_sizes ip,flop,bet,33,75" in content
        assert "set_bet_sizes oop,flop,raise,60" in content
        assert "set_bet_sizes ip,flop,raise,60" in content

    def test_default_bet_sizes_present(self, tmp_path):
        """Even with default config, bet sizes must be emitted."""
        config = SolverConfig()
        output_path = str(tmp_path / "solve_output.json")
        path = _generate_input_file(config, tmp_path, output_path)
        content = path.read_text()
        assert "set_bet_sizes" in content
        # Default bet_sizes are [0.33, 0.5, 0.75, 1.0]
        assert "set_bet_sizes oop,flop,bet,33,50,75,100" in content
        assert "set_bet_sizes ip,flop,bet,33,50,75,100" in content

    def test_contains_iterations(self, tmp_path):
        config = SolverConfig(iterations=500)
        output_path = str(tmp_path / "solve_output.json")
        path = _generate_input_file(config, tmp_path, output_path)
        content = path.read_text()
        assert "set_max_iteration 500" in content

    def test_contains_accuracy(self, tmp_path):
        config = SolverConfig(accuracy_target=0.3)
        output_path = str(tmp_path / "solve_output.json")
        path = _generate_input_file(config, tmp_path, output_path)
        content = path.read_text()
        assert "set_accuracy 0.3" in content

    def test_contains_ranges(self, tmp_path):
        config = SolverConfig()
        output_path = str(tmp_path / "solve_output.json")
        path = _generate_input_file(config, tmp_path, output_path)
        content = path.read_text()
        # v0.2.0 uses set_range_ip / set_range_oop
        assert "set_range_ip" in content
        assert "set_range_oop" in content

    def test_contains_solve_commands(self, tmp_path):
        config = SolverConfig()
        output_path = str(tmp_path / "solve_output.json")
        path = _generate_input_file(config, tmp_path, output_path)
        content = path.read_text()
        assert "build_tree" in content
        assert "start_solve" in content
        assert "dump_result" in content

    def test_dump_result_uses_output_path(self, tmp_path):
        config = SolverConfig()
        output_path = "/work/solve_output.json"
        path = _generate_input_file(config, tmp_path, output_path)
        content = path.read_text()
        assert f"dump_result {output_path}" in content

    def test_rake_included_when_set(self, tmp_path):
        config = SolverConfig(rake=0.05)
        output_path = str(tmp_path / "solve_output.json")
        path = _generate_input_file(config, tmp_path, output_path)
        content = path.read_text()
        assert "set_rake 0.05" in content
        # Rake should come before build_tree
        rake_pos = content.index("set_rake")
        build_pos = content.index("build_tree")
        assert rake_pos < build_pos

    def test_no_rake_when_none(self, tmp_path):
        config = SolverConfig(rake=None)
        output_path = str(tmp_path / "solve_output.json")
        path = _generate_input_file(config, tmp_path, output_path)
        content = path.read_text()
        assert "set_rake" not in content

    def test_unix_line_endings(self, tmp_path):
        """Input file must use Unix line endings for Docker/Linux execution."""
        config = SolverConfig()
        output_path = str(tmp_path / "solve_output.json")
        path = _generate_input_file(config, tmp_path, output_path)
        raw = path.read_bytes()
        assert b"\r\n" not in raw
        assert b"\n" in raw

    def test_no_check_only_default(self, tmp_path):
        """Regression: without set_bet_sizes, solver defaults to check/all-in
        producing degenerate ~100% check solutions. This must never happen."""
        config = SolverConfig()
        output_path = str(tmp_path / "solve_output.json")
        path = _generate_input_file(config, tmp_path, output_path)
        content = path.read_text()
        # Count set_bet_sizes lines — must have at least 4 (oop bet, oop raise, ip bet, ip raise)
        bet_lines = [l for l in content.split("\n") if l.startswith("set_bet_sizes")]
        assert len(bet_lines) >= 4, f"Expected >=4 set_bet_sizes lines, got {len(bet_lines)}: {bet_lines}"


class TestRunTexasSolver:
    def test_dry_run_succeeds(self, tmp_path):
        config = SolverConfig()
        result = run_texassolver(
            config, dry_run=True, work_dir=tmp_path,
        )
        assert result.success
        assert result.dry_run
        assert result.input_path is not None
        assert Path(result.input_path).exists()

    def test_dry_run_generates_input(self, tmp_path):
        config = SolverConfig(board=["Ks", "Qd", "3c"])
        result = run_texassolver(
            config, dry_run=True, work_dir=tmp_path,
        )
        content = Path(result.input_path).read_text()
        # v0.2.0 uses comma-separated board
        assert "Ks,Qd,3c" in content

    def test_invalid_config_returns_error(self):
        config = SolverConfig(board=["Ah"])  # invalid: only 1 card
        result = run_texassolver(config, dry_run=True)
        assert not result.success
        assert result.error is not None
        assert "Invalid config" in result.error

    def test_missing_solver_returns_error(self, tmp_path, monkeypatch):
        """When both native binary and Docker are unavailable, returns error."""
        config = SolverConfig(solver_path="/nonexistent/solver")
        # Disable Docker fallback for this test
        monkeypatch.setattr(
            "app.texassolver.runner._docker_available", lambda: False,
        )
        result = run_texassolver(
            config, dry_run=False, work_dir=tmp_path,
        )
        assert not result.success
        assert "not found" in result.error.lower()

    def test_solve_result_fields(self, tmp_path):
        config = SolverConfig()
        result = run_texassolver(
            config, dry_run=True, work_dir=tmp_path,
        )
        assert result.work_dir == str(tmp_path)
        assert result.exit_code is None  # dry run
        assert result.stdout == ""
        assert result.stderr == ""
