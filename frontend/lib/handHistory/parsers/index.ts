/**
 * Parser registry. A file is recognised by its content (../detect.ts); the
 * parser for that site — when there is one — splits it into hands and parses
 * each into the shared ParsedHand. To support another site, add a parser
 * here and its recognition in detect.ts.
 */

import { detectFormat, type SiteId } from "../detect";
import type { ParseResult } from "../types";
import { GG_PARSER_ID, parseGGHand, splitGGHands } from "./ggpoker";
import { PS_PARSER_ID, parsePSHand, splitPSHands } from "./pokerstars";

export interface HandParser {
  id: string;
  site: SiteId;
  /** Bump when the parser's output changes, so stored hands can be re-parsed. */
  version: number;
  splitHands(fileText: string): { hands: string[]; leftover: string };
  parseHand(rawHand: string): ParseResult;
}

export const PARSERS: Partial<Record<SiteId, HandParser>> = {
  ggpoker: { id: GG_PARSER_ID, site: "ggpoker", version: 1, splitHands: splitGGHands, parseHand: parseGGHand },
  pokerstars: { id: PS_PARSER_ID, site: "pokerstars", version: 1, splitHands: splitPSHands, parseHand: parsePSHand },
};

/** Sites whose tournament exports can be imported today. */
export const SUPPORTED_SITES = Object.keys(PARSERS) as SiteId[];

/** The parser for a file or a single stored hand, or null when its site isn't supported. */
export function parserFor(text: string): HandParser | null {
  const { site } = detectFormat(text);
  return (site && PARSERS[site]) ?? null;
}
