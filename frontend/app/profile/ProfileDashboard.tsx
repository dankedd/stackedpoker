"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchPlayerProfile } from "@/lib/api";
import type { PlayerProfile } from "@/lib/types";
import { OverviewCard }      from "@/components/profile/OverviewCard";
import { LeakList }          from "@/components/profile/LeakList";
import { StatGrid }          from "@/components/profile/StatGrid";
import { PositionHeatmap }   from "@/components/profile/PositionHeatmap";
import { ScoreTrendChart }   from "@/components/profile/ScoreTrendChart";
import { StreetBreakdown }   from "@/components/profile/StreetBreakdown";
import { CoachSummary }      from "@/components/profile/CoachSummary";
import { StudyPlan }         from "@/components/profile/StudyPlan";
import {
  User, BarChart3, AlertTriangle, BookOpen, Brain,
  Map, TrendingUp, Layers, RefreshCw, Spade,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Section = "overview" | "leaks" | "stats" | "position" | "trend" | "streets" | "coach" | "study";

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "overview",  label: "Overview",         icon: User        },
  { id: "coach",     label: "AI Coach",         icon: Brain       },
  { id: "leaks",     label: "Biggest Leaks",    icon: AlertTriangle },
  { id: "study",     label: "Study Plan",       icon: BookOpen    },
  { id: "stats",     label: "Stats",            icon: BarChart3   },
  { id: "position",  label: "Position Map",     icon: Map         },
  { id: "trend",     label: "Score Trend",      icon: TrendingUp  },
  { id: "streets",   label: "Street Mistakes",  icon: Layers      },
];

interface Props {
  accessToken: string;
}

