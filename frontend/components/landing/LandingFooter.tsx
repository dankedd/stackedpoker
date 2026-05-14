import Link from "next/link";
import { Spade } from "lucide-react";

const LINKS = {
  Product: [
    { label: "Analyze Hand",  href: "/analyze" },
    { label: "Dashboard",     href: "/dashboard" },
    { label: "Features",      href: "/#features" },
    { label: "How It Works",  href: "/#how-it-works" },
  ],
  Account: [
    { label: "Sign in",     href: "/login" },
    { label: "Get started", href: "/signup" },
  ],
  Legal: [
    { label: "Privacy Policy",    href: "/privacy" },
    { label: "Terms of Service",  href: "/terms" },
    { label: "Educational use",   href: "/terms#disclaimer" },
  ],
};

export function LandingFooter() {
  return (
    <footer className="bg-[#070B14] border-t border-white/[0.05]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-blue-500">
                <Spade className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-bold text-white text-sm tracking-tight">
                Stacked<span className="text-violet-400"> Poker</span>
              </span>
            </Link>
            <p className="text-[13px] text-slate-500 leading-relaxed max-w-[200px]">
              GTO-inspired analysis and AI coaching for serious poker players.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([group, items]) => (
            <div key={group}>
              <p className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-slate-500">
                {group}
              </p>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-[13px] text-slate-500 hover:text-slate-300 transition-colors duration-150"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-slate-600">
          <p>© {new Date().getFullYear()} Stacked Poker — Educational tool only. Not a gambling service.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-slate-400 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-slate-400 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
