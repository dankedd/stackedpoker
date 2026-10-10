"""
Hand-review context for the AI coach — built server-side from the user's own
stored hand (hh_hands), never from hand data sent by the browser.

Input is one hh_hands row: `data` (the parsed hand, frontend/lib/handHistory/
types.ts ParsedHand), `raw_text`, the stored preflop check and replayer
analysis, plus the hand's notes. Output is a plain-text block for the coach's
system prompt.

Opponents are anonymised: a player is "Hero" or "Villain (CO)" — never the
site's player id — in the summary and in the raw text.
"""
from __future__ import annotations

import re
from typing import Any

RAW_TEXT_BUDGET = 4000  # characters of raw hand history appended as a fallback

STREETS = ("preflop", "flop", "turn", "river")
_VERDICT_TEXT = {
    "correct": "correct",
    "too_loose": "too loose (played a hand the range folds)",
    "too_tight": "too tight (folded a hand the range plays)",
    "wrong_action": "wrong action (played it, but not the way the range does)",
    "mixed": "mixed (the range plays this hand part of the time)",
    "not_evaluated": "not evaluated (no matching range)",
}
_ACTION_WORD = {"raise": "open-raise", "allin": "all-in", "limp": "limp", "fold": "fold", "call": "call"}


def _bb(chips: float, bb: float) -> str:
    v = round(chips / bb, 1) if bb else 0
    return f"{v:g} BB"


def _pct(x: float | None) -> str:
    return "?" if x is None else f"{x * 100:.1f}%"


def player_labels(hand: dict) -> dict[str, str]:
    """Site player id → "Hero" / "Villain (CO)"."""
    labels: dict[str, str] = {}
    for p in hand.get("players", []):
        pos = p.get("position") or f"seat {p.get('seat')}"
        labels[p["name"]] = "Hero" if p.get("isHero") else f"Villain ({pos})"
    return labels


def anonymise_text(text: str, labels: dict[str, str]) -> str:
    # Longest names first so a name that prefixes another never wins.
    for name in sorted(labels, key=len, reverse=True):
        if name == "Hero":
            continue
        text = re.sub(rf"(?<![\w]){re.escape(name)}(?![\w])", labels[name], text)
    return text


def timeline_steps(hand: dict) -> list[dict]:
    """The replayer's steps (frontend/lib/handHistory/timeline.ts): start,
    antes as one step, then every other event in order."""
    events = hand.get("events", [])
    steps: list[dict] = [{"kind": "start", "street": "preflop", "events": []}]
    antes = [e for e in events if e.get("kind") == "post" and e.get("post") == "ante"]
    if antes:
        steps.append({"kind": "antes", "street": "preflop", "events": antes})
    for e in events:
        if e.get("kind") == "post" and e.get("post") == "ante":
            continue
        steps.append({"kind": e.get("kind"), "street": e.get("street", "preflop"), "events": [e]})
    return steps


def describe_event(e: dict, labels: dict[str, str], bb: float) -> str:
    who = labels.get(e.get("player", ""), "?")
    kind = e.get("kind")
    all_in = " (all-in)" if e.get("allIn") else ""
    if kind == "post":
        what = {"small_blind": "posts the small blind", "big_blind": "posts the big blind", "ante": "posts the ante"}.get(e.get("post"), "posts")
        return f"{who} {what} {_bb(e['amount'], bb)}{all_in}"
    if kind == "action":
        a = e.get("action")
        if a in ("fold", "check"):
            return f"{who} {a}s"
        if a == "raise":
            return f"{who} raises to {_bb(e.get('toAmount') or e['amount'], bb)}{all_in}"
        return f"{who} {a}s {_bb(e['amount'], bb)}{all_in}"
    if kind == "uncalled":
        return f"{_bb(e['amount'], bb)} uncalled, returned to {who}"
    if kind == "show":
        return f"{who} shows {' '.join(e.get('cards', []))}"
    if kind == "deal":
        return f"{e.get('street', '').capitalize()} dealt: {' '.join(e.get('cards', []))}"
    if kind == "collect":
        return f"{who} wins {_bb(e['amount'], bb)}"
    return kind or "?"


def describe_step(hand: dict, index: int) -> str | None:
    steps = timeline_steps(hand)
    if not 0 <= index < len(steps):
        return None
    s = steps[index]
    bb = float(hand.get("bigBlind") or 1)
    labels = player_labels(hand)
    if s["kind"] == "start":
        what = "the start of the hand, before any action"
    elif s["kind"] == "antes":
        what = "everyone posting the ante"
    else:
        what = describe_event(s["events"][0], labels, bb)
    return f"{s['street'].capitalize()}, step {index} of {len(steps) - 1}: {what}"