export function ProfileDashboard({ accessToken }: Props) {
  const [profile,  setProfile]  = useState<PlayerProfile | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [section,  setSection]  = useState<Section>("overview");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlayerProfile(accessToken);
      setProfile(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="container mx-auto max-w-5xl px-4 sm:px-6 py-10">
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20">
            <Spade className="h-6 w-6 text-violet-400 animate-pulse" />
          </div>
          <p className="text-muted-foreground text-sm">Analysing your hand history…</p>
        </div>
      </main>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <main className="container mx-auto max-w-5xl px-4 sm:px-6 py-10">
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={load}
            className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </main>
    );
  }

  // ── Insufficient data ────────────────────────────────────────────────────
  if (!profile || profile.data_quality === "insufficient") {
    return (
      <main className="container mx-auto max-w-5xl px-4 sm:px-6 py-10">
        <div className="mb-8 animate-fade-in">
          <p className="text-sm font-medium text-violet-400 mb-1">Player Profile</p>
          <h1 className="text-3xl font-bold text-foreground">Your Coaching Profile</h1>
        </div>
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/15 border border-violet-500/25">
              <Brain className="h-8 w-8 text-violet-400/60" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Profile needs more data</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto leading-relaxed">
            {profile?.ai_summary ?? "Analyse at least 5 hands to generate your personalised player profile, leak detection, and coaching plan."}
          </p>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <Spade className="h-4 w-4" />
            Analyse a Hand
          </Link>
        </div>
      </main>
    );
  }

  // ── Full dashboard ───────────────────────────────────────────────────────
  return (
    <main className="container mx-auto max-w-5xl px-4 sm:px-6 py-10 page-enter">

      {/* Header */}
      <div className="mb-8 animate-fade-in flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-violet-400 mb-1">Player Profile</p>
          <h1 className="text-3xl font-bold text-foreground">Your Coaching Profile</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Based on {profile.sample_size} analysed hand{profile.sample_size !== 1 ? "s" : ""} ·{" "}
            <span className="capitalize">{profile.data_quality}</span> data quality ·{" "}
            Updated {new Date(profile.generated_at).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={load}
          title="Refresh profile"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-violet-400 transition-colors border border-border/50 rounded-lg px-3 py-1.5"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      {/* Section nav (scrollable on mobile) */}
      <div className="mb-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-1 w-max sm:w-auto sm:flex-wrap">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all",
                section === id
                  ? "bg-violet-500/15 text-violet-300 border border-violet-500/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/60 border border-transparent",
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-6">

        {/* ── Overview ── */}
        {section === "overview" && (
          <div className="space-y-6 animate-fade-in">
            <OverviewCard profile={profile} />

            {/* Condensed leak preview */}
            {profile.leaks.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground">Top Leaks</h2>
                  <button
                    onClick={() => setSection("leaks")}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    See all →
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {profile.leaks.slice(0, 4).map((leak, i) => (
                    <div
                      key={leak.id}
                      className="rounded-xl border border-border/60 bg-card/40 p-3 flex items-center gap-2"
                    >
                      <span className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black shrink-0",
                        leak.severity === "critical" ? "bg-red-500/20 text-red-400" :
                        leak.severity === "major"    ? "bg-amber-500/20 text-amber-400" :
                        "bg-blue-500/20 text-blue-400",
                      )}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{leak.title}</p>
                        <p className="text-[10px] text-red-400">−{leak.ev_loss_bb.toFixed(1)}bb EV</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Score trend preview */}
            {profile.stats.score_trend.length >= 2 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground">Score Trend</h2>
                  <button
                    onClick={() => setSection("trend")}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Full chart →
                  </button>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/40 p-4">
                  <ScoreTrendChart trend={profile.stats.score_trend} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AI Coach ── */}
        {section === "coach" && (
          <div className="animate-fade-in">
            <SectionHeader
              icon={Brain}
              title="AI Coach Summary"
              sub="Personalised advice generated from your hand history"
            />
            <CoachSummary profile={profile} />
          </div>
        )}

        {/* ── Leaks ── */}
        {section === "leaks" && (
          <div className="animate-fade-in">
            <SectionHeader
              icon={AlertTriangle}
              title="Biggest Leaks"
              sub="Ranked by estimated EV loss — fix the top ones first"
            />
            <LeakList leaks={profile.leaks} />
          </div>
        )}

        {/* ── Study Plan ── */}
        {section === "study" && (
          <div className="animate-fade-in">
            <SectionHeader
              icon={BookOpen}
              title="Recommended Study Plan"
              sub="Targeted drills, puzzles and articles for each detected leak"
            />
            <StudyPlan recommendations={profile.study_recommendations} />
          </div>
        )}

        {/* ── Stats ── */}
        {section === "stats" && (
          <div className="animate-fade-in">
            <SectionHeader
              icon={BarChart3}
              title="Detailed Statistics"
              sub="Aggregated metrics across all analysed hands"
            />
            <StatGrid stats={profile.stats} />
          </div>
        )}

        {/* ── Position map ── */}
        {section === "position" && (
          <div className="animate-fade-in">
            <SectionHeader
              icon={Map}
              title="Positional Breakdown"
              sub="Average score and mistake rate by position"
            />
            <PositionHeatmap positionStats={profile.stats.position_stats} />
          </div>
        )}

        {/* ── Score trend ── */}
        {section === "trend" && (
          <div className="animate-fade-in">
            <SectionHeader
              icon={TrendingUp}
              title="Score Trend"
              sub="Decision quality over your last 30 sessions"
            />
            <div className="rounded-xl border border-border/60 bg-card/40 p-6">
              <ScoreTrendChart trend={profile.stats.score_trend} />
            </div>
            {profile.stats.score_trend.length > 0 && (
              <div className="mt-4 grid sm:grid-cols-3 gap-3 text-center">
                {[
                  {
                    label: "Best session",
                    value: Math.max(...profile.stats.score_trend.map(p => p.score)).toFixed(0),
                    color: "text-green-400",
                  },
                  {
                    label: "Average",
                    value: profile.stats.avg_score.toFixed(0),
                    color: "text-violet-400",
                  },
                  {
                    label: "Worst session",
                    value: Math.min(...profile.stats.score_trend.map(p => p.score)).toFixed(0),
                    color: "text-red-400",
                  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl border border-border/60 bg-card/40 p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={cn("text-2xl font-bold tabular-nums mt-1", color)}>{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Street mistakes ── */}
        {section === "streets" && (
          <div className="animate-fade-in">
            <SectionHeader
              icon={Layers}
              title="Street Mistake Breakdown"
              sub="Where in the hand your EV is being lost"
            />
            <div className="rounded-xl border border-border/60 bg-card/40 p-6">
              <StreetBreakdown
                streetMistakes={profile.stats.street_mistakes}
                totalHands={profile.stats.total_hands}
              />
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  sub,
}: {
  icon: React.ElementType;
  title: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-500/20 shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-violet-400" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {sub && <p className="text-sm text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
