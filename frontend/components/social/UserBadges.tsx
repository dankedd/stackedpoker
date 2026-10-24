import { cn } from "@/lib/utils";

export type BadgeChip = { id: string; icon: string; title: string };

/** The one or two badges shown next to a name (social_card().badges). */
export function UserBadges({ badges, className }: { badges?: BadgeChip[] | null; className?: string }) {
  if (!badges?.length) return null;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {badges.slice(0, 2).map((b) => (
        <span key={b.id} title={b.title} aria-label={b.title} role="img" className="text-[0.9em] leading-none">
          {b.icon}
        </span>
      ))}
    </span>
  );
}
