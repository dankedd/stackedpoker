import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Flame, Lock, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Avatar } from "@/components/social/Avatar";
import { UserBadges } from "@/components/social/UserBadges";
import { ReportButton } from "@/components/social/ReportButton";
import { SkillCard } from "@/components/social/profile/SkillCard";
import { StatsRefresher } from "@/components/social/profile/StatsRefresher";
import { MiniCards } from "@/components/hand-history/MiniCards";
import { statsStale, type Profile, type VisibleProfile } from "@/lib/social/profile";
import { avatarUrl } from "@/lib/social/stats";
import { PROFILE, SHARED_HAND } from "@/lib/social/strings";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ handle: string }> };

const HANDLE_RE = /^@?[A-Za-z0-9_]{3,20}$/;

const loadProfile = cache(async (raw: string): Promise<Profile | null> => {
  const handle = decodeURIComponent(raw);
  if (!HANDLE_RE.test(handle)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_profile", { p_handle: handle });
  return (data ?? null) as Profile | null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const p = await loadProfile(handle);
  if (!p) return { title: PROFILE.notFound, robots: { index: false, follow: false } };
  const name = `@${p.handle}`;
  // Only public profiles may be indexed.
  const indexable = p.visible && p.profile_visibility === "public";
  const image = avatarUrl(p.avatar);
  return {
    title: PROFILE.metaTitle(name),
    description: PROFILE.metaDescription(name),
    alternates: { canonical: `${getSiteUrl()}/u/${p.handle}` },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { title: PROFILE.metaTitle(name), description: PROFILE.metaDescription(name), ...(image ? { images: [image] } : {}) },
  };
}

export default async function ProfilePage({ params }: Props) {
  const { handle } = await params;
  const p = await loadProfile(handle);
  if (!p) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const owner = p.visible && p.is_owner;

  return (
    <div className="min-h-dvh bg-background">
      <Navbar variant="static" />
      <main className="container mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex items-start gap-4" data-profile-header>
          <Avatar path={p.avatar} name={p.name} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-x-2 text-2xl font-bold text-foreground">
              <span className="truncate">{p.name}</span>
              <UserBadges badges={p.badges} className="text-xl" />
            </h1>
            <p className="text-sm text-muted-foreground">@{p.handle}</p>
            {p.visible && (
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{PROFILE.memberSince(new Date(p.member_since).toLocaleDateString("en-US", { month: "long", year: "numeric" }))}</span>
                {(p.stats?.day_streak ?? 0) > 1 && (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <Flame className="h-3.5 w-3.5" /> {PROFILE.dayStreak(p.stats!.day_streak)}
                  </span>
                )}
              </p>
            )}
          </div>
          {owner ? (
            <Link
              href="/settings#profile"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border/60 px-3 text-sm text-foreground hover:bg-white/[0.04]"
            >
              <Pencil className="h-4 w-4" /> <span className="hidden sm:inline">{PROFILE.edit}</span>
            </Link>
          ) : (
            user && <ReportButton targetType="profile" targetId={p.id} className="shrink-0" />
          )}
        </header>

        {p.visible ? <VisibleBody p={p} /> : <HiddenNotice friendsOnly={p.profile_visibility === "friends"} />}
      </main>
    </div>
  );
}

function HiddenNotice({ friendsOnly }: { friendsOnly: boolean }) {
  return (
    <section className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/40 p-5">
      <Lock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
      <div>
        <h2 className="font-semibold text-foreground">{friendsOnly ? PROFILE.friendsOnlyTitle : PROFILE.privateTitle}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{PROFILE.privateBody}</p>
      </div>
    </section>
  );
}

function VisibleBody({ p }: { p: VisibleProfile }) {
  return (
    <>
      {statsStale(p) && <StatsRefresher handle={p.handle} />}
      {p.is_owner && (
        <p className="text-xs text-muted-foreground">
          {PROFILE.ownerVisibility(PROFILE.visibility[p.profile_visibility], PROFILE.visibility[p.stats_visibility])}
        </p>
      )}
      {(p.bio || p.sites.length > 0) && (
        <section className="space-y-2">
          {p.bio && <p className="whitespace-pre-line text-sm text-foreground">{p.bio}</p>}
          {p.sites.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {p.sites.map((s) => (
                <li key={s} className="rounded-full border border-border/60 px-2.5 py-0.5 text-xs text-muted-foreground">
                  {PROFILE.sites[s] ?? s}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!p.stats_visible ? (
        <p className="rounded-2xl border border-border/60 bg-card/40 p-5 text-sm text-muted-foreground">{PROFILE.statsHidden}</p>
      ) : p.stats ? (
        <SkillCard stats={p.stats} refreshedAt={p.stats_refreshed_at} />
      ) : (
        <p className="rounded-2xl border border-border/60 bg-card/40 p-5 text-sm text-muted-foreground">{PROFILE.statsComputing}</p>
      )}

      <section aria-labelledby="badges-title">
        <h2 id="badges-title" className="mb-2 font-semibold text-foreground">
          {PROFILE.badges}
        </h2>
        {p.badges.length ? (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-badges>
            {p.badges.map((b) => (
              <li key={b.id} className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/40 p-3">
                <span className="text-2xl leading-none" aria-hidden>
                  {b.icon}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{b.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{b.description}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{PROFILE.noBadges}</p>
        )}
      </section>

      {p.shares.length > 0 && (
        <section aria-labelledby="shares-title">
          <h2 id="shares-title" className="mb-2 font-semibold text-foreground">
            {PROFILE.sharedHands}
          </h2>
          <ul className="space-y-2">
            {p.shares.map((s) => (
              <li key={s.slug}>
                <Link href={`/h/${s.slug}`} className="block rounded-xl border border-border/60 bg-card/40 p-3 transition hover:bg-card/70">
                  <p className="truncate text-sm font-medium text-foreground">{s.question || SHARED_HAND.defaultQuestion}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {s.position && <span className="font-semibold text-violet-300">{s.position}</span>}
                    <MiniCards cards={s.hero_cards} />
                    {s.board.length > 0 && <MiniCards cards={s.board} />}
                    {s.guess_mode && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-violet-200">{PROFILE.guess}</span>}
                    <span className="ml-auto">{new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
