"use client";

import { useState, useCallback, useRef } from "react";
import {
  getSolverTree,
  getSolverNode,
  getSolverChildren,
  type SolverTreeMeta,
  type SolverNodeResponse,
  type SolverChildrenResponse,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// ── State types ─────────────────────────────────────────────────────────────

export interface SolverReplayState {
  currentNodeId: string | null;
  currentNode: SolverNodeResponse | null;
  /** Cached children of the current node (fetched on demand). */
  children: SolverNodeResponse[] | null;
  /** Human-readable action labels taken to reach current node. */
  actionHistory: string[];
  /** Stack of parent node IDs for back-navigation. */
  parentStack: string[];
  treeMeta: SolverTreeMeta | null;
  loading: boolean;
  error: string | null;
}

export interface UseSolverReplayReturn extends SolverReplayState {
  /** Initialize replay by loading tree meta + root node. */
  openTree: (jobId: string) => Promise<void>;
  /** Navigate to a child node by clicking an action. */
  navigateToChild: (childNodeId: string) => Promise<void>;
  /** Go back to the parent node. */
  navigateBack: () => Promise<void>;
  /** Jump to the root node. */
  navigateToRoot: () => Promise<void>;
  /** Fetch and cache children of the current node. */
  loadChildren: () => Promise<void>;
  /** Reset replay state. */
  reset: () => void;
  /** The job ID currently loaded. */
  jobId: string | null;
}

const INITIAL_STATE: SolverReplayState = {
  currentNodeId: null,
  currentNode: null,
  children: null,
  actionHistory: [],
  parentStack: [],
  treeMeta: null,
  loading: false,
  error: null,
};

export function useSolverReplay(): UseSolverReplayReturn {
  const { session } = useAuth();
  const [state, setState] = useState<SolverReplayState>(INITIAL_STATE);
  const [jobId, setJobId] = useState<string | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const getToken = useCallback(() => {
    const token = session?.access_token;
    if (!token) throw new Error("Not authenticated");
    return token;
  }, [session]);

  // ── Open tree: load meta + root ─────────────────────────────────────────

  const openTree = useCallback(
    async (jid: string) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      setJobId(jid);
      jobIdRef.current = jid;

      try {
        const token = getToken();
        const meta = await getSolverTree(jid, token);
        const rootNode = await getSolverNode(jid, meta.root_node_id, token);

        setState({
          currentNodeId: rootNode.id,
          currentNode: rootNode,
          children: null,
          actionHistory: [],
          parentStack: [],
          treeMeta: meta,
          loading: false,
          error: null,
        });
      } catch (e) {
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : "Failed to load solver tree",
        }));
      }
    },
    [getToken],
  );

  // ── Navigate to child ───────────────────────────────────────────────────

  const navigateToChild = useCallback(
    async (childNodeId: string) => {
      const jid = jobIdRef.current;
      if (!jid || !state.currentNode) return;

      setState((s) => ({ ...s, loading: true, error: null }));

      try {
        const token = getToken();
        const childNode = await getSolverNode(jid, childNodeId, token);

        // Find the action label that led to this child
        const actionIndex = state.currentNode.children_ids.indexOf(childNodeId);
        const action = state.currentNode.available_actions[actionIndex];
        const actionLabel = action?.label ?? `action-${actionIndex}`;

        setState((s) => ({
          ...s,
          currentNodeId: childNode.id,
          currentNode: childNode,
          children: null,
          actionHistory: [...s.actionHistory, actionLabel],
          parentStack: s.currentNodeId ? [...s.parentStack, s.currentNodeId] : s.parentStack,
          loading: false,
          error: null,
        }));
      } catch (e) {
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : "Failed to load child node",
        }));
      }
    },
    [state.currentNode, getToken],
  );

  // ── Navigate back ──────────────────────────────────────────────────────

  const navigateBack = useCallback(async () => {
    const jid = jobIdRef.current;
    if (!jid || state.parentStack.length === 0) return;

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const token = getToken();
      const parentId = state.parentStack[state.parentStack.length - 1];
      const parentNode = await getSolverNode(jid, parentId, token);

      setState((s) => ({
        ...s,
        currentNodeId: parentNode.id,
        currentNode: parentNode,
        children: null,
        actionHistory: s.actionHistory.slice(0, -1),
        parentStack: s.parentStack.slice(0, -1),
        loading: false,
        error: null,
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Failed to navigate back",
      }));
    }
  }, [state.parentStack, getToken]);

  // ── Navigate to root ───────────────────────────────────────────────────

  const navigateToRoot = useCallback(async () => {
    const jid = jobIdRef.current;
    if (!jid || !state.treeMeta) return;

    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const token = getToken();
      const rootNode = await getSolverNode(jid, state.treeMeta.root_node_id, token);

      setState({
        currentNodeId: rootNode.id,
        currentNode: rootNode,
        children: null,
        actionHistory: [],
        parentStack: [],
        treeMeta: state.treeMeta,
        loading: false,
        error: null,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Failed to navigate to root",
      }));
    }
  }, [state.treeMeta, getToken]);

  // ── Load children ──────────────────────────────────────────────────────

  const loadChildren = useCallback(async () => {
    const jid = jobIdRef.current;
    if (!jid || !state.currentNodeId) return;

    try {
      const token = getToken();
      const resp: SolverChildrenResponse = await getSolverChildren(
        jid, state.currentNodeId, token,
      );
      setState((s) => ({ ...s, children: resp.children }));
    } catch (e) {
      setState((s) => ({
        ...s,
        error: e instanceof Error ? e.message : "Failed to load children",
      }));
    }
  }, [state.currentNodeId, getToken]);

  // ── Reset ──────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    setJobId(null);
    jobIdRef.current = null;
  }, []);

  return {
    ...state,
    jobId,
    openTree,
    navigateToChild,
    navigateBack,
    navigateToRoot,
    loadChildren,
    reset,
  };
}
