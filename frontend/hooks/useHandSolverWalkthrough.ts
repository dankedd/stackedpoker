"use client";

/**
 * useHandSolverWalkthrough
 *
 * Walks a solved game tree following the actual actions taken in a hand,
 * recording solver recommendations at every hero decision point.
 *
 * Algorithm:
 *   1. Load tree root
 *   2. For each post-flop street (flop → turn → river):
 *      a. If crossing a street boundary, navigate the chance node using the
 *         actual card dealt (from hand board_cards)
 *      b. For each action in the street, match it to the closest tree action
 *         and navigate to the child node
 *      c. At hero decision nodes, record a HeroDecision entry
 *   3. Stop at terminal nodes or when the tree has no matching child
 */

import { useState, useCallback } from "react";
import { getSolverTree, getSolverNode } from "@/lib/api";
import type { SolverNodeResponse, SolverActionDetail } from "@/lib/api";
import type { CanonicalHand, CanonicalAction, CanonicalStreetName } from "@/lib/hand-schema";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ────────────────────────────────────────────────────────────────────

export interface HeroDecision {
  /** Which street this decision occurred on */
  street: CanonicalStreetName;
  /** Board cards at this point (e.g. ["Jh","9c","4d"]) */
  board: string[];
  /** Node pot size in BB */
  potBb: number;
  /** The actual action the hero took */
  heroAction: CanonicalAction;
  /** All actions the solver considers at this node */
  solverActions: SolverActionDetail[];
  /** The tree action that best matches the hero's actual action */
  matchedSolverAction: SolverActionDetail | null;
  /** The solver's highest-frequency recommended action */
  topSolverAction: SolverActionDetail | null;
  /** Solver frequency for the matched action (0–1) */
  heroActionFrequency: number | null;
  /** EV of the matched action (from node evs map) */
  heroActionEv: number | null;
  /** EV of the top solver action */
  topActionEv: number | null;
  nodeId: string;
}

export interface WalkthroughState {
  decisions: HeroDecision[];
  loading: boolean;
  error: string | null;
}

// ── Action matching ──────────────────────────────────────────────────────────

/**
 * Match a canonical hand action to the closest available tree action.
 *
 * Exact matches for check/call/fold. Bet/raise matched by pot percentage
 * proximity (hero's amount_bb / pot_before_bb * 100 ≈ tree action pct).
 */
