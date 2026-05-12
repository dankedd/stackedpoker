"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Spade, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/layout/UserMenu";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Navigation config
// ─────────────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  primary?: boolean; // signals this is the core feature
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Analyze",   href: "/analyze", primary: true },
  { label: "Puzzles",   href: "/analyze/puzzles" },
  { label: "History",   href: "/history" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Active-state helper
// ─────────────────────────────────────────────────────────────────────────────

function useActiveItem(pathname: string) {
  return (item: NavItem): boolean => {
    if (item.href === "/analyze") {
      // Active for /analyze and sub-tools but NOT /analyze/puzzles
      return (
        pathname === "/analyze" ||
        pathname.startsWith("/analyze/hand") ||
        pathname.startsWith("/analyze/session") ||
        pathname.startsWith("/analyze/tournament")
      );
    }
    if (item.href === "/analyze/puzzles") {
      return pathname.startsWith("/analyze/puzzles");
    }
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Link style helpers
// ─────────────────────────────────────────────────────────────────────────────

function navLinkCls(active: boolean, primary?: boolean): string {
  if (active) {
    return primary
      ? "px-3 py-1.5 rounded-xl text-[13px] font-semibold text-violet-300 bg-violet-500/12 transition-all duration-150"
      : "px-3 py-1.5 rounded-xl text-[13px] font-medium text-white bg-white/[0.09] transition-all duration-150";
  }
  return primary
    ? "px-3 py-1.5 rounded-xl text-[13px] font-semibold text-slate-300 hover:text-violet-300 hover:bg-violet-500/10 transition-all duration-150"
    : "px-3 py-1.5 rounded-xl text-[13px] font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] transition-all duration-150";
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface NavbarProps {
  /** sticky = fixed + scroll-shrink (homepage). static = in-flow (inner pages). */
  variant?: "sticky" | "static";
}

export function Navbar({ variant = "sticky" }: NavbarProps) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isSticky = variant === "sticky";
  const isActive = useActiveItem(pathname);

  // Scroll listener (sticky only)
  useEffect(() => {
    if (!isSticky) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isSticky]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // ── Nav pill ──────────────────────────────────────────────────────────────
  const nav = (
    <nav
      className={cn(
        "w-full max-w-[920px] flex items-center justify-between",
        "rounded-2xl backdrop-blur-xl px-5 transition-all duration-300 ease-out",
        isSticky
          ? scrolled
            ? "py-2.5 bg-[#080D1A]/95 border border-white/[0.09] shadow-2xl shadow-black/50"
            : "py-3.5 bg-[#0D1526]/80 border border-white/[0.07] shadow-xl shadow-black/25"
          : "py-2.5 bg-[#080D1A]/95 border border-white/[0.09] shadow-xl shadow-black/40"
      )}
    >
      {/* ── Logo ── */}
      <Link href="/" className="flex items-center gap-2.5 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-blue-500 shadow-sm shadow-violet-500/30">
          <Spade className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="font-bold text-white tracking-tight text-sm">
          Stacked
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">
            {" "}Poker
          </span>
        </span>
      </Link>

      {/* ── Center links (desktop) ── */}
      <div className="hidden md:flex items-center gap-0.5">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={navLinkCls(isActive(item), item.primary)}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* ── Right side ── */}
      <div className="flex items-center gap-2 shrink-0">
        {!loading &&
          (user ? (
            <UserMenu />
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:block text-[13px] text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-xl hover:bg-white/[0.05]"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="text-[13px] font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-500 px-4 py-2 rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-violet-900/30"
              >
                Get started free
              </Link>
            </>
          ))}

        {/* Hamburger (mobile only) */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.07] transition-all"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>
    </nav>
  );

  // ── Mobile menu ───────────────────────────────────────────────────────────
  const mobileMenu = mobileOpen ? (
    <div className="md:hidden fixed inset-x-0 top-[68px] z-50 px-4">
      <div className="rounded-2xl border border-white/[0.09] bg-[#060B18]/98 backdrop-blur-xl shadow-2xl shadow-black/70 overflow-hidden">
        <nav className="p-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2.5 rounded-xl text-[13px] transition-all",
                item.primary ? "font-semibold" : "font-medium",
                isActive(item)
                  ? item.primary
                    ? "text-violet-300 bg-violet-500/12"
                    : "text-white bg-white/[0.09]"
                  : item.primary
                  ? "text-slate-300 hover:text-violet-300 hover:bg-violet-500/10"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {!loading && !user && (
          <div className="px-4 pb-4 pt-2 border-t border-white/[0.06] flex flex-col gap-2">
            <Link
              href="/login"
              className="block text-center text-[13px] text-slate-400 hover:text-white py-2 rounded-xl hover:bg-white/[0.05] transition-all"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="block text-center text-[13px] font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-500 px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
            >
              Get started free
            </Link>
          </div>
        )}
      </div>
    </div>
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  if (isSticky) {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4">
          {nav}
        </div>
        {mobileMenu}
      </>
    );
  }

  return (
    <>
      <div className="flex justify-center px-4 pt-4 w-full">
        {nav}
      </div>
      {mobileMenu}
    </>
  );
}
