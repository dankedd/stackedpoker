import { tierForLevel, TIER_STYLES } from "@/lib/levels";
import { LEVELS } from "@/lib/levels/strings";
import { cn } from "@/lib/utils";

/**
 * The small level badge shown next to a player's name (leaderboard, user
 * menu, and later chat/forum/groups). Tier color from lib/levels; the title
 * is optional, e.g. only on wider screens.
 */
export function LevelBadge({
  level,
  showTitle = false,
  titleClassName,
  className,
}: {
  level: number;
  /** Also show the tier title ("Grinder"). */
  showTitle?: boolean;
  /** e.g. "hidden sm:inline" to show the title from a breakpoint on. */
  titleClassName?: string;
  className?: string;
}) {
  const tier = tierForLevel(level);
  const style = TIER_STYLES[tier.color];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold leading-4 tabular-nums",
        style.badge,
        className,
      )}
      title={LEVELS.badgeLabel(level, tier.title)}
      aria-label={LEVELS.badgeLabel(level, tier.title)}
    >
      <span aria-hidden>{LEVELS.short(level)}</span>
      {showTitle && (
        <span aria-hidden className={cn("font-semibold opacity-80", titleClassName)}>
          · {tier.title}
        </span>
      )}
    </span>
  );
}
