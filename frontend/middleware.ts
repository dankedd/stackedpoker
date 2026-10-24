import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { canAccessPremium, canAccessElite } from '@/lib/entitlements'
import { isPublicSeoPath } from '@/lib/seo/routes'
import { canUseFeature, gatedFeatureForPath } from '@/lib/features'
import { needsChoiceScreen } from '@/lib/onboarding/state'
import { UTM_COOKIE, UTM_COOKIE_MAX_AGE, utmFromUrl } from '@/lib/attribution/utm'

// Guest -> /login. Per the membership-system plan, this is now every /learn
// route too (no more anonymous trial) — see that plan for why.
//
// The one exception is `/learn/<lesson-slug>`: the public, crawlable overview
// of a lesson (app/learn/[slug]/page.tsx). It has to be reachable signed-out
// or it cannot be indexed, while /learn, /learn/lesson/*, /learn/module/*,
// /learn/journey and /learn/path/* stay gated. `isPublicSeoPath` — shared
// with app/robots.ts — is the single place that split is defined, so
// robots.txt can never advertise a URL this file redirects.
const PROTECTED_PATHS = [
  '/dashboard', '/history', '/settings', '/onboarding',
  '/learn', '/bankroll', '/hands', '/coach', '/coaching', '/community', '/challenges', '/solver',
]
const AUTH_PATHS = ['/login', '/signup']

// Logged in but Free tier -> /pricing. Community is Plus+ per the pricing
// page's plan comparison; Bankroll is deliberately NOT here — the
// membership-system ticket lists "Bankroll Tracker" as a Free-tier feature,
// which conflicts with the pricing page's own "Bankroll Tracker: Plus+"
// comparison row (built in an earlier task). This follows the more recent,
// explicit instruction; the conflict is flagged in that work's report for
// the two to be reconciled.
const PREMIUM_PATHS = ['/community']

// Logged in but not Elite (Free OR Plus) -> /pricing. Solver Explorer is
// explicitly Elite-exclusive on the pricing page — Plus does not unlock it.
const ELITE_PATHS = ['/solver']

// Logged in, hasn't seen the onboarding choice screen yet (Preflop Trainer or
// Hand Review tour, see lib/onboarding/state.ts) -> /onboarding, before any
// authenticated page. Trainer-prompt signups are exempt: they go straight
// back to the trainer and get an optional tour there. Excludes the
// onboarding route itself (redirect loop) and the public SEO lesson-slug
// route (same exemption PROTECTED_PATHS gives it).
const ONBOARDING_GATED_PATHS = PROTECTED_PATHS
const ONBOARDING_EXEMPT_PATHS = ['/onboarding']

// First-touch attribution: the first utm_* set a visitor lands with is kept in
// a first-party cookie, so every signup method (email, Google) can record it
// (lib/attribution/utm.ts; written to signup_utm by app/auth/callback).
export async function middleware(request: NextRequest) {
  const response = await handle(request)
  if (!request.cookies.has(UTM_COOKIE)) {
    const utm = utmFromUrl(request.nextUrl.searchParams, request.nextUrl.pathname)
    if (utm) {
      // Next.js URL-encodes cookie values itself, so plain JSON here.
      response.cookies.set(UTM_COOKIE, JSON.stringify(utm), {
        maxAge: UTM_COOKIE_MAX_AGE, path: '/', sameSite: 'lax', secure: request.nextUrl.protocol === 'https:',
      })
    }
  }
  return response
}

async function handle(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must call getUser() not getSession() for security
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Features still in development (lib/features.ts): only users with dev
  // access may open them; everyone else — signed out or not — goes home.
  const gatedFeature = gatedFeatureForPath(pathname)
  if (gatedFeature) {
    let tier: string | null = null
    if (user) {
      const { data } = await supabase.from('profiles').select('subscription_tier').eq('id', user.id).single()
      tier = data?.subscription_tier ?? null
    }
    if (!canUseFeature(gatedFeature, tier)) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return NextResponse.redirect(url)
    }
    // Dev users get the page, search engines never should.
    supabaseResponse.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  const isProtected =
    PROTECTED_PATHS.some((p) => pathname.startsWith(p)) && !isPublicSeoPath(pathname)
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Onboarding + tier gates — the extra lookups only run on routes that need
  // them, so every other request stays a single getUser() call.
  const needsPremium = PREMIUM_PATHS.some((p) => pathname.startsWith(p))
  const needsElite = ELITE_PATHS.some((p) => pathname.startsWith(p))
  const needsOnboarding =
    ONBOARDING_GATED_PATHS.some((p) => pathname.startsWith(p)) &&
    !ONBOARDING_EXEMPT_PATHS.some((p) => pathname.startsWith(p)) &&
    !isPublicSeoPath(pathname)

  // Onboarding takes priority over the tier gates below.
  if (user && needsOnboarding && needsChoiceScreen(null, user.user_metadata?.signup_source)) {
    const { data: onboarding, error } = await supabase
      .from('user_onboarding')
      .select('onboarding_choice_seen_at')
      .eq('user_id', user.id)
      .maybeSingle()
    // A failed lookup never traps the user on /onboarding.
    if (!error && needsChoiceScreen(onboarding, user.user_metadata?.signup_source)) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  if (user && (needsPremium || needsElite)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    const tier = profile?.subscription_tier ?? 'free'
    const allowed = needsElite ? canAccessElite(tier) : canAccessPremium(tier)
    if (!allowed) {
      const url = request.nextUrl.clone()
      url.pathname = '/pricing'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  // Exclude /api/* — those requests are proxied to FastAPI which handles
  // its own JWT auth. Running getUser() here would call Supabase on every
  // API request AND could write a refreshed token to the response cookie
  // while FastAPI still receives the original (potentially stale) Bearer
  // token — causing spurious 401s on long-lived sessions.
  // robots.txt, the sitemaps, llms.txt and ai-sitemap.json are also excluded:
  // they are public by definition, and running a Supabase getUser() on every
  // crawler request would add a round trip to the files crawlers hit most.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|robots\\.txt|sitemap\\.xml|sitemaps/|llms\\.txt|ai-sitemap\\.json|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
