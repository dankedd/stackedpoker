/**
 * Recognises a hand history file by its CONTENT (never its file name), so the
 * player never has to say which site an export came from.
 *
 * Only the start of the file is inspected: every format announces itself in
 * its first hand, and a 40 MB export should not be scanned twice.
 */

export type SiteId = "ggpoker" | "pokerstars" | "888poker" | "ipoker";
export type GameType = "tournament" | "cash" | "unknown";

export interface Detection {
  /** null: not a format we recognise. */
  site: SiteId | null;
  gameType: GameType;
  /** "other": a recognised site whose client wrote the file in another language. */
  language: "en" | "other";
}

export const SITE_LABEL: Record<SiteId, string> = {
  ggpoker: "GGPoker",
  pokerstars: "PokerStars",
  "888poker": "888poker",
  ipoker: "iPoker",
};

const HEAD_CHARS = 64 * 1024;

// GGPoker: "Poker Hand #TM5…: Tournament #…" (cash hands use other two-letter prefixes).
const GG_HAND = /^Poker Hand #[A-Z]{2}[A-Za-z0-9-]*:(.*)$/m;
// PokerStars: "PokerStars Hand #…", "PokerStars Zoom Hand #…", older "PokerStars Game #…".
const PS_HAND = /^PokerStars (?:Zoom |Home Game )?(?:Hand|Game) #\d+:(.*)$/m;
// Any PokerStars header, also in a translated client ("PokerStars Hand #…: Turnier #…", "PokerStars Main n°…").
const PS_ANY = /^PokerStars\b/m;
// Lines only the English client writes. A translated client changes these.
const PS_ENGLISH = [/^Table '[^']*' .*Seat #\d+ is the button/m, /^\*\*\* HOLE CARDS \*\*\*/m];
// 888poker: "#Game No : 123" followed by "***** 888poker Hold'em …".
const P888 = /^#Game No\s*:\s*\d+/m;
const P888_BANNER = /\*{5}\s*888poker/i;
// iPoker: XML with a <session> root and <game gamecode="…"> per hand.
const IPOKER = /<session\b[^>]*>[\s\S]*?<game\b[^>]*\bgamecode\s*=/i;

export function detectFormat(fileText: string): Detection {
  const text = fileText.replace(/^﻿/, "").slice(0, HEAD_CHARS);

  const gg = GG_HAND.exec(text);
  if (gg) {
    return { site: "ggpoker", gameType: /^\s*Tournament #/.test(gg[1]) ? "tournament" : "cash", language: "en" };
  }

  const ps = PS_HAND.exec(text);
  if (ps || PS_ANY.test(text)) {
    const english = PS_ENGLISH.every((re) => re.test(text));
    if (!english) return { site: "pokerstars", gameType: "unknown", language: "other" };
    return { site: "pokerstars", gameType: ps && /^\s*Tournament #/.test(ps[1]) ? "tournament" : "cash", language: "en" };
  }

  if (P888.test(text) || P888_BANNER.test(text)) {
    return { site: "888poker", gameType: /\bTournament #/i.test(text) ? "tournament" : "cash", language: "en" };
  }

  if (IPOKER.test(text)) {
    return { site: "ipoker", gameType: /<tournament(?:code|name)\b/i.test(text) ? "tournament" : "cash", language: "en" };
  }

  return { site: null, gameType: "unknown", language: "en" };
}
