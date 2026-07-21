"""
Tests for position parsing safety and validation.

Covers:
  - Missing button seat detection (no silent fallback to seat 1)
  - Missing hero detection (no silent fallback to BTN)
  - SB/BB posting validation against assigned positions
  - Empty button seat handling (snap to nearest occupied)
  - Winamax seat formats (chip, euro, tournament)
  - 2-max through 9-max tables
  - ParseDiagnostics position fields
"""

from app.parsers.base import derive_positions
from app.parsers.ggpoker import GGPokerParser
from app.parsers.pokerstars import PokerStarsParser
from app.parsers.winamax import WinamaxParser
from app.models.schemas import PlayerInfo


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_hand(
    *,
    site: str = "PokerStars",
    hero: str = "Hero",
    button_seat: int | None = 1,
    seats: list[tuple[int, str, float]] | None = None,
    blinds: dict[str, str] | None = None,
    hero_cards: str = "Ah Kd",
    table_max: int = 6,
) -> str:
    """Build a minimal valid hand history for testing position logic."""
    if seats is None:
        seats = [
            (1, "Player1", 100),
            (2, "Player2", 100),
            (3, "Hero", 100),
            (4, "Player4", 100),
            (5, "Player5", 100),
            (6, "Player6", 100),
        ]
    if blinds is None:
        # Default: first two players after button post blinds
        names = [name for _, name, _ in seats]
        blinds = {"sb": names[1] if len(names) > 1 else names[0],
                   "bb": names[2] if len(names) > 2 else names[0]}

    lines = []

    if site == "PokerStars":
        lines.append(
            f"PokerStars Hand #999999: Hold'em No Limit ($0.50/$1.00 USD) - 2024/01/01"
        )
        lines.append(f"Table 'Test' {table_max}-max Seat #{button_seat or 1} is the Button")
    elif site == "GGPoker":
        lines.append(
            f"Poker Hand #RC999999: Hold'em No Limit ($0.50/$1.00) - 2024/01/01"
        )
        lines.append(f"Table 'Test' {table_max}-max")
        if button_seat is not None:
            lines.append(f"Seat #{button_seat} is the button")

    for seat_num, name, stack in seats:
        lines.append(f"Seat {seat_num}: {name} (${stack:.2f} in chips)")

    lines.append(f"{blinds['sb']}: posts small blind $0.50")
    lines.append(f"{blinds['bb']}: posts big blind $1.00")
    lines.append("*** HOLE CARDS ***")
    lines.append(f"Dealt to {hero} [{hero_cards}]")

    # At least one action so diagnostics don't error
    hero_name_in_seats = any(name == hero for _, name, _ in seats)
    if hero_name_in_seats:
        lines.append(f"{hero}: raises $2.00 to $3.00")
    else:
        first_player = seats[0][1] if seats else "Player1"
        lines.append(f"{first_player}: folds")

    lines.append("*** SUMMARY ***")
    lines.append("Total pot $3.50")

    return "\n".join(lines)


# ── Issue 1: Button seat fallback ────────────────────────────────────────────

class TestButtonSeatFallback:
    """Button seat not found must produce a warning, not silently use seat 1."""

    def test_missing_button_produces_warning(self):
        """When button line is absent, diagnostics must flag it."""
        # Build a hand without the button line
        text = _make_hand(site="PokerStars", button_seat=1)
        # Remove the button line
        text = "\n".join(
            line for line in text.splitlines()
            if "is the Button" not in line and "is the button" not in line
        )
        # Re-add table line without button info
        text = text.replace("Table 'Test' 6-max", "Table 'Test' 6-max")
        parser = PokerStarsParser()
        result = parser.parse(text)
        diag = result.parse_diagnostics
        assert diag is not None
        assert diag.button_found is False
        assert any("Button seat not found" in w for w in diag.errors)

    def test_button_found_no_warning(self):
        """Normal hand with button should have clean diagnostics."""
        text = _make_hand(site="PokerStars", button_seat=3)
        parser = PokerStarsParser()
        result = parser.parse(text)
        diag = result.parse_diagnostics
        assert diag is not None
        assert diag.button_found is True
        assert not any("Button" in w for w in diag.warnings)

    def test_ggpoker_missing_button(self):
        text = _make_hand(site="GGPoker", button_seat=None)
        parser = GGPokerParser()
        result = parser.parse(text)
        diag = result.parse_diagnostics
        assert diag is not None
        assert diag.button_found is False


