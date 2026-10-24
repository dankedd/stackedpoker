import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { UpgradeBanner } from "@/components/billing/UpgradeBanner";
import { TourTip } from "@/components/onboarding/TourLinks";
import { HandlePrompt } from "@/components/social/HandlePrompt";
import { LevelOverview } from "@/components/levels/LevelOverview";
import { Block, BlockSkeleton, EmptyState, HeroSkeleton } from "@/components/dashboard/Block";
import { TodayHero } from "@/components/dashboard/TodayHero";
import { SkillCard } from "@/components/dashboard/SkillCard";
import { LeaksCard } from "@/components/dashboard/LeaksCard";
import { FriendsActivity } from "@/components/dashboard/FriendsActivity";
import { CommunityBlock } from "@/components/dashboard/CommunityBlock";
import { DashboardFooter } from "@/components/dashboard/DashboardFooter";
import { loadDashboard, type DashboardLoad } from "@/lib/dashboard/load";
import { pickHero } from "@/lib/dashboard/hero";
import { leakView, planLine, skillView } from "@/lib/dashboard/model";
import { DASH } from "@/lib/dashboard/strings";
import { canUseFeature, socialPhaseOn } from "@/lib/features";
import { LEVELS } from "@/lib/levels/strings";
import { PREFLOP_TRAINER_PATH } from "@/lib/ranges/feature";
import { getSiteUrl } from "@/lib/site-url";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * /dashboard — three questions: what do I do today (hero), how am I doing
 * (level, skill, leaks), what are my friends up to (social blocks, when their
 * phase is live). Every block loads from one parallel fetch
 * (lib/dashboard/load.ts) and streams in behind its own skeleton.
 */

interface Me {
  name: string;
  tier: string;
  handle: string | null;
  /** Social on and no username yet. */
  needsHandle: boolean;
}

async function loadMe(supabase: SupabaseClient, userId: string, email: string | undefined): Promise<Me> {
  const [base, name, handle] = await Promise.all([
    supabase.from("profiles").select("username, subscription_tier").eq("id", userId).maybeSingle(),
    // Separate queries: these columns come from later migrations (display name, social).
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.from("profiles").select("handle").eq("id", userId).maybeSingle(),
  ]);
  const tier = (base.data?.subscription_tier as string | undefined) ?? "free";
  const h = handle.error ? null : ((handle.data?.handle as string | null | undefined) ?? null);
  return {
    // Private greeting: the public name when set, else the old username.
    name: (name.data?.display_name as string | null | undefined) ?? (base.data?.username as string | undefined) ?? email?.split("@")[0] ?? "Player",
    tier,
    handle: h,
    // A failed read (migration not run yet) reads as "has one", so the card never shows by mistake.
    needsHandle: canUseFeature("social", tier) && !handle.error && !h,
  };
}

async function HeroBlock({ load, me }: { load: DashboardLoad; me: Promise<Me> }) {
  const [data, ent, streak, m] = await Promise.all([load.data, load.entitlements, load.streak, me]);
  const hero = pickHero({
    spotsToday: ent?.usage.trainerHandsToday ?? null,
    dailyLimit: ent?.limits.trainerHandsPerDay ?? null,
    resetAt: ent?.dailyResetAt ?? null,
    handsImported: data?.hands.imported ?? 0,
    last: data?.lastTournament ?? null,
    now: Date.now(),
  });
  return <TodayHero name={m.name} hero={hero} streak={streak} hasTournament={Boolean(data?.lastTournament)} />;
}

async function HandleBlock({ me }: { me: Promise<Me> }) {
  return (await me).needsHandle ? <HandlePrompt /> : null;
}

async function LevelBlock({ load }: { load: DashboardLoad }) {
  const xp = await load.xp;
  if (!xp) {
    return (
      <Block title={LEVELS.heading}>
        <EmptyState text={DASH.levelEmpty} cta={LEVELS.train} href={PREFLOP_TRAINER_PATH} />
      </Block>
    );
  }
  return <LevelOverview initial={xp} />;
}

