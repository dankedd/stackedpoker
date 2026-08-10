import Link from "next/link";
import { Spade } from "lucide-react";
import { FOOTER_NAV } from "@/lib/seo/navigation";

/**
 * The shared app/content footer.
 *
 * Carries the site-wide resource links (§7): every public content page ends
 * with a path back to the wiki, the glossary, the curriculum and the free
 * tools. This is the cheapest internal-linking win available — it makes the
 * whole reference corpus reachable in one hop from any page a crawler lands
 * on, instead of only from the page that happened to link to it.
 */

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background">
      <div className="container mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-blue-500">
                <Spade aria-hidden="true" className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold tracking-tight">
                Stacked
                <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                  {" "}
                  Poker
                </span>
              </span>
            </Link>
            <p className="mt-3 max-w-[220px] text-xs leading-relaxed text-muted-foreground">
              Interactive Texas Hold&apos;em training — predict the decision, see the reveal,
              understand why it works.
            </p>
          </div>

          {FOOTER_NAV.map(({ group, items }) => (
            <nav key={group} aria-label={group}>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {group}
              </p>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="rounded text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border/40 pt-6 sm:flex-row">
          <p className="text-center text-xs text-muted-foreground">
            Educational tool only. Not a replacement for a real GTO solver. For training purposes
            only.
          </p>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Stacked Poker
          </p>
        </div>
      </div>
    </footer>
  );
}