def _hero_net(hand: dict) -> tuple[float, float]:
    hero = hand.get("heroName")
    invested = collected = 0.0
    for e in hand.get("events", []):
        if e.get("player") != hero:
            continue
        if e.get("kind") in ("post", "action"):
            invested += e.get("amount", 0)
        elif e.get("kind") == "uncalled":
            invested -= e.get("amount", 0)
        elif e.get("kind") == "collect":
            collected += e.get("amount", 0)
    return invested, collected


def build_hand_context(
    row: dict[str, Any],
    notes: list[dict[str, Any]],
    step_index: int | None,
) -> str:
    hand: dict = row.get("data") or {}
    bb = float(hand.get("bigBlind") or 1)
    labels = player_labels(hand)
    out: list[str] = []

    # ── Format and stage ──
    level = hand.get("level")
    ante = hand.get("ante") or 0
    out.append("HAND")
    out.append(
        f"- {hand.get('tournamentName') or 'Tournament'} (tournament #{hand.get('tournamentId')}), "
        f"level {level}: blinds {hand.get('smallBlind'):g}/{hand.get('bigBlind'):g}"
        + (f", ante {ante:g} ({_bb(ante, bb)} per player)" if ante else ", no ante")
    )
    players = hand.get("players", [])
    out.append(
        f"- {hand.get('maxSeats')}-max table, {len(players)} players dealt in. "
        "Players left in the tournament and payouts are unknown (not in the hand history)."
    )

    # ── Players ──
    out.append("PLAYERS (stacks at the start of the hand)")
    for p in sorted(players, key=lambda p: p.get("seat", 0)):
        line = f"- {labels[p['name']]}: {_bb(p.get('stack', 0), bb)}"
        if p.get("isHero") and hand.get("heroCards"):
            line += f", cards {' '.join(hand['heroCards'])}"
        out.append(line)

    # ── Actions per street, with the board ──
    out.append("ACTIONS")
    street = None
    antes = [e for e in hand.get("events", []) if e.get("kind") == "post" and e.get("post") == "ante"]
    if antes:
        out.append(f"Preflop: everyone posts the ante ({_bb(antes[0]['amount'], bb)})")
        street = "preflop"
    for e in hand.get("events", []):
        if e.get("kind") == "post" and e.get("post") == "ante":
            continue
        s = e.get("street", "preflop")
        if e.get("kind") == "deal":
            board = [c for st in STREETS[1 : STREETS.index(s) + 1] for c in _board_for(hand, st)]
            out.append(f"{s.capitalize()} (board {' '.join(board)}):")
            street = s
            continue
        if street is None:
            out.append("Preflop:")
            street = "preflop"
        out.append(f"  - {describe_event(e, labels, bb)}")

    # ── Showdown and result ──
    shown = hand.get("shown") or {}
    if shown:
        out.append("SHOWN CARDS: " + "; ".join(f"{labels.get(n, '?')} {' '.join(c)}" for n, c in shown.items()))
    else:
        out.append("SHOWN CARDS: none — opponents' cards are unknown.")
    winners = hand.get("winners") or []
    if winners:
        out.append("WINNERS: " + "; ".join(f"{labels.get(w['player'], '?')} {_bb(w['amount'], bb)}" for w in winners))
    invested, collected = _hero_net(hand)
    out.append(
        f"RESULT: total pot {_bb(hand.get('totalPot', 0), bb)}; Hero put in {_bb(invested, bb)}, "
        f"won {_bb(collected, bb)}, net {(collected - invested) / bb:+.1f} BB."
    )

    # ── Our preflop check ──
    detail = row.get("preflop_detail")
    verdict = row.get("preflop_check")
    if verdict and isinstance(detail, dict):
        spot = detail.get("spot") or {}
        rng = detail.get("range")
        out.append("OUR PREFLOP CHECK (raise first in, against the user's preflop trainer ranges — the user's own range)")
        out.append(f"- Verdict: {_VERDICT_TEXT.get(verdict, verdict)}")
        out.append(
            f"- Spot: Hero {spot.get('tablePosition')} with {spot.get('playersBehind')} players behind, "
            f"effective stack {spot.get('effStackBb', 0):.1f} BB, hand {spot.get('hand')}"
        )
        if rng:
            kind = "push/fold chart" if rng.get("kind") == "pushfold" else "open-raise chart"
            out.append(f"- Range used: {rng.get('position')} {kind} at {rng.get('bucket')} BB (9-max chart; the table seat maps to it by players behind)")
        expected = detail.get("expected")
        hero_action = _ACTION_WORD.get(spot.get("action"), spot.get("action"))
        size = f" to {spot['sizeBb']:.1f} BB" if spot.get("sizeBb") and spot.get("action") == "raise" else ""
        out.append(f"- Range says: {_ACTION_WORD.get(expected, expected) if expected else 'n/a'}. Hero: {hero_action}{size}.")
        freqs = detail.get("freqs") or {}
        played = {k: v for k, v in freqs.items() if v and v > 0}
        if played:
            out.append("- Frequencies for this hand: " + ", ".join(f"{_ACTION_WORD.get(k, k)} {_pct(v)}" for k, v in sorted(played.items(), key=lambda kv: -kv[1])))
        if detail.get("reason"):
            out.append(f"- Not evaluated because: {_reason_text(detail['reason'])}")

    # ── Our equity and pot odds ──
    analysis = row.get("analysis")
    if isinstance(analysis, dict) and analysis.get("streets"):
        villain = labels.get(analysis.get("villain", ""), "Villain")
        out.append(f"OUR EQUITY ANALYSIS (chip EV; Hero vs {villain}'s range)")
        out.append(f"- Range used: {analysis.get('rangeLabel')} ({analysis.get('rangePct', 0):.1f}% of hands)")
        if analysis.get("approximation"):
            why = re.sub(r"^\s*approximation:\s*", "", analysis["approximation"], flags=re.I)
            out.append(
                f"- APPROXIMATION: the trainer has no range for this exact spot, so the closest one was used ({why}). "
                "The equity and pot-odds verdict below rest on that approximate range — say so when quoting them."
            )
        out.append("- The range is preflop only; it is not narrowed by postflop actions.")
        for s in analysis.get("streets", []):
            if s.get("equity") is None:
                out.append(f"- {s['street'].capitalize()}: every hand in the range is blocked")
            else:
                out.append(f"- {s['street'].capitalize()}: Hero equity {_pct(s['equity'])} (tie {_pct(s.get('tie'))})")
        events = hand.get("events", [])
        for d in analysis.get("decisions", []):
            ev = events[d["eventIndex"]] if 0 <= d.get("eventIndex", -1) < len(events) else None
            what = describe_event(ev, labels, bb) if ev else d.get("action", "?")
            line = (
                f"- Decision ({d['street']}): {what}. To call {_bb(d['toCall'], bb)} into a pot of {_bb(d['pot'], bb)} "
                f"→ needs {_pct(d['required'])} equity; Hero had {_pct(d.get('equity'))}."
            )
            if d.get("stillToAct"):
                line += f" {d['stillToAct']} player(s) still to act behind Hero; these odds assume heads-up."
            out.append(line)

    # ── Notes and star ──
    body_notes = [n for n in notes if (n.get("body") or "").strip()]
    if body_notes:
        out.append("USER'S NOTES ON THIS HAND")
        for n in body_notes:
            scope = "" if n.get("street") in (None, "hand") else f" ({n['street']})"
            out.append(f"- {anonymise_text(n['body'].strip(), labels)[:1500]}{scope}")
    out.append(f"STARRED: {'yes' if row.get('favorited_at') else 'no'}")

    # ── Where the replayer is ──
    if step_index is not None:
        step = describe_step(hand, step_index)
        if step:
            out.append(f"CURRENT REPLAYER STEP: {step}. Questions like 'this spot' refer to this step.")

    # ── Raw text, anonymised, as a fallback ──
    raw = anonymise_text(row.get("raw_text") or "", labels)
    if raw:
        clipped = raw if len(raw) <= RAW_TEXT_BUDGET else raw[:RAW_TEXT_BUDGET] + "\n[…truncated]"
        out.append("RAW HAND HISTORY (anonymised, fallback only — the structured data above wins):\n" + clipped)

    return "\n".join(out)


def _reason_text(reason: Any) -> str:
    if not isinstance(reason, dict):
        return str(reason)
    code = reason.get("code")
    if code == "too_deep":
        return f"effective stack {reason.get('effStackBb')} BB is deeper than the trainer's charts (max 60 BB)"
    if code == "no_position":
        return f"no chart for a seat with {reason.get('playersBehind')} players behind"
    if code == "no_chart":
        return f"the trainer has no chart for {reason.get('position')}"
    return str(code)


def _board_for(hand: dict, street: str) -> list[str]:
    b = hand.get("board") or {}
    if street == "flop":
        return list(b.get("flop") or [])
    if street == "turn":
        return [b["turn"]] if b.get("turn") else []
    if street == "river":
        return [b["river"]] if b.get("river") else []
    return []