# ── Issue 2: Hero position fallback ──────────────────────────────────────────

class TestHeroPositionFallback:
    """Hero not found in seat map must NOT silently become BTN."""

    def test_missing_hero_produces_unknown(self):
        """When hero name doesn't match any player, position must be UNKNOWN."""
        text = _make_hand(
            site="PokerStars",
            hero="NonexistentPlayer",
            button_seat=1,
        )
        parser = PokerStarsParser()
        result = parser.parse(text)
        assert result.hero_position == "UNKNOWN"
        diag = result.parse_diagnostics
        assert diag is not None
        assert diag.hero_found is False
        assert any("Hero" in e and "not found" in e for e in diag.errors)

    def test_hero_found_gets_real_position(self):
        """When hero exists, they get their actual assigned position."""
        text = _make_hand(
            site="PokerStars",
            hero="Hero",
            button_seat=1,
            seats=[
                (1, "Player1", 100),
                (2, "Player2", 100),
                (3, "Hero", 100),
            ],
        )
        parser = PokerStarsParser()
        result = parser.parse(text)
        assert result.hero_position != "UNKNOWN"
        assert result.hero_position != "BTN"  # Hero is seat 3 with btn at 1
        diag = result.parse_diagnostics
        assert diag.hero_found is True


# ── Issue 3: Blind posting validation ────────────────────────────────────────

class TestBlindPostingValidation:
    """Assigned SB/BB must match actual blind posters."""

    def test_correct_blinds_pass_validation(self):
        """SB and BB positions match blind postings → validation passes."""
        text = _make_hand(
            site="PokerStars",
            button_seat=1,
            seats=[
                (1, "Player1", 100),
                (2, "Player2", 100),
                (3, "Hero", 100),
            ],
            blinds={"sb": "Player2", "bb": "Hero"},
        )
        parser = PokerStarsParser()
        result = parser.parse(text)
        diag = result.parse_diagnostics
        assert diag is not None
        assert diag.position_validation_passed is True

    def test_mismatched_sb_detected(self):
        """When blind poster doesn't match assigned SB, a warning is emitted."""
        text = _make_hand(
            site="PokerStars",
            button_seat=1,
            seats=[
                (1, "Player1", 100),
                (2, "Player2", 100),
                (3, "Hero", 100),
            ],
            # Force mismatch: Hero posts SB but should be BB
            blinds={"sb": "Hero", "bb": "Player1"},
        )
        parser = PokerStarsParser()
        result = parser.parse(text)
        diag = result.parse_diagnostics
        assert diag is not None
        assert diag.position_validation_passed is False
        assert any("mismatch" in w.lower() for w in diag.warnings)


# ── Issue 4: Button seat occupancy ───────────────────────────────────────────

class TestButtonOccupancy:
    """Empty button seat must produce a warning and snap to nearest."""

    def test_empty_button_seat_snaps(self):
        """Button at seat 4 (empty) should snap to nearest occupied."""
        text = _make_hand(
            site="PokerStars",
            button_seat=4,
            seats=[
                (1, "Player1", 100),
                (2, "Player2", 100),
                (3, "Hero", 100),
                # Seat 4 intentionally missing
                (5, "Player5", 100),
                (6, "Player6", 100),
            ],
            blinds={"sb": "Player5", "bb": "Player6"},
        )
        parser = PokerStarsParser()
        result = parser.parse(text)
        diag = result.parse_diagnostics
        assert diag is not None
        assert diag.button_seat_occupied is False
        assert any("not occupied" in w for w in diag.warnings)

    def test_occupied_button_no_warning(self):
        """Button at an occupied seat should be clean."""
        text = _make_hand(site="PokerStars", button_seat=3)
        parser = PokerStarsParser()
        result = parser.parse(text)
        diag = result.parse_diagnostics
        assert diag is not None
        assert diag.button_seat_occupied is True


# ── Issue 5: Winamax seat parsing ────────────────────────────────────────────

