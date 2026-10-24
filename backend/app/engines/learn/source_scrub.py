"""Removes pointers to the theory source from text the coach sees or says.

The coach's prompt forbids citing a book, author, chapter, page, diagram or
hand-range number, but lesson data, theory rows and hand-review context still
carry such references (they are kept server-side on purpose). This scrubs
them from every context block before it reaches the model, and from the
model's reply as a last line of defence.
"""

from __future__ import annotations

import re

_NUM = r"\d+(?:\s*[–-]\s*\d+)?"
_RULES: list[tuple[re.Pattern[str], str]] = [
    # "(Modern Poker Theory, Ch. 7, Hand Range 139, p.360)" — a whole parenthesised citation.
    (re.compile(r"\s*\((?:[^()]*?)(?:modern poker theory|acevedo|hand ranges?\s*\d|\bpp?\.\s*\d|\bch(?:apter|\.)\s*\d)[^()]*\)", re.I), ""),
    (re.compile(r"modern poker theory(?:\s*\([^)]*\))?(?:'s)?", re.I), "Stacked Poker's study material"),
    (re.compile(r"(?:michael\s+)?acevedo(?:'s)?", re.I), "Stacked Poker"),
    (re.compile(rf"\bhand ranges?\s*{_NUM}", re.I), "the range"),
    (re.compile(rf"\b(?:chapter|ch\.)\s*{_NUM}", re.I), ""),
    (re.compile(rf"\b(?:diagram|table|figure|fig\.)s?\s*{_NUM}", re.I), ""),
    (re.compile(rf"\bpp?\.\s*{_NUM}", re.I), ""),
    (re.compile(rf"\bpages?\s+{_NUM}", re.I), ""),
    (re.compile(r"\bHR\s?\d+", re.I), "the range"),
    (re.compile(r"\bthe book's\b", re.I), "the"),
    (re.compile(r"\b(?:in|from|per|according to) the book\b", re.I), ""),
    (re.compile(r"\bthe book\b", re.I), "the reference ranges"),
]


def scrub_source_refs(text: str) -> str:
    """Text without book, author, chapter, page, diagram or hand-range references."""
    if not text:
        return text
    for pattern, repl in _RULES:
        text = pattern.sub(repl, text)
    text = re.sub(r"\(\s*[,;:·–-]*\s*\)", "", text)  # "()" or "(, )" left behind
    text = re.sub(r"\s*,(?:\s*,)+", ",", text)  # "Chapter 7, Diagram 56, p.677" leaves ",,"
    text = re.sub(r"[ \t]{2,}", " ", text)
    return re.sub(r" +([,.;:])", r"\1", text)
