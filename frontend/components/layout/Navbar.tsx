"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Spade, ChevronDown, BarChart2, Trophy, Menu, X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/layout/UserMenu";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Navigation config
// ─────────────────────────────────────────────────────────────────────────────

const ANALYZE_SUBITEMS = [
  {
    label: "Hand Analysis",
    href: "/analyze/hand",
    icon: Spade,
    desc: "Single hand deep dive",
  },
  {
    label: "Session Analysis",
    href: "/analyze/session",
    icon: BarChart2,
    desc: "Full session review",
  },
  {
    label: "Tournament",
    href: "/analyze/tournament",
    icon: Trophy,
    desc: "MTT & SNG decisions",
  },
] as const;

interface NavItem {
  label: string;
  href: string;
  dropdown?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Analyze",   href: "/analyze",         dropdown: true },
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
    if (item.href === "/dashboard") {
      return pathname.startsWith("/dashboard");
    }
    if (item.href === "/history") {
      return pathname.startsWith("/history");
    }
    return pathname === item.href;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Analyze dropdown (desktop)
// ─────────────────────────────────────────────────────────────────────────────

function AnalyzeDropdown({
  open,
  pathname,
}: {
  open: boolean;
  pathname: string;
}) {
  if (!open) return null;
  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2.5 w-[240px] rounded-2xl border border-white/[0.09] bg-[#060B18]/98 backdrop-blur-xl shadow-2xl shadow-black/70 p-1.5 z-50">
      {ANALYZE_SUBITEMS.map(({ label, href, icon: Icon, desc }) => {
        const isActive =
          pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl group transition-colors",
              isActive
                ? "bg-violet-500/10"
                : "hover:bg-white/[0.05]"
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors",
                isActive
                  ? "bg-violet-500/20"
                  : "bg-white/[0.04] group-hover:bg-violet-500/15"
              )}
            >
              <Icon className="h-4 w-4 text-violet-400" />
            </div>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-[13px] font-medium leading-none mb-0.5",
                  isActive ? "text-violet-300" : "text-slate-200"
                )}
              >
                {label}
              </p>
              <p className="text-[11px] text-slate-500">{desc}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared nav link styles
// ─────────────────────────────────────────────────────────────────────────────

function navLinkCls(active: boolean) {
  return cn(
    "px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all duration-150",
    active
      ? "text-white bg-white/[0.09]"
      : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface NavbarProps {
  /** sticky = fixed + scroll-shrink (homepage). static = in-flow (inner pages). */
  variant?: "sticky" | "static";
}

export function Navbar({ variant = "sticky" }: NavbarProps) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileAnalyzeOpen, setMobileAnalyzeOpen] = useState(false);
  const analyzeRef = useRef<HTMLDivElement>(null);

  const isSticky = variant === "sticky";
  const isActive = useActiveItem(pathname);

  // Scroll listener (sticky only)
  useEffect(() => {
    if (!isSticky) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isSticky]);

  // Close analyze dropdown on outside click/escape
  useEffect(() => {
    if (!analyzeOpen) return;
    function handleDown(e: MouseEvent) {
      if (analyzeRef.current && !analyzeRef.current.contains(e.target as Node)) {
        setAnalyzeOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAnalyzeOpen(false);
    }
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [analyzeOpen]);

  // Close everything on route change
  useEffect(() => {
    setAnalyzeOpen(false);
    setMobileOpen(false);
    setMobileAnalyzeOpen(false);
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

      {/* ── Center nav (desktop) ── */}
      <div className="hidden md:flex items-center gap-0.5">
        {NAV_ITEMS.map((item) =>
          item.dropdown ? (
            <div
              key={item.label}
              ref={analyzeRef}
              className="relative"
              onMouseEnter={() => setAnalyzeOpen(true)}
              onMouseLeave={() => setAnalyzeOpen(false)}
            >
              <button
                type="button"
                onClick={() => setAnalyzeOpen((v) => !v)}
                className={cn(
                  navLinkCls(isActive(item)),
                  "flex items-center gap-1"
                )}
              >
                {item.label}
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform duration-200",
                    analyzeOpen && "rotate-180"
                  )}
                />
              </button>
              <AnalyzeDropdown open={analyzeOpen} pathname={pathname} />
            </div>
          ) : (
            <Link key={item.label} href={item.href} className={navLinkCls(isActive(item))}>
              {item.label}
            </Link>
          )
        )}
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
          {NAV_ITEMS.map((item) =>
            item.dropdown ? (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => setMobileAnalyzeOpen((v) => !v)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all",
                    isActive(item)
                      ? "text-white bg-white/[0.09]"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  )}
                >
                  <span>{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200",
                      mobileAnalyzeOpen && "rotate-180"
                    )}
                  />
                </button>

                {mobileAnalyzeOpen && (
                  <div className="ml-3 mt-0.5 pl-3 border-l border-white/[0.07] space-y-0.5 pb-1">
                    {ANALYZE_SUBITEMS.map(({ label, href, icon: Icon }) => {
                      const active =
                        pathname === href || pathname.startsWith(href + "/");
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-all",
                            active
                              ? "text-violet-300 bg-violet-500/10"
                              : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all",
                  isActive(item)
                    ? "text-white bg-white/[0.09]"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                )}
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        {/* Auth footer inside mobile menu */}
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
