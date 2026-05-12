"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Spade } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export function LandingHeader() {
  const { user, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4">
      <nav
        className={cn(
          "w-full max-w-[900px] flex items-center justify-between",
          "rounded-2xl backdrop-blur-xl",
          "px-5 transition-all duration-300 ease-out",
          scrolled
            ? "py-2.5 bg-[#080D1A]/92 border border-white/[0.09] shadow-2xl shadow-black/50"
            : "py-3.5 bg-[#0D1526]/80 border border-white/[0.07] shadow-xl shadow-black/25"
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

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-7 text-[13px] font-medium text-slate-400">
          <Link href="#features"     className="hover:text-white transition-colors duration-150">Features</Link>
          <Link href="#how-it-works" className="hover:text-white transition-colors duration-150">How it works</Link>
          <Link href="#testimonials" className="hover:text-white transition-colors duration-150">Reviews</Link>
          <Link href="/analyze"      className="hover:text-white transition-colors duration-150">Try free</Link>
        </div>

        {/* Right CTA */}
        <div className="flex items-center gap-2 shrink-0">
          {!loading && (
            user ? (
              <Link
                href="/dashboard"
                className="text-[13px] font-semibold text-white bg-gradient-to-r from-violet-600 to-blue-500 px-4 py-2 rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-violet-900/30"
              >
                Dashboard →
              </Link>
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
    </div>
  );
}
