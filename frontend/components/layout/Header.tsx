"use client";

import Link from "next/link";
import { Spade } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/UserMenu";
import { useAuth } from "@/contexts/AuthContext";

export function Header() {
  const { user, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-poker-green/20 border border-poker-green/30 group-hover:bg-poker-green/30 transition-colors">
            <Spade className="h-4 w-4 text-poker-green" />
          </div>
          <span className="font-bold text-foreground tracking-tight">
            Stacked<span className="text-poker-green"> Poker</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/analyze" className="hover:text-foreground transition-colors">
            Analyze Hand
          </Link>
          {user && (
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
          )}
          <Link href="#features" className="hover:text-foreground transition-colors">
            Features
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {!loading && (
            user ? (
              <UserMenu />
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button variant="poker" size="sm" asChild>
                  <Link href="/signup">Get started</Link>
                </Button>
              </>
            )
          )}
        </div>
      </div>
    </header>
  );
}