function matchAction(
  action: CanonicalAction,
  treeActions: SolverActionDetail[],
): SolverActionDetail | null {
  if (treeActions.length === 0) return null;

  const type = action.action;

  // Exact token matches
  if (type === "check") return treeActions.find(a => a.token === "x") ?? null;
  if (type === "call")  return treeActions.find(a => a.token === "c") ?? null;
  if (type === "fold")  return treeActions.find(a => a.token === "f") ?? null;

  // All-in
  if (action.is_all_in) return treeActions.find(a => a.token === "ai" || a.token === "rai") ?? null;

  // Bet: match by pot percentage
  if (type === "bet" || type === "raise") {
    const prefix = type === "bet" ? "b" : "r";
    const actualPct =
      action.pot_before_bb > 0
        ? (action.amount_bb / action.pot_before_bb) * 100
        : 0;

    const candidates = treeActions.filter(a => a.token.startsWith(prefix));
    if (candidates.length === 0) {
      // Fall back to any bet-like action
      const any = treeActions.filter(a => a.token.startsWith("b") || a.token.startsWith("r"));
      if (any.length === 0) return null;
      candidates.push(...any);
    }

    let best = candidates[0];
    let bestDiff = Infinity;
    for (const c of candidates) {
      const pct = parseFloat(c.token.slice(1));
      if (!Number.isNaN(pct)) {
        const diff = Math.abs(pct - actualPct);
        if (diff < bestDiff) { bestDiff = diff; best = c; }
      }
    }
    return best;
  }

  return null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useHandSolverWalkthrough(): {
  state: WalkthroughState;
  run: (jobId: string, hand: CanonicalHand) => Promise<void>;
  reset: () => void;
} {
  const { session } = useAuth();
  const [state, setState] = useState<WalkthroughState>({
    decisions: [],
    loading: false,
    error: null,
  });

  const reset = useCallback(() => {
    setState({ decisions: [], loading: false, error: null });
  }, []);

  const run = useCallback(
    async (jobId: string, hand: CanonicalHand) => {
      const token = session?.access_token;
      if (!token) {
        setState(s => ({ ...s, error: "Not authenticated" }));
        return;
      }

      setState({ decisions: [], loading: true, error: null });

      try {
        // ── 1. Load tree root ───────────────────────────────────────────
        const treeMeta = await getSolverTree(jobId, token);
        let currentNode: SolverNodeResponse = await getSolverNode(
          jobId,
          treeMeta.root_node_id,
          token,
        );

        const decisions: HeroDecision[] = [];
        // Simple in-memory node cache to avoid redundant fetches
        const cache = new Map<string, SolverNodeResponse>();
        cache.set(currentNode.id, currentNode);

        const fetchNode = async (id: string): Promise<SolverNodeResponse> => {
          if (cache.has(id)) return cache.get(id)!;
          const n = await getSolverNode(jobId, id, token);
          cache.set(n.id, n);
          return n;
        };

        // ── 2. Walk post-flop streets ───────────────────────────────────
        const postFlopStreets: CanonicalStreetName[] = ["flop", "turn", "river"];

        for (const streetName of postFlopStreets) {
          const streetData = hand.streets.find(s => s.name === streetName);
          if (!streetData || streetData.actions.length === 0) continue;

          // Cross street boundary: if current node is a chance node,
          // navigate to the child matching the newly dealt card.
          if (
            streetName !== "flop" &&
            currentNode.metadata.node_type === "chance" &&
            streetData.board_cards.length > 0
          ) {
            // The last board card on this street is the one just dealt
            const dealtCard = streetData.board_cards[
              streetData.board_cards.length - 1
            ].notation.toLowerCase();

            const cardActionIdx = currentNode.available_actions.findIndex(
              a => a.token.toLowerCase() === dealtCard,
            );
            if (cardActionIdx !== -1 && currentNode.children_ids[cardActionIdx]) {
              currentNode = await fetchNode(currentNode.children_ids[cardActionIdx]);
            } else {
              // Card not in tree (e.g. isomorphism compressed it) — stop here
              break;
            }
          }

          // ── 3. Process each action in this street ───────────────────
          for (const action of streetData.actions) {
            // Skip posting actions (blinds/antes) — not in solver tree
            if (
              action.action === "post_sb" ||
              action.action === "post_bb" ||
              action.action === "post_ante" ||
              action.action === "post_straddle"
            ) continue;

            if (currentNode.metadata.is_terminal) break;

            // Skip chance nodes mid-street (shouldn't happen, but guard)
            if (currentNode.metadata.node_type === "chance") continue;

            const matchedAction = matchAction(action, currentNode.available_actions);

            if (action.is_hero) {
              const topAction = [...currentNode.available_actions].sort(
                (a, b) => (b.frequency ?? 0) - (a.frequency ?? 0),
              )[0] ?? null;

              decisions.push({
                street: streetName,
                board: currentNode.board,
                potBb: currentNode.metadata.pot_size,
                heroAction: action,
                solverActions: currentNode.available_actions,
                matchedSolverAction: matchedAction,
                topSolverAction: topAction,
                heroActionFrequency: matchedAction?.frequency ?? null,
                heroActionEv: matchedAction
                  ? (currentNode.evs[matchedAction.token] ?? null)
                  : null,
                topActionEv: topAction
                  ? (currentNode.evs[topAction.token] ?? null)
                  : null,
                nodeId: currentNode.id,
              });
            }

            // Navigate to the matched child
            if (matchedAction) {
              const childIdx = currentNode.available_actions.findIndex(
                a => a.token === matchedAction.token,
              );
              const childId = currentNode.children_ids[childIdx];
              if (childId) {
                currentNode = await fetchNode(childId);
              } else {
                break;
              }
            } else {
              // No matching tree action — can't continue navigation
              break;
            }
          }

          // After processing all actions on this street, if the next node is
          // a chance node, it will be handled at the top of the next iteration.
        }

        setState({ decisions, loading: false, error: null });
      } catch (err) {
        setState({
          decisions: [],
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load walkthrough",
        });
      }
    },
    [session],
  );

  return { state, run, reset };
}