class TestWinamaxParsing:
    """Winamax parser must handle various seat formats."""

    def _winamax_hand(
        self,
        *,
        button_seat: int = 1,
        seats: list[tuple[int, str, float]] | None = None,
        include_button_line: bool = True,
    ) -> str:
        if seats is None:
            seats = [
                (1, "Player1", 50.0),
                (2, "Player2", 50.0),
                (3, "Hero", 50.0),
            ]
        lines = [
            "Winamax Poker - CashGame - HandId: #12345678 - Holdem no limit (0.25/0.50)",
        ]
        if include_button_line:
            lines.append(f"Table 'Lyon' 6-max (real money) Seat {button_seat} is the button")
        else:
            lines.append("Table 'Lyon' 6-max (real money)")
        for s, name, stack in seats:
            lines.append(f"Seat {s}: {name} (${stack:.2f} in chips)")
        lines.append(f"{seats[1][1]}: posts small blind $0.25")
        lines.append(f"{seats[2][1] if len(seats) > 2 else seats[0][1]}: posts big blind $0.50")
        lines.append("*** HOLE CARDS ***")
        lines.append("Dealt to Hero [Ah Kd]")
        lines.append("Hero: raises $1.00 to $1.50")
        lines.append("*** SUMMARY ***")
        lines.append("Total pot $3.25")
        return "\n".join(lines)

    def test_winamax_button_found(self):
        text = self._winamax_hand(button_seat=1)
        parser = WinamaxParser()
        result = parser.parse(text)
        diag = result.parse_diagnostics
        assert diag is not None
        assert diag.button_found is True

    def test_winamax_missing_button(self):
        text = self._winamax_hand(include_button_line=False)
        parser = WinamaxParser()
        result = parser.parse(text)
        diag = result.parse_diagnostics
        assert diag is not None
        assert diag.button_found is False

    def test_winamax_euro_stacks_parsed(self):
        text = self._winamax_hand()
        parser = WinamaxParser()
        result = parser.parse(text)
        assert len(result.players) == 3
        for p in result.players:
            assert p.stack_bb > 0

    def test_winamax_positions_correct(self):
        text = self._winamax_hand(button_seat=1)
        parser = WinamaxParser()
        result = parser.parse(text)
        positions = {p.name: p.position for p in result.players}
        assert positions["Player1"] == "BTN"
        assert positions["Player2"] == "SB"
        assert positions["Hero"] == "BB"


# ── Issue 6: ParseDiagnostics position fields ────────────────────────────────

class TestParseDiagnosticsFields:
    """ParseDiagnostics must expose all position validation fields."""

    def test_all_fields_present(self):
        text = _make_hand(site="PokerStars", button_seat=1)
        parser = PokerStarsParser()
        result = parser.parse(text)
        diag = result.parse_diagnostics
        assert diag is not None

        # All new fields must be present
        assert hasattr(diag, "button_found")
        assert hasattr(diag, "button_seat_occupied")
        assert hasattr(diag, "hero_found")
        assert hasattr(diag, "position_validation_passed")

    def test_clean_hand_all_true(self):
        """A well-formed hand should have all position flags as True."""
        text = _make_hand(
            site="PokerStars",
            button_seat=1,
            hero="Hero",
            seats=[
                (1, "Player1", 100),
                (2, "Player2", 100),
                (3, "Hero", 100),
            ],
            blinds={"sb": "Player2", "bb": "Hero"},
        )
        parser = PokerStarsParser()
        result = parser.parse(text)
        diag = result.parse_diagnostics
        assert diag.button_found is True
        assert diag.button_seat_occupied is True
        assert diag.hero_found is True
        assert diag.position_validation_passed is True

    def test_diagnostics_json_serializable(self):
        """Position diagnostics must be JSON-serializable for API responses."""
        text = _make_hand(site="PokerStars", button_seat=1)
        parser = PokerStarsParser()
        result = parser.parse(text)
        import json
        d = result.parse_diagnostics.model_dump()
        raw = json.dumps(d)
        assert "button_found" in raw
        assert "hero_found" in raw
        assert "position_validation_passed" in raw


# ── Issue 7: Table sizes 2-max to 9-max ─────────────────────────────────────

