import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  TrendingUp,
  BookOpen,
  BarChart3,
  ChevronRight,
  Layers,
  Clock,
  Spade,
  Brain,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Navbar } from '@/components/layout/Navbar'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, subscription_tier, hands_analyzed_count')
    .eq('id', user.id)
    .single()

  const displayName = profile?.username ?? user.email?.split('@')[0] ?? 'Player'
  const handsAnalyzed = profile?.hands_analyzed_count ?? 0
  const tier = profile?.subscription_tier ?? 'free'

  return (
    <div className="min-h-screen bg-background">
      <Navbar variant="static" />

      <main className="container mx-auto max-w-6xl px-4 sm:px-6 py-10">
        {/* Welcome */}
        <div className="mb-10 animate-fade-in">
          <p className="text-sm font-medium text-violet-400 mb-1">Dashboard</p>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {displayName}
          </h1>
          <p className="text-muted-foreground mt-2">
            Ready to review your game and find the leaks?
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            {
              icon: BarChart3,
              label: 'Hands Analyzed',
              value: handsAnalyzed.toString(),
              sub: 'total sessions',
              color: 'text-violet-400',
            },
            {
              icon: TrendingUp,
              label: 'Plan',
              value: tier.charAt(0).toUpperCase() + tier.slice(1),
              sub: tier === 'free' ? 'Upgrade for unlimited' : 'Active',
              color: tier === 'pro' ? 'text-poker-gold' : 'text-muted-foreground',
            },
            {
              icon: Clock,
              label: 'Member since',
              value: new Date(user.created_at).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              }),
              sub: 'account age',
              color: 'text-muted-foreground',
            },
          ].map(({ icon: Icon, label, value, sub, color }) => (
            <div
              key={label}
              className="rounded-xl border border-border/60 bg-card/60 p-6 space-y-3 animate-fade-in"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-4 w-4" />
                <span className="text-sm">{label}</span>
              </div>
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground/60">{sub}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/analyze" className="group">
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/40 p-6 transition-all duration-200 h-full">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-blue-500">
                    <Spade className="h-5 w-5 text-white" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-violet-400 transition-colors" />
                </div>
                <h3 className="text-foreground font-semibold mt-4">Analyze a Hand</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Paste a hand history or upload a screenshot for instant GTO coaching.
                </p>
              </div>
            </Link>

            <Link href="/history" className="group">
              <div className="rounded-xl border border-border/60 bg-card/40 hover:bg-card/80 hover:border-border p-6 transition-all duration-200 h-full">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary border border-border/60">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <h3 className="text-foreground font-semibold mt-4">Hand History</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Review past analyses, replay hands, and track your improvement.
                </p>
              </div>
            </Link>

            <Link href="/analyze/puzzles" className="group">
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/40 p-6 transition-all duration-200 h-full">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/20 border border-violet-500/25">
                    <Brain className="h-5 w-5 text-violet-400" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-violet-400 transition-colors" />
                </div>
                <h3 className="text-foreground font-semibold mt-4">Puzzles</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Train with multi-street interactive scenarios and live AI coaching.
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent analyses placeholder */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Analyses</h2>
            <Link
              href="/history"
              className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
            >
              View all →
            </Link>
          </div>

          <div className="rounded-xl border border-border/60 bg-card/40 p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary border border-border/60">
                <Layers className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
            <p className="text-foreground font-medium">No analyses yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              Analyze your first hand to start tracking your progress.
            </p>
            <Button variant="poker" size="sm" asChild>
              <Link href="/analyze">Analyze your first hand</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
