/**
 * Hand sharing: thin wrappers around the RPCs in
 * supabase/migrations/20261025_03_hand_shares.sql, plus link helpers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSiteUrl } from "@/lib/site-url";
import type { ParsedHand } from "@/lib/handHistory/types";
import { anonymizeHand, type DecisionPoint, type GuessChoice, type SharedHand } from "./anonymize";

export type ShareVisibility = "link" | "friends" | "public";

export interface ShareOptions {
  visibility: ShareVisibility;
  showHeroCards: boolean;
  showResult: boolean;
  question: string;
  /** Guess mode on when set. */
  decision: DecisionPoint | null;
}

export interface MyShare {
  slug: string;
  hand_id: string;
  visibility: ShareVisibility;
  show_hero_cards: boolean;
  show_result: boolean;
  guess_mode: boolean;
  question: string | null;
  created_at: string;
  view_count: number;
  guesses: number;
  revoked_at: string | null;
  hidden_at: string | null;
}

export interface SharedHandPayload {
  slug: string;
  visibility: ShareVisibility;
  question: string | null;
  created_at: string;
  owner: { handle: string | null; name: string; role: string; deleted: boolean };
  is_owner: boolean;
  revoked: boolean;
  hidden: boolean;
  show_hero_cards: boolean;
  show_result: boolean;
  guess_mode: boolean;
  decision_options: GuessChoice[] | null;
  decision_index: number | null;
  my_guess: GuessChoice | null;
  actual_choice: GuessChoice | null;
  distribution: Partial<Record<GuessChoice, number>> | null;
  view_count: number | null;
  hand: SharedHand;
}

type Rpc = Pick<SupabaseClient, "rpc">;

/** Throws the database message ("social:rate_limited:share", …) on failure. */
export async function createShare(supabase: Rpc, handId: string, hand: ParsedHand, o: ShareOptions): Promise<string> {
  const { data, error } = await supabase.rpc("create_hand_share", {
    p_hand_id: handId,
    p_snapshot: anonymizeHand(hand),
    p_visibility: o.visibility,
    p_show_hero_cards: o.showHeroCards,
    p_show_result: o.showResult,
    p_guess_mode: o.decision != null,
    p_question: o.question.trim() || null,
    p_decision_index: o.decision?.eventIndex ?? null,
    p_decision_options: o.decision?.options ?? null,
    p_actual_choice: o.decision?.actual ?? null,
  });
  const res = data as { ok?: boolean; slug?: string; error?: string } | null;
  if (error) throw new Error(error.message);
  if (!res?.ok || !res.slug) throw new Error(res?.error ?? "generic");
  return res.slug;
}

export async function updateShare(
  supabase: Rpc,
  slug: string,
  o: Pick<ShareOptions, "visibility" | "showHeroCards" | "showResult" | "question">,
): Promise<void> {
  const { data, error } = await supabase.rpc("update_hand_share", {
    p_slug: slug,
    p_visibility: o.visibility,
    p_show_hero_cards: o.showHeroCards,
    p_show_result: o.showResult,
    p_question: o.question.trim() || null,
  });
  if (error) throw new Error(error.message);
  if (!(data as { ok?: boolean } | null)?.ok) throw new Error((data as { error?: string } | null)?.error ?? "generic");
}

export async function revokeShare(supabase: Rpc, slug: string): Promise<void> {
  const { data, error } = await supabase.rpc("revoke_hand_share", { p_slug: slug });
  if (error) throw new Error(error.message);
  if (!(data as { ok?: boolean } | null)?.ok) throw new Error("not_found");
}

export async function listMyShares(supabase: Rpc, handId?: string): Promise<MyShare[]> {
  const { data, error } = await supabase.rpc("my_hand_shares", { p_hand_id: handId ?? null });
  if (error) throw new Error(error.message);
  return (data ?? []) as MyShare[];
}

export async function getSharedHand(supabase: Rpc, slug: string, anonId?: string | null): Promise<SharedHandPayload | null> {
  const { data, error } = await supabase.rpc("get_shared_hand", { p_slug: slug, p_anon: anonId ?? null });
  if (error) throw new Error(error.message);
  return (data ?? null) as SharedHandPayload | null;
}

export async function submitGuess(supabase: Rpc, slug: string, choice: GuessChoice, anonId: string | null): Promise<SharedHandPayload | null> {
  const { data, error } = await supabase.rpc("submit_hand_guess", { p_slug: slug, p_choice: choice, p_anon: anonId });
  if (error) throw new Error(error.message);
  return (data ?? null) as SharedHandPayload | null;
}

export async function recordView(supabase: Rpc, slug: string): Promise<void> {
  await supabase.rpc("record_share_view", { p_slug: slug });
}

// ── Links ───────────────────────────────────────────────────────────────────

export const SLUG_RE = /^[A-Za-z0-9]{7}$/;

export function shareUrl(slug: string, origin?: string): string {
  return `${getSiteUrl(origin)}/h/${slug}`;
}

export function embedUrl(slug: string, origin?: string): string {
  return `${getSiteUrl(origin)}/embed/h/${slug}`;
}

export function embedCode(slug: string, origin?: string): string {
  return `<iframe src="${embedUrl(slug, origin)}" width="100%" height="560" style="border:0;border-radius:12px;max-width:640px" loading="lazy" title="Poker hand on Stacked Poker"></iframe>`;
}

/** Where the "Analyze your own hands" bar on a shared hand leads. */
export function signupFromShareUrl(slug: string): string {
  const q = new URLSearchParams({ utm_source: "share", utm_medium: "hand", utm_content: slug });
  return `/signup?${q}`;
}

export type SocialTarget = "whatsapp" | "x" | "reddit";

export function socialShareUrl(target: SocialTarget, url: string, text: string): string {
  const e = encodeURIComponent;
  if (target === "whatsapp") return `https://wa.me/?text=${e(`${text} ${url}`)}`;
  if (target === "x") return `https://x.com/intent/post?text=${e(text)}&url=${e(url)}`;
  return `https://www.reddit.com/submit?url=${e(url)}&title=${e(text)}`;
}

// ── Signed-out voter id ────────────────────────────────────────────────────

const ANON_KEY = "sp_anon_id";

/** A random id kept in this browser so a signed-out vote counts once. */
export function anonId(): string | null {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
