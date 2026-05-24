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
        path = _generate_input_file(config, tmp_path)
        assert path.exists()
        assert path.name == "solve_input.txt"

    def test_contains_board(self, tmp_path):
        config = SolverConfig(board=["Ah", "7d", "2c"])
        path = _generate_input_file(config, tmp_path)
        content = path.read_text()
        assert "set_board Ah 7d 2c" in content

    def test_contains_pot_and_stack(self, tmp_path):
        config = SolverConfig()
        path = _generate_input_file(config, tmp_path)
        content = path.read_text()
        assert "set_pot" in content
        assert "set_effective_stack" in content

    def test_contains_bet_sizes(self, tmp_path):
        config = SolverConfig(bet_sizes=[0.33, 0.75])
        path = _generate_input_file(config, tmp_path)
        content = path.read_text()
        assert "0.33,0.75" in content

    def test_contains_iterations(self, tmp_path):
        config = SolverConfig(iterations=500)
        path = _generate_input_file(config, tmp_path)
        content = path.read_text()
        assert "set_max_iteration 500" in content

    def test_contains_accuracy(self, tmp_path):
        config = SolverConfig(accuracy_target=0.3)
        path = _generate_input_file(config, tmp_path)
        content = path.read_text()
        assert "set_accuracy 0.3" in content

    def test_contains_ranges(self, tmp_path):
        config = SolverConfig()
        path = _generate_input_file(config, tmp_path)
        content = path.read_text()
        assert "set_ip_range" in content
        assert "set_oop_range" in content

    def test_contains_solve_commands(self, tmp_path):
        config = SolverConfig()
        path = _generate_input_file(config, tmp_path)
        content = path.read_text()
        assert "build_tree" in content
        assert "start_solve" in content
        assert "dump_result" in content

    def test_rake_included_when_set(self, tmp_path):
        config = SolverConfig(rake=0.05)
        path = _generate_input_file(config, tmp_path)
        content = path.read_text()
        assert "set_rake 0.05" in content
        # Rake should come before build_tree
        rake_pos = content.index("set_rake")
        build_pos = content.index("build_tree")
        assert rake_pos < build_pos

    def test_no_rake_when_none(self, tmp_path):
        config = SolverConfig(rake=None)
        path = _generate_input_file(config, tmp_path)
        content = path.read_text()
        assert "set_rake" not in content


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
        assert "Ks Qd 3c" in content

    def test_invalid_config_returns_error(self):
        config = SolverConfig(board=["Ah"])  # invalid: only 1 card
        result = run_texassolver(config, dry_run=True)
        assert not result.success
        assert result.error is not None
        assert "Invalid config" in result.error

    def test_missing_solver_returns_error(self, tmp_path):
        config = SolverConfig(solver_path="/nonexistent/solver")
        result = run_texassolver(
            config, dry_run=False, work_dir=tmp_path,
        )
        assert not result.success
        assert "not found" in result.error

    def test_solve_result_fields(self, tmp_path):
        config = SolverConfig()
        result = run_texassolver(
            config, dry_run=True, work_dir=tmp_path,
        )
        assert result.work_dir == str(tmp_path)
        assert result.exit_code is None  # dry run
        assert result.stdout == ""
        assert result.stderr == ""
