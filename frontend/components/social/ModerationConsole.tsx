"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { MODERATION, REPORT_REASONS, socialErrorMessage } from "@/lib/social/strings";
import { cn } from "@/lib/utils";

type Card = { id: string | null; handle: string | null; name: string; role: string; deleted: boolean; banned_until?: string | null };
type Report = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reporter: Card;
  owner: Card;
  target: Record<string, unknown> | null;
  open_reports: number;
};
type FoundUser = {
  id: string;
  handle: string | null;
  name: string;
  role: string;
  banned_until: string | null;
  ban_reason: string | null;
  created_at: string;
  open_reports: number;
};
type Tab = "open" | "actioned" | "dismissed" | "users";

const PAGE = 30;
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
const isForever = (iso: string | null | undefined) => !!iso && (iso === "infinity" || new Date(iso).getFullYear() > 9000);

function banLabel(until: string | null | undefined): string | null {
  if (!until) return null;
  if (isForever(until)) return MODERATION.bannedForever;
  return new Date(until) > new Date() ? MODERATION.bannedUntil(fmt(until)) : null;
}

function who(c: Card) {
  return c.deleted ? c.name : c.handle ? `@${c.handle}` : c.name;
}

export function ModerationConsole({ isAdmin }: { isAdmin: boolean }) {
  const [tab, setTab] = useState<Tab>("open");
  return (
    <div>
      <div role="tablist" className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-border/60 p-1">
        {(Object.keys(MODERATION.tabs) as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "h-9 flex-1 whitespace-nowrap rounded-md px-3 text-sm font-medium",
              tab === t ? "bg-[#7C5CFF] text-white" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {MODERATION.tabs[t]}
          </button>
        ))}
      </div>
      {tab === "users" ? <UserSearch isAdmin={isAdmin} /> : <ReportList key={tab} status={tab} />}
    </div>
  );
}

async function call(fn: string, args: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await createClient().rpc(fn, args);
  const res = data as { ok?: boolean; error?: string } | null;
  if (error || !res?.ok) {
    toast.error(error ? socialErrorMessage(error.message) : socialErrorMessage(res?.error));
    return false;
  }
  toast.success(MODERATION.done);
  return true;
}

function banArgs(user: string, days: number | null) {
  return { p_user: user, p_until: days === null ? null : new Date(Date.now() + days * 86_400_000).toISOString(), p_reason: null };
}

function ReportList({ status }: { status: Exclude<Tab, "users"> }) {
  const [rows, setRows] = useState<Report[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (before: string | null, replace: boolean) => {
      setLoading(true);
      const { data, error } = await createClient().rpc("mod_list_reports", { p_status: status, p_before: before, p_limit: PAGE });
      setLoading(false);
      if (error) {
        toast.error(MODERATION.failed);
        return;
      }
      const page = (data ?? []) as Report[];
      setRows((r) => (replace ? page : [...r, ...page]));
      setDone(page.length < PAGE);
    },
    [status],
  );

  useEffect(() => {
    load(null, true);
  }, [load]);

  const refresh = () => load(null, true);

  if (!loading && rows.length === 0) return <p className="text-sm text-muted-foreground">{MODERATION.empty}</p>;

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <ReportCard key={r.id} r={r} onChange={refresh} />
      ))}
      {!done && (
        <button
          type="button"
          disabled={loading}
          onClick={() => load(rows[rows.length - 1]?.created_at ?? null, false)}
          className="h-10 w-full rounded-lg border border-border/60 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {MODERATION.loadMore}
        </button>
      )}
    </div>
  );
}

