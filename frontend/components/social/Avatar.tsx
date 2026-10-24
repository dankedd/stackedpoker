import { avatarUrl } from "@/lib/social/stats";
import { cn } from "@/lib/utils";

/** A user's uploaded photo, or their initials on a violet tile. Never the Google picture. */
export function Avatar({ path, name, size = 40, className }: { path?: string | null; name: string; size?: number; className?: string }) {
  const url = avatarUrl(path);
  const initials = name.replace(/^@/, "").replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className={cn("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-500 font-bold text-white", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </span>
  );
}
