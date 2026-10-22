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
# Facing a bet, the chart's "raise" is named after the spot; "call" behind a limp is the BB's check.
_RAISE_WORD = {"vs_open": "3-bet", "vs_push": "raise", "vs_limp": "raise (iso-raise)", "vs_4bet": "5-bet", "vs_limp_raise": "4-bet"}


def _defense_words(kind: str) -> dict[str, str]:
    return {"raise": _RAISE_WORD.get(kind, "raise"), "allin": "all-in", "fold": "fold", "call": "check" if kind == "vs_limp" else "call"}
_SPOT_TITLE = {
    "rfi": "raise first in",
    "vs_open": "facing an open",
    "vs_push": "facing an all-in",
    "vs_limp": "facing a limp",
    "vs_4bet": "facing a 4-bet after Hero's 3-bet",
    "vs_limp_raise": "facing a limp-raise after Hero raised the limp",
    "other": "facing more than one opponent",
}
_FLOP_VERDICT_TEXT = {
    "good": "good (in line with the guideline)",
    "ok": "ok (fine / a reasonable mix)",
    "questionable": "questionable (the flop data argues against it — explain why, mildly)",
    "not_evaluated": "not evaluated",
}
_FLOP_LINE_WORD = {"cbet": "c-bet", "check": "check", "check_raise": "check-raise", "call": "call", "fold": "fold",
                   "raise": "raise", "lead": "lead (bet into the preflop raiser)", "stab": "bet after the raiser checked"}
