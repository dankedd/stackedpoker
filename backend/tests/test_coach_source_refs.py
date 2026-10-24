"""The coach never names the theory source: not in the context it receives,
not in its replies — also when the user asks for it directly."""
import asyncio
import os
import re

import pytest

from app.engines.learn import ai_coach
from app.engines.learn.source_scrub import scrub_source_refs

SOURCE_REF = re.compile(
    r"hand ranges?\s*\d|\bHR ?\d|\bp\. ?\d|\bpages? \d|modern poker theory|acevedo|\bchapter \d|\bdiagram \d|\bthe book\b",
    re.I,
)


@pytest.mark.parametrize(
    "text",
    [
        "Call. BB calls 43.4% (Hand Range 82, p.244) — the source names it.",
        "Real, book-transcribed 40bb CO range (Modern Poker Theory, Hand Range 118, p.334).",
        "Bucket names: Modern Poker Theory, Equity Buckets (p.597).",
        "This is from Chapter 7, Diagram 56, pp. 677-679 of the book.",
        "the book's OOP raiser c-bets more often",
        "According to Michael Acevedo, BB defends wide.",
        "LJ open raise · 25 BB (HR 125 · page 343)",
    ],
)
def test_scrub_removes_every_reference(text):
    assert not SOURCE_REF.search(scrub_source_refs(text))


def test_scrub_keeps_plain_poker_text():
    text = "BB calls 43.4% vs a 2.5x open; 3-bet 13.4%. Pot odds 25%, page through hands."
    assert scrub_source_refs(text) == text


class _FakeClient:
    """Captures the system prompt and answers with a reply that cites the source."""

    def __init__(self, reply: str):
        self.sent: list[dict] = []
        outer = self

        class _Completions:
            async def create(self, **kw):
                outer.sent = kw["messages"]
                msg = type("M", (), {"content": reply})
                return type("R", (), {"choices": [type("C", (), {"message": msg})], "usage": None})

        self.chat = type("Chat", (), {"completions": _Completions()})


def _ask(monkeypatch, question: str, reply: str, context: dict) -> tuple[str, str]:
    fake = _FakeClient(reply)
    monkeypatch.setattr(ai_coach, "AsyncOpenAI", lambda **kw: fake)
    out = asyncio.run(
        ai_coach.generate_coach_reply(
            messages=[{"role": "user", "content": question}],
            context=context,
            user_level=10,
            mode="hand_review",
            theory=[{"name": "MDF", "principle": "Defend 1 - alpha (Modern Poker Theory p.112)", "confidence": "high"}],
        )
    )
    return fake.sent[0]["content"], out


CONTEXT = {
    "hand_review_block": "OUR PREFLOP CHECK\n- Range used: BB vs BN open (Hand Range 82, p.244), the book's chart",
    "narrative": "From Modern Poker Theory, Chapter 5, Diagram 12.",
}


def test_system_prompt_names_stackeds_ranges_and_carries_no_source(monkeypatch):
    system, _ = _ask(monkeypatch, "Where do these ranges come from?", "ok", CONTEXT)
    assert "Stacked Poker's ranges" in system
    rules, context = system.split("CURRENT SESSION CONTEXT:", 1)
    assert not SOURCE_REF.search(context), context
    assert "page" in rules.lower()  # the rule itself names what not to cite


@pytest.mark.parametrize("question", ["Where do these ranges come from?", "Which page is this from?"])
def test_a_reply_that_cites_the_source_is_scrubbed(monkeypatch, question):
    _, reply = _ask(monkeypatch, question, "That's Hand Range 82 on p. 244 of Modern Poker Theory by Michael Acevedo.", CONTEXT)
    assert not SOURCE_REF.search(reply), reply


live = pytest.mark.skipif(not os.getenv("COACH_LIVE_TEST"), reason="set COACH_LIVE_TEST=1 to call the real model")


@live
@pytest.mark.parametrize("question", ["Where do these ranges come from?", "Which page is this from?"])
def test_live_model_names_no_source(question):
    reply = asyncio.run(
        ai_coach.generate_coach_reply(
            messages=[{"role": "user", "content": question}], context=CONTEXT, user_level=10, mode="hand_review"
        )
    )
    print(f"\nQ: {question}\nA: {reply}")
    assert not SOURCE_REF.search(reply), reply
