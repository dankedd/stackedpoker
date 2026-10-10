"use client";

/**
 * Promise wrapper around the equity worker. One worker per page, created on
 * first use; a newer request does not cancel an older one, callers ignore
 * stale answers themselves.
 */

import type { RangeEquity, WeightedRange } from "./rangeEquity";
import type { EquityRequest, EquityResponse } from "./protocol";
import { t } from "@/lib/handHistory/strings";

type Pending = { resolve: (r: EquityResponse) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./equity.worker.ts", import.meta.url));
  worker.onmessage = (e: MessageEvent<EquityResponse>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.type === "error") p.reject(new Error(e.data.message));
    else p.resolve(e.data);
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || t.equity.failed));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;

function send(req: WithoutId<EquityRequest>): Promise<EquityResponse> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...req, id } as EquityRequest);
  });
}

/** Hero's equity against `range` on each board (one result per board). */
export async function equityOnBoards(hero: [string, string], range: WeightedRange, boards: string[][]): Promise<(RangeEquity | null)[]> {
  const r = await send({ type: "equity", hero, range, boards });
  if (r.type !== "equity") throw new Error("unexpected equity response");
  return r.results;
}

/** The 169 hand classes, strongest first by equity against a random hand. */
export async function handRanking(): Promise<string[]> {
  const r = await send({ type: "ranking" });
  if (r.type !== "ranking") throw new Error("unexpected ranking response");
  return r.order;
}