function ReportCard({ r, onChange }: { r: Report; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const run = async (fn: string, args: Record<string, unknown>) => {
    setBusy(true);
    if (await call(fn, args)) onChange();
    setBusy(false);
  };
  const hiddenAt = typeof r.target?.hidden_at === "string" ? r.target.hidden_at : null;
  const ban = banLabel(r.owner.banned_until);
  const preview = Object.entries(r.target ?? {}).filter(([k, v]) => k !== "hidden_at" && v !== null && v !== "");

  return (
    <article className="rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="rounded-full bg-red-500/10 px-2 py-0.5 font-semibold text-red-400">{REPORT_REASONS[r.reason] ?? r.reason}</span>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5">{r.target_type}</span>
        <span>{fmt(r.created_at)}</span>
        {r.open_reports > 1 && <span className="font-semibold text-amber-400">{MODERATION.openReports(r.open_reports)}</span>}
        {hiddenAt && <span className="font-semibold text-amber-400">{MODERATION.hidden}</span>}
        {ban && <span className="font-semibold text-red-400">{ban}</span>}
      </div>

      <dl className="mt-3 space-y-1 text-sm">
        {preview.length ? (
          preview.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-24 shrink-0 text-muted-foreground">{k}</dt>
              <dd className="min-w-0 break-words text-foreground">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">{MODERATION.empty}</p>
        )}
      </dl>
      {r.details && <p className="mt-2 rounded-lg bg-white/[0.03] p-2 text-sm text-muted-foreground">“{r.details}”</p>}

      <p className="mt-2 text-xs text-muted-foreground">
        {MODERATION.owner}: <span className="text-foreground">{who(r.owner)}</span> · {MODERATION.reportedBy}:{" "}
        <span className="text-foreground">{who(r.reporter)}</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {r.target_type !== "user" &&
          (hiddenAt ? (
            <Action busy={busy} onClick={() => run("mod_set_hidden", { p_type: r.target_type, p_id: r.target_id, p_hidden: false, p_reason: null })}>
              {MODERATION.actions.unhide}
            </Action>
          ) : (
            <Action danger busy={busy} onClick={() => run("mod_set_hidden", { p_type: r.target_type, p_id: r.target_id, p_hidden: true, p_reason: r.reason })}>
              {MODERATION.actions.hide}
            </Action>
          ))}
        {r.status === "open" ? (
          <Action busy={busy} onClick={() => run("mod_resolve_report", { p_report: r.id, p_status: "dismissed", p_note: null })}>
            {MODERATION.actions.dismiss}
          </Action>
        ) : (
          <Action busy={busy} onClick={() => run("mod_resolve_report", { p_report: r.id, p_status: "open", p_note: null })}>
            {MODERATION.actions.reopen}
          </Action>
        )}
        {r.owner.id && <BanButtons userId={r.owner.id} bannedUntil={r.owner.banned_until ?? null} busy={busy} run={run} />}
      </div>
    </article>
  );
}

function BanButtons({
  userId,
  bannedUntil,
  busy,
  run,
}: {
  userId: string;
  bannedUntil: string | null;
  busy: boolean;
  run: (fn: string, args: Record<string, unknown>) => void;
}) {
  if (banLabel(bannedUntil)) {
    return (
      <Action busy={busy} onClick={() => run("mod_unban_user", { p_user: userId })}>
        {MODERATION.actions.unban}
      </Action>
    );
  }
  return (
    <>
      <Action danger busy={busy} onClick={() => run("mod_ban_user", banArgs(userId, 1))}>
        {MODERATION.actions.ban1d}
      </Action>
      <Action danger busy={busy} onClick={() => run("mod_ban_user", banArgs(userId, 7))}>
        {MODERATION.actions.ban7d}
      </Action>
      <Action
        danger
        busy={busy}
        onClick={() => {
          if (window.confirm(MODERATION.confirmBanForever)) run("mod_ban_user", banArgs(userId, null));
        }}
      >
        {MODERATION.actions.banForever}
      </Action>
    </>
  );
}

function UserSearch({ isAdmin }: { isAdmin: boolean }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<FoundUser[]>([]);
  const [busy, setBusy] = useState(false);

  const search = useCallback(async (query: string) => {
    const { data, error } = await createClient().rpc("mod_find_users", { p_query: query });
    if (error) toast.error(MODERATION.failed);
    else setRows((data ?? []) as FoundUser[]);
  }, []);

  const run = async (fn: string, args: Record<string, unknown>) => {
    setBusy(true);
    if (await call(fn, args)) await search(q);
    setBusy(false);
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(q);
        }}
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={MODERATION.searchPlaceholder}
          style={{ fontSize: "16px" }}
          className="h-10 w-full rounded-lg border border-border/60 bg-background/60 px-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
        />
      </form>
      <div className="mt-4 space-y-3">
        {rows.map((u) => {
          const ban = banLabel(u.banned_until);
          return (
            <article key={u.id} className="rounded-xl border border-border/60 bg-card/60 p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-foreground">{u.handle ? `@${u.handle}` : u.name}</span>
                {u.handle && <span className="text-muted-foreground">{u.name}</span>}
                {u.role !== "user" && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs text-violet-300">{u.role}</span>}
                {ban && <span className="text-xs font-semibold text-red-400">{ban}</span>}
                {u.open_reports > 0 && <span className="text-xs font-semibold text-amber-400">{MODERATION.openReports(u.open_reports)}</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <BanButtons userId={u.id} bannedUntil={u.banned_until} busy={busy} run={run} />
                {isAdmin && u.role !== "admin" && (
                  <Action busy={busy} onClick={() => run("mod_set_role", { p_user: u.id, p_role: u.role === "moderator" ? "user" : "moderator" })}>
                    {u.role === "moderator" ? MODERATION.actions.makeUser : MODERATION.actions.makeModerator}
                  </Action>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Action({ children, onClick, busy, danger }: { children: React.ReactNode; onClick: () => void; busy: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "h-9 rounded-lg border px-3 text-sm font-medium disabled:opacity-50",
        danger ? "border-red-500/40 text-red-400 hover:bg-red-500/10" : "border-border/60 text-foreground hover:bg-white/[0.04]",
      )}
    >
      {children}
    </button>
  );
}
