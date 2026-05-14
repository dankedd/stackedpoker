'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, AlertCircle, Loader2, Spade } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}


const INPUT_CLS =
  "w-full h-12 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/40 transition-all"

export function LoginContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo        = searchParams.get('redirect') ?? '/dashboard'
  const callbackError     = searchParams.get('error')
  const callbackErrorDesc = searchParams.get('error_description')

  useEffect(() => {
    if (!callbackError) return
    // server_error / validation_failed = provider misconfigured in Supabase
    if (
      callbackError === 'server_error' ||
      callbackError === 'validation_failed' ||
      (callbackErrorDesc && callbackErrorDesc.toLowerCase().includes('provider'))
    ) {
      setError('Google login is currently unavailable. Please use email/password or try again later.')
      return
    }
    if (callbackError === 'access_denied') {
      setError('Sign-in was cancelled.')
      return
    }
    // auth_callback_failed or any other error
    setError('Sign-in failed. Please try again or use a different method.')
  }, [callbackError, callbackErrorDesc])

  async function handleOAuth(provider: 'google') {
    setError(null)
    setOauthLoading(provider)
    const supabase = createClient()
    // Pass `next` so the callback route redirects to the intended page.
    const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl },
    })
    if (error) {
      setError(error.message)
      setOauthLoading(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background relative overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-violet-600/10 blur-[130px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-blue-600/6 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[440px] animate-fade-in">
        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-card/90 backdrop-blur-sm p-8 shadow-2xl shadow-black/60">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 mb-3 shadow-lg shadow-violet-900/50">
              <Spade className="h-6 w-6 text-white" />
            </div>
            <span className="text-lg font-bold text-foreground tracking-tight">Stacked Poker</span>
            <p className="text-sm text-muted-foreground mt-1">Welcome back — sign in to continue</p>
          </div>

          {/* Social auth */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={!!oauthLoading || loading}
              className="w-full h-12 flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] font-medium text-foreground hover:bg-white/[0.09] transition-colors disabled:opacity-50"
              style={{ fontSize: '16px' }}
            >
              {oauthLoading === 'google' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Continue with Google
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 border-t border-white/[0.08]" />
            <span className="text-xs text-muted-foreground/50 uppercase tracking-widest">or</span>
            <div className="flex-1 border-t border-white/[0.08]" />
          </div>

          {/* Email / password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/70" htmlFor="email">
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
                style={{ fontSize: '16px' }}
                className={INPUT_CLS}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground/70" htmlFor="password">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground/50 hover:text-violet-400 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  style={{ fontSize: '16px' }}
                  className={INPUT_CLS + " pr-12"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive leading-snug">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="poker"
              size="lg"
              className="w-full h-12 mt-1"
              style={{ fontSize: '16px' }}
              disabled={loading || !!oauthLoading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="text-violet-400 font-medium hover:text-violet-300 transition-colors"
            >
              Create account
            </Link>
          </p>
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground/35">
          By continuing you agree to our{' '}
          <span className="underline underline-offset-2 cursor-pointer hover:text-muted-foreground/60 transition-colors">Terms</span>
          {' '}and{' '}
          <span className="underline underline-offset-2 cursor-pointer hover:text-muted-foreground/60 transition-colors">Privacy Policy</span>.
        </p>
      </div>
    </div>
  )
}
