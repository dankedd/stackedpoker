"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Spade } from "lucide-react";
import { UserMenu } from "@/components/layout/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export function Header() {
  const { user, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-sm shadow-slate-200/60"
          : "bg-white/80 backdrop-blur-xl border-b border-slate-100/60"
      )}
    >
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 shadow-sm shadow-violet-500/25 group-hover:shadow-violet-500/40 transition-shadow">
            <Spade className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-slate-900 tracking-tight">
            Stacked
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-500">
              {" "}Poker
            </span>
          </span>
        </Link>

        {/* Center nav */}
        <nav className="hidden md:flex items-center gap-7 text-sm text-slate-500">
          <Link href="/analyze" className="hover:text-slate-900 transition-colors duration-150">
            Analyze
          </Link>
          {user && (
            <Link href="/dashboard" className="hover:text-slate-900 transition-colors duration-150">
              Dashboard
            </Link>
          )}
          <Link href="#features" className="hover:text-slate-900 transition-colors duration-150">
            Features
          </Link>
          <Link href="#how-it-works" className="hover:text-slate-900 transition-colors duration-150">
            How it works
          </Link>
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!loading && (
            user ? (
              <UserMenu />
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:block text-sm text-slate-500 hover:text-slate-900 transition-colors px-3 py-1.5 rounded-xl hover:bg-slate-50"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center text-sm font-semibold text-white px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 hover:opacity-90 hover:-translate-y-px transition-all duration-150 shadow-sm shadow-violet-500/20"
                >
                  Get started
                </Link>
              </>
            )
          )}
        </div>
      </div>
    </header>
  );
}