class TestTableSizes:
    """Position assignment must work correctly for all table sizes."""

    def test_heads_up(self):
        """2-max: BTN posts SB."""
        result = derive_positions([1, 2], button_seat=1, table_max_seats=2)
        assert result[1] == "BTN"
        assert result[2] == "BB"

    def test_3max(self):
        result = derive_positions([1, 2, 3], button_seat=1, table_max_seats=3)
        assert result[1] == "BTN"
        assert result[2] == "SB"
        assert result[3] == "BB"

    def test_6max(self):
        result = derive_positions([1, 2, 3, 4, 5, 6], button_seat=1, table_max_seats=6)
        assert result[1] == "BTN"
        assert result[2] == "SB"
        assert result[3] == "BB"

    def test_9max(self):
        result = derive_positions(
            [1, 2, 3, 4, 5, 6, 7, 8, 9], button_seat=1, table_max_seats=9,
        )
        assert result[1] == "BTN"
        assert result[2] == "SB"
        assert result[3] == "BB"
        assert len(result) == 9

    def test_9max_short_handed(self):
        """9-max table with 4 players seated."""
        result = derive_positions([2, 5, 7, 9], button_seat=5, table_max_seats=9)
        assert result[5] == "BTN"
        assert result[7] == "SB"
        assert result[9] == "BB"
        assert result[2] == "UTG"


# ── Base parser helpers (unit tests) ─────────────────────────────────────────

class TestResolveButtonSeat:
    """_resolve_button_seat must handle None and record warnings."""

    def _parser(self):
        return GGPokerParser()

    def test_valid_button_returns_found(self):
        p = self._parser()
        seat, found = p._resolve_button_seat(3, [{"seat": 1}, {"seat": 3}])
        assert seat == 3
        assert found is True

    def test_none_button_uses_first_seat(self):
        p = self._parser()
        warnings = []
        seat, found = p._resolve_button_seat(None, [{"seat": 5}, {"seat": 2}], warnings)
        assert seat == 5  # first occupied seat
        assert found is False
        assert len(warnings) == 1
        assert "not found" in warnings[0].lower()

    def test_none_button_empty_seats(self):
        p = self._parser()
        warnings = []
        seat, found = p._resolve_button_seat(None, [], warnings)
        assert seat == 1  # ultimate fallback
        assert found is False


class TestResolveHeroPosition:
    """_resolve_hero_position must never silently assume BTN."""

    def _parser(self):
        return GGPokerParser()

    def test_hero_found(self):
        p = self._parser()
        players = [
            PlayerInfo(name="Alice", seat=1, stack_bb=100, position="BTN"),
            PlayerInfo(name="Bob", seat=2, stack_bb=100, position="BB"),
        ]
        assert p._resolve_hero_position(players, "Bob") == "BB"

    def test_hero_not_found(self):
        p = self._parser()
        players = [
            PlayerInfo(name="Alice", seat=1, stack_bb=100, position="BTN"),
        ]
        warnings = []
        pos = p._resolve_hero_position(players, "Missing", warnings)
        assert pos == "UNKNOWN"
        assert len(warnings) == 1
        assert "Missing" in warnings[0]


class TestValidateBlindPositions:
    """_validate_blind_positions must detect mismatches."""

    def _parser(self):
        return GGPokerParser()

    def test_correct_blinds(self):
        p = self._parser()
        text = "Alice: posts small blind $0.50\nBob: posts big blind $1.00"
        players = [
            PlayerInfo(name="Alice", seat=1, stack_bb=100, position="SB"),
            PlayerInfo(name="Bob", seat=2, stack_bb=100, position="BB"),
        ]
        assert p._validate_blind_positions(text, players) is True

    def test_sb_mismatch(self):
        p = self._parser()
        text = "Charlie: posts small blind $0.50\nBob: posts big blind $1.00"
        players = [
            PlayerInfo(name="Alice", seat=1, stack_bb=100, position="SB"),
            PlayerInfo(name="Bob", seat=2, stack_bb=100, position="BB"),
        ]
        warnings = []
        result = p._validate_blind_positions(text, players, warnings)
        assert result is False
        assert any("SB position mismatch" in w for w in warnings)

    def test_bb_mismatch(self):
        p = self._parser()
        text = "Alice: posts small blind $0.50\nCharlie: posts big blind $1.00"
        players = [
            PlayerInfo(name="Alice", seat=1, stack_bb=100, position="SB"),
            PlayerInfo(name="Bob", seat=2, stack_bb=100, position="BB"),
        ]
        warnings = []
        result = p._validate_blind_positions(text, players, warnings)
        assert result is False
        assert any("BB position mismatch" in w for w in warnings)

    def test_no_blind_lines(self):
        """No blind posting lines → validation passes (can't verify)."""
        p = self._parser()
        text = "Some random text without blind postings"
        players = [
            PlayerInfo(name="Alice", seat=1, stack_bb=100, position="SB"),
        ]
        assert p._validate_blind_positions(text, players) is True