_CHART_SPOT_WORD = {"open": "vs-open", "push": "vs-shove", "limp": "vs-limp", "4bet": "vs-4-bet", "lr": "vs-limp-raise"}


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
        kind = spot.get("kind") or "rfi"
        rng = detail.get("range")
        defense = kind != "rfi"
        title = _SPOT_TITLE.get(kind, "preflop decision")
        out.append(f"OUR PREFLOP CHECK ({title}, against the user's preflop trainer charts — the user's own range)")
        out.append(f"- Verdict: {_VERDICT_TEXT.get(verdict, verdict)}")
        if defense:
            vil = spot.get("villain") or {}
            vil_label = labels.get(vil.get("name", ""), "Villain")
            size = vil.get("sizeBb")
            what = {
                "vs_open": f"opened to {size:g} BB" if isinstance(size, (int, float)) else "opened",
                "vs_push": "went all-in",
                "vs_limp": "limped",
                "vs_4bet": "4-bet" + (" all-in" if vil.get("allIn") else (f" to {size:g} BB" if isinstance(size, (int, float)) else "")),
                "vs_limp_raise": "limped, then re-raised Hero's raise" + (" all-in" if vil.get("allIn") else ""),
            }.get(kind, "acted")
            out.append(
                f"- Spot: Hero {spot.get('tablePosition')} (9-max chart position {spot.get('position')}) faces "
                f"{vil_label} (chart position {vil.get('position')}), who {what}; "
                f"effective stack {spot.get('effStackBb', 0):.1f} BB, hand {spot.get('hand')}"
            )
            if kind == "other":
                out.append("- More than one opponent acted before Hero (or a re-raise): the trainer has no chart for this spot.")
        else:
            out.append(
                f"- Spot: Hero {spot.get('tablePosition')} with {spot.get('playersBehind')} players behind, "
                f"effective stack {spot.get('effStackBb', 0):.1f} BB, hand {spot.get('hand')}"
            )
        if rng:
            if rng.get("kind") == "defense":
                out.append(
                    f"- Range used: the {rng.get('position')} vs {rng.get('vil')} {_CHART_SPOT_WORD.get(rng.get('spot'), 'defense')} chart "
                    f"at {rng.get('bucket')} BB (9-max chart; seats map to it by players behind)"
                )
            else:
                kind_word = "push/fold chart" if rng.get("kind") == "pushfold" else "open-raise chart"
                out.append(f"- Range used: {rng.get('position')} {kind_word} at {rng.get('bucket')} BB (9-max chart; the table seat maps to it by players behind)")
        expected = detail.get("expected")
        words = _defense_words(kind) if defense else _ACTION_WORD
        hero_action = words.get(spot.get("action"), spot.get("action"))
        size = f" to {spot['sizeBb']:.1f} BB" if spot.get("sizeBb") and spot.get("action") == "raise" else ""
        out.append(f"- Range says: {words.get(expected, expected) if expected else 'n/a'}. Hero: {hero_action}{size}.")
        if detail.get("graded"):
            out.append(f"- Hero's action was graded as {words.get(detail['graded'], detail['graded'])}: this chart has only one size of raise.")
        freqs = detail.get("freqs") or {}
        played = {k: v for k, v in freqs.items() if v and v > 0}
        if played:
            out.append("- Chart frequencies for this hand: " + ", ".join(f"{words.get(k, k)} {_pct(v)}" for k, v in sorted(played.items(), key=lambda kv: -kv[1])))
        also = detail.get("also")
        if isinstance(also, dict):
            out.append(
                f"- Hero's other graded decision in this hand ({_SPOT_TITLE.get(also.get('kind'), also.get('kind'))}): "
                f"{_VERDICT_TEXT.get(also.get('verdict'), also.get('verdict'))}"
            )
        if detail.get("reason"):
            out.append(f"- Not evaluated because: {_reason_text(detail['reason'])}")

    # ── Our flop check ──
    flop = row.get("flop_detail")
    flop_verdict = row.get("flop_check")
    if flop_verdict and isinstance(flop, dict) and flop.get("line"):
        line = flop["line"] or {}
        out.append("OUR FLOP CHECK (range-level guideline from the precomputed flop data — not solver output for this exact hand)")
        out.append(f"- Verdict: {_FLOP_VERDICT_TEXT.get(flop_verdict, flop_verdict)}")
        what = _FLOP_LINE_WORD.get(line.get("kind"), line.get("kind"))
        if line.get("betPct") is not None:
            what += f" {line['betPct']}% of the pot"
        if isinstance(line.get("facing"), dict):
            f = line["facing"]
            what += f" facing a {f.get('pct')}% pot bet (needed {_pct(f.get('required'))} equity to call)"
        out.append(f"- Hero's flop decision: {what}")
        hand_pos = flop.get("hand")
        if isinstance(hand_pos, dict) and hand_pos.get("equity") is not None:
            top = f", top {round(hand_pos['top_pct'])}% of Hero's range" if hand_pos.get("in_range") and hand_pos.get("top_pct") is not None else ", outside the range"
            out.append(f"- Hero's hand on this flop: {hand_pos.get('bucket')} bucket, {round(hand_pos['equity'])}% equity vs villain's range{top}")
        adv = flop.get("advice")
        if isinstance(adv, dict):
            if adv.get("source") == "book" and isinstance(adv.get("strategy"), dict):
                out.append("- Reference strategy for this flop: " + ", ".join(f"{k.replace('bet_', 'bet ').replace('_', '/')} {v}%" for k, v in adv["strategy"].items()))
            else:
                out.append(f"- C-bet guideline for this board: {adv.get('band')} frequency, {adv.get('size')} size")
        if flop.get("explain"):
            out.append(f"- Our explanation: {_strip_pages(flop['explain'])}")

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


_PAGE = r"pp?\.\s*\d+(?:\s*[–-]\s*\d+)?"


def _strip_pages(text: str) -> str:
    """Page references are for the app's UI; the coach context never carries page numbers."""
    text = re.sub(rf"{_PAGE};\s*", "", text)  # "(p.727; you needed …)" → "(you needed …)"
    text = re.sub(rf"\s*\({_PAGE}\)", "", text)  # " (p.680–681)"
    text = re.sub(rf"\s*{_PAGE}", "", text)  # anything left
    return re.sub(r"\(\s*\)", "", text).strip()


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
    if code == "too_short":
        return f"effective stack {reason.get('effStackBb')} BB is shorter than the trainer's defense charts (min 15 BB)"
    if code == "no_defense_chart":
        return f"no matching chart: the trainer has no chart for {reason.get('hero')} vs {reason.get('vil')} in this spot"
    if code == "unmatched":
        why = {
            "squeeze": "an open plus a caller before Hero (squeeze)",
            "cold_4bet": "a raise and a re-raise before Hero (cold 4-bet)",
            "multi_limp": "more than one limper",
            "limp_then_raise": "a limp and then a raise",
            "multi_allin": "more than one all-in before Hero",
        }.get(reason.get("why"), "several opponents")
        return f"no matching chart: {why}"
    if code == "not_in_range":
        return "this hand does not reach this spot in the trainer's range (no chart entry)"
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
