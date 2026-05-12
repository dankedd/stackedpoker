"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Spade } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/layout/UserMenu";
import { cn } from "@/lib/utils";

const LANDING_LINKS = [
  { label: "Features",     href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Reviews",      href: "#testimonials" },
  { label: "Try free",     href: "/analyze" },
];

const APP_LINKS = [
  { label: "Analyze",   href: "/analyze" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "History",   href: "/history" },
];

interface NavbarProps {
  /** sticky = fixed + scroll-shrink (homepage). static = in-flow, no scroll effect (inner pages). */
  variant?: "sticky" | "static";
}

export function Navbar({ variant = "sticky" }: NavbarProps) {
  const { user, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const isSticky = variant === "sticky";
  const links = isSticky ? LANDING_LINKS : APP_LINKS;

  useEffect(() => {
    if (!isSticky) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isSticky]);

  const nav = (
    <nav
      className={cn(
        "w-full max-w-[900px] flex items-center justify-between",
        "rounded-2xl backdrop-blur-xl px-5 transition-all duration-300 ease-out",
        isSticky
          ? scrolled
            ? "py-2.5 bg-[#080D1A]/92 border border-white/[0.09] shadow-2xl shadow-black/50"
            : "py-3.5 bg-[#0D1526]/80 border border-white/[0.07] shadow-xl shadow-black/25"
          : "py-2.5 bg-[#080D1A]/92 border border-white/[0.09] shadow-xl shadow-black/40"
      )}
    >
      {/* Logo */}
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

      {/* Center links */}
      <div className="hidden md:flex items-center gap-7 text-[13px] font-medium text-slate-400">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-white transition-colors duration-150">
            {l.label}
          </Link>
        ))}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 shrink-0">
        {!loading && (
          user ? (
            isSticky ? (
              <Link
                href="/dashboard"
                className="text-[13px] font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-500 px-4 py-2 rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-violet-900/30"
              >
                Dashboard →
              </Link>
            ) : (
              <UserMenu />
            )
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:block text-[13px] text-slate-400 hover:text-white transition-colors px-3 py-1.5"
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
          )
        )}
      </div>
    </nav>
  );

  if (isSticky) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4">
        {nav}
      </div>
    );
  }

  return (
    <div className="flex justify-center px-4 pt-4 w-full">
      {nav}
    </div>
  );
}
