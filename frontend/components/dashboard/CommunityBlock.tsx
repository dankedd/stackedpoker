import Link from "next/link";
import { Swords, Trophy, Users } from "lucide-react";
import type { Community } from "@/lib/dashboard/types";
import { DASH } from "@/lib/dashboard/strings";
import { shortDate } from "@/lib/dashboard/model";
import { SHARED_HAND } from "@/lib/social/strings";
import { Block, EmptyState } from "./Block";
import { FeedVote } from "./FeedVote";

const C = DASH.community;

function Sub({ icon: Icon, children }: { icon: typeof Trophy; children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {children}
    </h3>
  );
}

/**
 * Block 5 — Community (social phases 4–6): hand of the week (forum), my
 * groups (groups), open challenges (growth). Each part shows when its phase
 * is on; the data comes from those phases (DashboardData.social.community).
 */
export function CommunityBlock({
  community,
  forum,
  groups,
  growth,
}: {
  community: Community;
  forum: boolean;
  groups: boolean;
  growth: boolean;
}) {
  const how = community.handOfWeek;
  return (
    <Block title={C.heading}>
      <div className="grid gap-5 md:grid-cols-3">
        {forum && (
          <div className="min-w-0">
            <Sub icon={Trophy}>{C.handOfWeek}</Sub>
            {how ? (
              <>
                <Link href={`/h/${how.slug}`} className="block truncate text-sm font-medium text-foreground hover:underline">
                  {how.question ?? SHARED_HAND.defaultQuestion}
                </Link>
                <FeedVote slug={how.slug} options={how.options} myChoice={how.myChoice} votes={how.votes} />
              </>
            ) : (
              <EmptyState text={C.handOfWeekEmpty} cta={C.handOfWeekEmptyCta} href="/forum" />
            )}
          </div>
        )}
        {groups && (
          <div className="min-w-0">
            <Sub icon={Users}>{C.groups}</Sub>
            {community.groups?.length ? (
              <ul className="divide-y divide-border/40">
                {community.groups.map((g) => (
                  <li key={g.id} className="py-2">
                    <Link href={`/groups/${g.id}`} className="flex items-baseline justify-between gap-2 text-sm hover:underline">
                      <span className="truncate font-medium text-foreground">{g.name}</span>
                      {g.rank !== null && <span className="shrink-0 tabular-nums text-violet-200">{C.rank(g.rank, g.members)}</span>}
                    </Link>
                    {g.weeklyHand && (
                      <Link href={`/h/${g.weeklyHand}`} className="text-xs text-muted-foreground hover:text-foreground">
                        {C.weeklyHand}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState text={C.groupsEmpty} cta={C.groupsEmptyCta} href="/groups" />
            )}
          </div>
        )}
        {growth && (
          <div className="min-w-0">
            <Sub icon={Swords}>{C.challenges}</Sub>
            {community.challenges?.length ? (
              <ul className="space-y-2.5">
                {community.challenges.map((c) => (
                  <li key={c.id}>
                    <p className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium text-foreground">{c.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{C.endsIn(shortDate(c.endsAt))}</span>
                    </p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full bg-violet-400" style={{ width: `${Math.min(100, (100 * c.progress) / Math.max(1, c.goal))}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState text={C.challengesEmpty} cta={C.challengesEmptyCta} href="/groups" />
            )}
          </div>
        )}
      </div>
    </Block>
  );
}