async function SkillBlock({ load }: { load: DashboardLoad }) {
  const data = await load.data;
  if (!data) return <ErrorBlock title={DASH.skill.heading} />;
  return <SkillCard view={skillView(data.skill)} />;
}

async function LeaksBlock({ load, me }: { load: DashboardLoad; me: Promise<Me> }) {
  const [data, m] = await Promise.all([load.data, me]);
  if (!data) return <ErrorBlock title={DASH.leaks.heading} />;
  return <LeaksCard leaks={data.leaks.map(leakView)} hasHands={data.hands.imported > 0 || data.leaks.length > 0} canShare={socialPhaseOn("sharing", m.tier)} />;
}

async function SocialBlocks({ load, me }: { load: DashboardLoad; me: Promise<Me> }) {
  const [data, m] = await Promise.all([load.data, me]);
  const on = (p: Parameters<typeof socialPhaseOn>[0]) => socialPhaseOn(p, m.tier);
  const social = data?.social;
  if (!social) return null;
  const sharing = on("sharing");
  const friends = on("friends");
  const community = { forum: on("forum"), groups: on("groups"), growth: on("growth") };
  const inviteUrl = m.handle ? `${getSiteUrl()}/signup?utm_source=invite&utm_medium=friend&utm_content=${encodeURIComponent(m.handle)}` : null;
  return (
    <>
      {(sharing || friends) && <FriendsActivity social={social} sharing={sharing} friends={friends} inviteUrl={inviteUrl} />}
      {(community.forum || community.groups || community.growth) && (
        <CommunityBlock community={social.community ?? {}} {...community} />
      )}
    </>
  );
}

async function FooterBlock({ load, memberSince }: { load: DashboardLoad; memberSince: string }) {
  const [data, ent] = await Promise.all([load.data, load.entitlements]);
  return (
    <DashboardFooter
      plan={planLine(ent)}
      memberSince={memberSince}
      hands={data ? data.hands.imported : null}
      tournaments={data ? data.hands.tournaments : null}
    />
  );
}

function ErrorBlock({ title }: { title: string }) {
  return (
    <Block title={title}>
      <EmptyState text={DASH.error} cta={DASH.retry} href="/dashboard" />
    </Block>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Everything starts now, in parallel; each block awaits only its part.
  const load = loadDashboard(supabase);
  const me = loadMe(supabase, user.id, user.email);
  const memberSince = new Date(user.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />

      <main className="container mx-auto max-w-5xl space-y-4 px-4 py-4 sm:space-y-5 sm:px-6 sm:py-8 page-enter">
        {/* Success banner (client — reads ?upgraded=1) */}
        <UpgradeBanner />

        <Suspense fallback={<HeroSkeleton />}>
          <HeroBlock load={load} me={me} />
        </Suspense>

        {/* Hand Review tour, until it's done or dismissed */}
        <TourTip only="hands" className="" />

        <Suspense fallback={null}>
          <HandleBlock me={me} />
        </Suspense>

        <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
          <Suspense fallback={<BlockSkeleton title={LEVELS.heading} rows={3} />}>
            <LevelBlock load={load} />
          </Suspense>
          <Suspense fallback={<BlockSkeleton title={DASH.skill.heading} rows={4} />}>
            <SkillBlock load={load} />
          </Suspense>
        </div>

        <Suspense fallback={<BlockSkeleton title={DASH.leaks.heading} rows={2} />}>
          <LeaksBlock load={load} me={me} />
        </Suspense>

        <Suspense fallback={null}>
          <SocialBlocks load={load} me={me} />
        </Suspense>

        <Suspense fallback={null}>
          <FooterBlock load={load} memberSince={memberSince} />
        </Suspense>
      </main>
    </div>
  );
}
