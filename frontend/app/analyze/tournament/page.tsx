"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, AlertCircle } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TOURNAMENT_TYPES = ["MTT", "SNG", "Bounty", "Hyper Turbo", "Satellite", "WSOP-style"];
const FIELD_SIZES = ["< 50", "50–200", "200–1000", "1000+"];

export default function TournamentAnalyzePage() {
  const [tournamentType, setTournamentType] = useState("MTT");
  const [fieldSize, setFieldSize] = useState("50–200");
  const [buyIn, setBuyIn] = useState("");
  const [text, setText] = useState("");

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar variant="static" />

      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">

          {/* Back */}
          <Link
            href="/analyze"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Analyze
          </Link>

          {/* Beta notice */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 mb-6">
            <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-300/80">
              Tournament analysis is currently in beta. Upload your history to help us shape this feature.
            </p>
          </div>

          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
                  <Trophy className="h-4 w-4 text-amber-400" />
                </div>
                <CardTitle>Tournament Analysis</CardTitle>
              </div>
              <CardDescription>
                Review your tournament hands, identify key ICM decisions, and spot late-stage strategic errors.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Tournament type */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Tournament type</label>
                <div className="flex flex-wrap gap-1.5">
                  {TOURNAMENT_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTournamentType(t)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-medium border transition-all",
                        tournamentType === t
                          ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                          : "border-border/50 bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-border/80"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Field size + Buy-in */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">Field size</label>
                  <div className="flex flex-col gap-1.5">
                    {FIELD_SIZES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFieldSize(s)}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-medium border transition-all text-left",
                          fieldSize === s
                            ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                            : "border-border/50 bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-border/80"
                        )}
                      >
                        {s} players
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground/80">Buy-in (optional)</label>
                  <input
                    type="text"
                    value={buyIn}
                    onChange={(e) => setBuyIn(e.target.value)}
                    placeholder="e.g. $109"
                    className="w-full h-9 rounded-lg border border-border bg-input/50 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 transition-all"
                  />
                </div>
              </div>

              {/* Paste area */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground/80">Tournament hand history</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your tournament hand history here…"
                  rows={10}
                  className="w-full rounded-lg border border-border/70 bg-card/50 px-4 py-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 transition-all resize-y"
                />
              </div>

              <Button
                variant="poker"
                size="lg"
                className="w-full opacity-70 cursor-not-allowed"
                disabled
              >
                Analyze Tournament (Beta — coming soon)
              </Button>
            </CardContent>
          </Card>

        </div>
      </main>

      <Footer />
    </div>
  );
}
