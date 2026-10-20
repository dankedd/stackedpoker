/**
 * Autosave for a manual hand being entered: per user, in this browser, so a
 * refresh or a phone call loses nothing. "Continue your unfinished hand"
 * reads it back. When storage is blocked every function is a quiet no-op.
 */

import type { ManualEntry } from "./entry";

export type DraftPhase = "setup" | "actions" | "review";

export interface ManualDraft {
  v: 1;
  savedAt: string;
  /** Set when editing a saved hand (its hh_hands id). */
  editId: string | null;
  phase: DraftPhase;
  entry: ManualEntry;
  note: string;
  starred: boolean;
}

const key = (userId: string) => `sp_manual_hand_draft:${userId}`;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function saveDraft(userId: string, draft: Omit<ManualDraft, "v" | "savedAt">, now = new Date()): void {
  try {
    storage()?.setItem(key(userId), JSON.stringify({ v: 1, savedAt: now.toISOString(), ...draft } satisfies ManualDraft));
  } catch {
    /* full or blocked: the hand just isn't autosaved */
  }
}

export function loadDraft(userId: string): ManualDraft | null {
  try {
    const raw = storage()?.getItem(key(userId));
    if (!raw) return null;
    const d = JSON.parse(raw) as ManualDraft;
    return d?.v === 1 && d.entry?.setup && Array.isArray(d.entry.steps) ? d : null;
  } catch {
    return null;
  }
}

export function clearDraft(userId: string): void {
  try {
    storage()?.removeItem(key(userId));
  } catch {
    /* ignore */
  }
}
