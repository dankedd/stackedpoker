import Link from "next/link";
import { Bell, Eye, Flame, MessageCircle, Share2, Users, Vote } from "lucide-react";
import type { FeedItem, MyShare, Social } from "@/lib/dashboard/types";
import { DASH } from "@/lib/dashboard/strings";
import { HANDS_PATH } from "@/lib/handHistory/feature";
import { SHARED_HAND } from "@/lib/social/strings";
import { Block, EmptyState } from "./Block";
import { FeedVote } from "./FeedVote";
import { InviteCard } from "./InviteCard";

const S = DASH.social;
const who = (c: { handle: string | null; name: string }) => (c.handle ? `@${c.handle}` : c.name);

function FeedRow({ item }: { item: FeedItem }) {
  if (item.kind === "streak") {
    return (
      <li className="flex items-center gap-2.5 py-2.5 text-sm">
        <Flame aria-hidden className="h-4 w-4 shrink-0 text-orange-300" />
        <span className="text-foreground">{S.streak(who(item.actor), item.streak)}</span>
      </li>
    );
  }
  return (
    <li className="py-2.5">
      <Link href={`/h/${item.slug}`} className="block text-sm hover:underline">
        <span className="font-semibold text-foreground">{S.sharedHand(who(item.actor))}</span>
        <span className="block truncate text-muted-foreground">{item.question ?? SHARED_HAND.defaultQuestion}</span>
      </Link>
      {item.guessMode && item.options && item.options.length >= 2 && (
        <FeedVote slug={item.slug} options={item.options} myChoice={item.myChoice} votes={item.votes} />
      )}
    </li>
  );
}

function ShareRow({ s }: { s: MyShare }) {
  const topPct = s.top && s.votes > 0 ? Math.round((100 * s.top[1]) / s.votes) : null;
  return (
    <li className="py-2.5">
      <Link href={`/h/${s.slug}`} className="block text-sm hover:underline">
        <span className="block truncate font-medium text-foreground">{s.question ?? S.shareFallback}</span>
      </Link>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Eye aria-hidden className="h-3 w-3" />
          {S.views(s.views)}
        </span>
        {s.guessMode && (
          <span className="inline-flex items-center gap-1">
            <Vote aria-hidden className="h-3 w-3" />
            {S.votes(s.votes)}
          </span>
        )}
        {s.guessMode &&
          (s.top && topPct !== null ? (
            <span className="text-violet-200">{S.topChoice(SHARED_HAND.choice[s.top[0]] ?? s.top[0], topPct)}</span>
          ) : (
            <span>{S.noVotes}</span>
          ))}
      </p>
    </li>
  );
}

function Inbox({ social }: { social: Social }) {
  const rows: { icon: typeof Bell; label: string; href: string }[] = [];
  if (social.requests.length) rows.push({ icon: Users, label: S.requests(social.requests.length), href: "/friends" });
  let other = 0;
  for (const [type, n] of Object.entries(social.unread)) {
    if (type === "friend_request") continue;
    if (/message|dm/.test(type)) rows.push({ icon: MessageCircle, label: S.unread.message(n), href: "/messages" });
    else if (/comment/.test(type)) rows.push({ icon: MessageCircle, label: S.unread.comment(n), href: "/notifications" });
    else other += n;
  }
  if (other) rows.push({ icon: Bell, label: S.unread.other(other), href: "/notifications" });
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold text-muted-foreground">{S.inbox}</h3>
      {rows.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">{S.inboxEmpty}</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {rows.map((r) => (
            <li key={r.label}>
              <Link href={r.href} className="flex items-center gap-2.5 py-2.5 text-sm font-medium text-foreground hover:text-violet-200">
                <r.icon aria-hidden className="h-4 w-4 shrink-0 text-violet-300" />
                {r.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Block 4 — Friends & activity. Each part follows its own social phase
 * (lib/features.ts SOCIAL_PHASES): "Your shared hands" with sharing, the
 * feed, inbox and invite with friends.
 */
export function FriendsActivity({
  social,
  sharing,
  friends,
  inviteUrl,
}: {
  social: Social;
  sharing: boolean;
  friends: boolean;
  inviteUrl: string | null;
}) {
  return (
    <Block title={S.heading}>
      <div className={friends ? "grid gap-4 md:grid-cols-2" : ""}>
        {friends && (
          <div className="min-w-0">
            {social.feed.length > 0 ? (
              <div>
                <h3 className="mb-1 text-xs font-semibold text-muted-foreground">{S.feed}</h3>
                <ul className="divide-y divide-border/40">
                  {social.feed.slice(0, 5).map((f) => (
                    <FeedRow key={f.kind === "share" ? f.slug : `${f.actor.id}-${f.streak}`} item={f} />
                  ))}
                </ul>
              </div>
            ) : inviteUrl ? (
              // No friends yet, or nothing from them lately.
              <InviteCard url={inviteUrl} />
            ) : (
              <EmptyState text={S.invite.needHandle} cta={S.invite.needHandleCta} href="/settings" />
            )}
          </div>
        )}
        <div className="min-w-0 space-y-4">
          {friends && <Inbox social={social} />}
          {sharing && (
            <div>
              <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Share2 aria-hidden className="h-3.5 w-3.5" />
                {S.myShares}
              </h3>
              {social.shares.length === 0 ? (
                <EmptyState text={S.sharesEmpty} cta={S.sharesEmptyCta} href={HANDS_PATH} />
              ) : (
                <ul className="divide-y divide-border/40">
                  {social.shares.map((s) => (
                    <ShareRow key={s.slug} s={s} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </Block>
  );
}
