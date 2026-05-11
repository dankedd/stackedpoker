'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Spade, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

type PasswordStrength = 'weak' | 'fair' | 'strong'

function getPasswordStrength(pw: string): PasswordStrength | null {
  if (!pw) return null
  if (pw.length < 6) return 'weak'
  const hasUpper = /[A-Z]/.test(pw)
  const hasLower = /[a-z]/.test(pw)
  const hasNumber = /\d/.test(pw)
  const hasSpecial = /[^A-Za-z0-9]/.test(pw)
  const score = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length
  if (pw.length >= 8 && score >= 3) return 'strong'
  if (pw.length >= 6 && score >= 2) return 'fair'
  return 'weak'
}

const strengthConfig: Record<PasswordStrength, { label: string; color: string; bars: number }> = {
  weak:   { label: 'Weak',   color: 'bg-red-500',          bars: 1 },
  fair:   { label: 'Fair',   color: 'bg-yellow-500',        bars: 2 },
  strong: { label: 'Strong', color: 'bg-poker-green',       bars: 3 },
}

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const strength = getPasswordStrength(password)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!username.trim()) {
      setError('Username is required.')
      return
    }
    if (username.length < 3) {
      setError('Username must be at least 3 characters.')
      return
    }
    if (strength === 'weak') {
      setError('Please choose a stronger password (min. 6 characters).')
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(0,200,83,0.08) 0%, transparent 55%), hsl(120 15% 4%)'
      }}>
        <div className="w-full max-w-md text-center animate-fade-in">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-poker-green/15 border border-poker-green/40 glow-green">
              <CheckCircle2 className="h-8 w-8 text-poker-green" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            We sent a confirmation link to <span className="text-foreground font-medium">{email}</span>.
            Click it to activate your account.
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm text-poker-green hover:text-poker-green-dark transition-colors">
            Back to sign in →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{
      background: 'radial-gradient(ellipse at 50% 0%, rgba(0,200,83,0.08) 0%, transparent 55%), hsl(120 15% 4%)'
    }}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-poker-green/5 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-poker-green/3 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-3 group">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-poker-green/15 border border-poker-green/30 group-hover:bg-poker-green/25 transition-colors glow-green-sm">
              <Spade className="h-7 w-7 text-poker-green" />
            </div>
            <div>
              <span className="text-2xl font-bold text-foreground tracking-tight">
                Stacked<span className="text-poker-green"> Poker</span>
              </span>
              <p className="text-sm text-muted-foreground mt-0.5">Premium poker coaching</p>
            </div>
          </Link>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-8 shadow-2xl">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-foreground">Create your account</h1>
            <p className="text-sm text-muted-foreground mt-1">Start improving your poker game today</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full h-11 rounded-lg border border-border bg-input/50 px-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-poker-green/40 focus:border-poker-green/50 transition-all"
              />
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="pokerpro99"
                required
                minLength={3}
                maxLength={30}
                autoComplete="username"
                className="w-full h-11 rounded-lg border border-border bg-input/50 px-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-poker-green/40 focus:border-poker-green/50 transition-all"
              />
              <p className="text-xs text-muted-foreground/60">Letters, numbers and underscores only</p>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  className="w-full h-11 rounded-lg border border-border bg-input/50 px-4 pr-11 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-poker-green/40 focus:border-poker-green/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password strength */}
              {password && strength && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((bar) => (
                      <div
                        key={bar}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          bar <= strengthConfig[strength].bars
                            ? strengthConfig[strength].color
                            : 'bg-border'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${
                    strength === 'strong' ? 'text-poker-green' :
                    strength === 'fair'   ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {strengthConfig[strength].label} password
                  </p>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="poker"
              size="lg"
              className="w-full mt-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                'Create account'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-poker-green font-medium hover:text-poker-green-dark transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/50">
          By signing up you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
