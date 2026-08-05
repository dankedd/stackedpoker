"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Spade, Menu, X, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/layout/UserMenu";
import { StatusBadge, type ProductStatus } from "@/components/layout/StatusBadge";
import {
  MENU_Z_INDEX,
  useAnchoredMenuPosition,
  useDismissOnOutsideOrEscape,
  useRecomputeOnScrollResize,
} from "@/hooks/useAnchoredMenu";
import { cn } from "@/lib/utils";

const DEV_MENU_W = 256; // w-64 = 16rem

// ─────────────────────────────────────────────────────────────────────────────
// Navigation config
// ─────────────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  primary?: boolean; // signals this is the core feature
}

interface DevNavItem {
  label: string;
  href: string;
  status: ProductStatus;
}

// Learn dominates. Bankroll is the one other reliable tool. Everything still
// being rebuilt lives in the separate "in development" cluster below.
const NAV_ITEMS: NavItem[] = [
  { label: "Learn",       href: "/learn", primary: true },
  { label: "Bankroll",    href: "/bankroll" },
  { label: "Leaderboard", href: "/leaderboard" },
];

const DEV_ITEMS: DevNavItem[] = [
  { label: "Practice", href: "/practice", status: "next" },
  { label: "Analyze",  href: "/analyze",  status: "development" },
  { label: "Replay",   href: "/replay",   status: "development" },
];

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
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
  const [devOpen, setDevOpen] = useState(false);
  const devMenuRef = useRef<HTMLDivElement>(null);
  const isSticky = variant === "sticky";
  const devActive = DEV_ITEMS.some((item) => isItemActive(pathname, item.href));

  // Portaled to document.body (see the dropdown render below) so it always paints
  // above page content, regardless of what stacking contexts a given page creates —
  // see the useAnchoredMenu hooks' doc comments.
  const { pos: devPos, triggerRef: devTriggerRef, computePos: computeDevPos } =
    useAnchoredMenuPosition({ width: DEV_MENU_W, align: "right", estimatedHeight: 220 });

  // Scroll listener (sticky only)
  useEffect(() => {
    if (!isSticky) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isSticky]);

  // Close mobile menu + dev dropdown on route change
  useEffect(() => {
    setMobileOpen(false);
    setDevOpen(false);
  }, [pathname]);

  useDismissOnOutsideOrEscape(devOpen, () => setDevOpen(false), devTriggerRef, devMenuRef);
  useRecomputeOnScrollResize(devOpen, computeDevPos);

  function toggleDevOpen() {
    if (!devOpen) computeDevPos();
    setDevOpen((v) => !v);
  }

  // ── Nav pill ──────────────────────────────────────────────────────────────
  const nav = (
    <nav
      className={cn(
        "w-full max-w-[960px] flex items-center justify-between",
        "rounded-2xl backdrop-blur-xl px-5 transition-all duration-300 ease-out",
        isSticky
          ? scrolled
            ? "py-2.5 bg-[#060C18]/97 border border-white/[0.10] shadow-2xl shadow-black/60 backdrop-saturate-150"
            : "py-3.5 bg-[#0D1526]/85 border border-white/[0.07] shadow-xl shadow-black/25"
          : "py-2.5 bg-[#080D1A]/95 border border-white/[0.09] shadow-xl shadow-black/40"
      )}
    >
      {/* ── Logo ── */}
      <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-blue-500 shadow-sm shadow-violet-500/30 transition-all duration-200 group-hover:shadow-violet-500/50 group-hover:scale-105 will-change-transform">
          <Spade className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="font-bold text-white tracking-tight text-sm transition-opacity duration-150 group-hover:opacity-90">
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
            className={navLinkCls(isItemActive(pathname, item.href), item.primary)}
          >
            {item.label}
          </Link>
        ))}

        {/* ── In development cluster (desktop dropdown) ── */}
        <div className="ml-1">
          <button
            ref={devTriggerRef}
            type="button"
            onClick={toggleDevOpen}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all duration-150",
              devActive
                ? "text-slate-300 bg-white/[0.06]"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"
            )}
            aria-haspopup="true"
            aria-expanded={devOpen}
          >
            In development
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-150", devOpen && "rotate-180")} />
          </button>

          {/* Portaled to document.body + position: fixed (viewport coordinates from
           *  useAnchoredMenuPosition) instead of absolute-inside-the-nav — on inner
           *  pages the navbar renders in-flow (variant="static"), so an absolutely
           *  positioned dropdown here inherited whatever stacking context page
           *  content happened to create and could paint underneath it. Portaling
           *  escapes that entirely; MENU_Z_INDEX keeps it above everything. */}
          {devOpen && createPortal(
            <div
              ref={devMenuRef}
              style={{ position: "fixed", top: devPos.top, left: devPos.left, width: DEV_MENU_W, zIndex: MENU_Z_INDEX }}
              className="rounded-2xl border border-white/[0.1] bg-[#070C1B] shadow-2xl shadow-black/70 overflow-hidden animate-dropdown-in"
            >
              <div className="p-1.5">
                {DEV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDevOpen(false)}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-all duration-150"
                  >
                    {item.label}
                    <StatusBadge status={item.status} className="py-0.5 px-2 text-[9px]" />
                  </Link>
                ))}
              </div>
            </div>,
            document.body
          )}
        </div>
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
    <div className="md:hidden fixed inset-x-0 top-[68px] px-4 animate-dropdown-in" style={{ zIndex: MENU_Z_INDEX }}>
      <div className="rounded-2xl border border-white/[0.09] bg-[#060B18]/98 backdrop-blur-xl backdrop-saturate-150 shadow-2xl shadow-black/70 overflow-hidden">
        <nav className="p-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2.5 rounded-xl text-[13px] transition-all",
                item.primary ? "font-semibold" : "font-medium",
                isItemActive(pathname, item.href)
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

          {/* ── In development section ── */}
          <div className="mt-2 pt-2 border-t border-white/[0.06]">
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">
              In development
            </p>
            {DEV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-all"
              >
                {item.label}
                <StatusBadge status={item.status} className="py-0.5 px-2 text-[9px]" />
              </Link>
            ))}
          </div>
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

  // Portaled for the same reason as the dev dropdown above: on variant="static"
  // pages this menu isn't nested inside anything that elevates it, so rendering
  // it in-tree (even as `fixed` with a high z-index) still confines it to
  // whatever stacking context page content creates. mobileOpen gates
  // `mobileMenu` to `null` until the user opens it, so `document.body` is
  // never touched during SSR.
  const portaledMobileMenu = mobileMenu && createPortal(mobileMenu, document.body);

  // ── Render ────────────────────────────────────────────────────────────────
  if (isSticky) {
    return (
      <>
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4">
          {nav}
        </div>
        {portaledMobileMenu}
      </>
    );
  }

  return (
    <>
      <div className="flex justify-center px-4 pt-4 w-full">
        {nav}
      </div>
      {portaledMobileMenu}
    </>
  );
}
