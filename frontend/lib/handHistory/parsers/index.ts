/**
 * Parser registry. To support another site or format, add an entry here —
 * the import pipeline picks the first parser whose `canParse` matches a file.
 */

import type { ParseResult } from "../types";
import { GG_PARSER_ID, canParseGG, parseGGHand } from "./ggpoker";

export interface HandParser {
  id: string;
  /** Bump when the parser's output changes, so stored hands can be re-parsed. */
  version: number;
  canParse(fileText: string): boolean;
  parseHand(rawHand: string): ParseResult;
}

export const PARSERS: HandParser[] = [
  { id: GG_PARSER_ID, version: 1, canParse: canParseGG, parseHand: parseGGHand },
];

export function parserFor(fileText: string): HandParser | null {
  return PARSERS.find((p) => p.canParse(fileText)) ?? null;
}
