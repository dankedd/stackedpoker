"use client";

import Link from "next/link";

/** Section-level error state — keeps the header and footer in place. */
export default function PreflopTrainerError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
      <h1 className="text-xl font-semibold text-white">Something went wrong loading the trainer.</h1>
      <p className="mt-2 text-sm text-slate-400">Your record is saved. Try again, or come back in a moment.</p>
      <div className="mt-5 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center rounded-md bg-gradient-to-r from-violet-600 to-blue-500 px-5 text-sm font-semibold text-white shadow-md shadow-violet-900/30 hover:from-violet-500 hover:to-blue-400"
        >
          Try again
        </button>
        <Link href="/learn" className="inline-flex h-10 items-center rounded-md border border-border px-5 text-sm font-medium text-foreground hover:bg-accent">
          Back to Learn
        </Link>
      </div>
    </div>
  );
}
