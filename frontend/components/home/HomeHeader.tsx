"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, Spade, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { StartFreeButton } from "./Cta";

const LINKS = [
  { label: "Trainer", href: "/preflop-trainer" },
  { label: "Hands", href: "/hands" },
  { label: "Bankroll", href: "/bankroll" },
  { label: "Pricing", href: "/pricing" },
];

/**
 * Homepage header: transparent at the top, blurred translucent once scrolled.
 * On phones the links fold into a menu; the primary CTA always stays visible.
 * Signed-in visitors get "Dashboard" instead of the sign-in pair.
 */
export function HomeHeader() {
  const { user, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-300",
        scrolled || open ? "border-b border-white/10 bg-[#070A12]/80 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-blue-500">
            <Spade className="h-3.5 w-3.5 text-white" aria-hidden />
          </span>
          <span className="text-sm font-bold tracking-tight text-white">
            Stacked<span className="text-violet-300"> Poker</span>
          </span>
        </Link>

        <nav aria-label="Main" className="ml-6 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-3 py-1.5 text-sm text-white/70 transition-colors hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {!loading && user ? (
            <Link href="/dashboard" className="rounded-xl bg-white/10 px-3.5 py-2 text-sm font-semibold text-white hover:bg-white/15">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden px-2 text-sm text-white/70 hover:text-white sm:inline">
                Sign in
              </Link>
              <StartFreeButton location="header" size="sm" />
            </>
          )}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="home-menu"
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg p-2 text-white/80 hover:text-white md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="home-menu" aria-label="Main" className="border-t border-white/10 px-4 pb-4 pt-2 md:hidden">
          {[...LINKS, ...(!user ? [{ label: "Sign in", href: "/login" }] : [])].map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-2.5 text-[15px] text-white/80 hover:bg-white/5 hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
