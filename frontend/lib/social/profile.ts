import type { SkillStats } from "./stats";
import type { BadgeChip } from "@/components/social/UserBadges";

/** get_profile() (supabase/migrations/20261025_04_profiles_stats.sql). */
export interface ProfileBadge extends BadgeChip {
  description: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  earned_at: string;
}

export interface ProfileShare {
  slug: string;
  question: string | null;
  created_at: string;
  guess_mode: boolean;
  position: string | null;
  hero_cards: string[] | null;
  board: string[];
}

interface ProfileBase {
  id: string;
  handle: string;
  name: string;
  role: string;
  avatar: string | null;
}

export interface HiddenProfile extends ProfileBase {
  visible: false;
  profile_visibility: "friends" | "private";
  badges: BadgeChip[];
  banned: boolean;
}

export interface VisibleProfile extends ProfileBase {
  visible: true;
  is_owner: boolean;
  bio: string | null;
  sites: string[];
  member_since: string;
  profile_visibility: "public" | "friends" | "private";
  stats_visibility: "public" | "friends" | "private";
  stats_visible: boolean;
  stats: SkillStats | null;
  stats_refreshed_at: string | null;
  badges: ProfileBadge[];
  shares: ProfileShare[];
}

export type Profile = HiddenProfile | VisibleProfile;

/** Stale after an hour for visitors, five minutes for the owner (same rule as refresh_profile_stats()). */
export function statsStale(p: VisibleProfile, now = Date.now()): boolean {
  if (!p.stats_visible) return false;
  if (!p.stats_refreshed_at) return true;
  const age = now - new Date(p.stats_refreshed_at).getTime();
  return age > (p.is_owner ? 5 * 60_000 : 60 * 60_000);
}
