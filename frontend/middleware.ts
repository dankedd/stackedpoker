import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { canAccessPremium, canAccessElite } from '@/lib/entitlements'
import { isPublicSeoPath } from '@/lib/seo/routes'

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
  '/dashboard', '/history', '/settings',
  '/learn', '/bankroll', '/coach', '/coaching', '/community', '/challenges', '/solver',
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

// Logged in, hasn't completed the new-user skill assessment yet -> the
// onboarding flow, before the curriculum is ever shown. Excludes the
// onboarding route itself (redirect loop) and the public SEO lesson-slug
// route (same exemption PROTECTED_PATHS already gives it, for the same
// reason — it must stay reachable signed-out and this check never runs for
// signed-out requests anyway, but keeping the two exemptions in sync avoids
// a future drift).
const ONBOARDING_GATED_PATHS = ['/learn']
const ONBOARDING_EXEMPT_PATHS = ['/learn/onboarding']

export async function middleware(request: NextRequest) {
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

  // Tier + onboarding gates — only look up the profile when the route
  // actually needs it, so every other request stays a single getUser() call
  // as before. Both gates share the one query since they can both apply to
  // the same request (e.g. a Free-tier user who also hasn't onboarded).
  const needsPremium = PREMIUM_PATHS.some((p) => pathname.startsWith(p))
  const needsElite = ELITE_PATHS.some((p) => pathname.startsWith(p))
  const needsOnboarding =
    ONBOARDING_GATED_PATHS.some((p) => pathname.startsWith(p)) &&
    !ONBOARDING_EXEMPT_PATHS.some((p) => pathname.startsWith(p)) &&
    !isPublicSeoPath(pathname)

  if (user && (needsPremium || needsElite || needsOnboarding)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, assessment_completed')
      .eq('id', user.id)
      .single()

    // Onboarding takes priority — no point tier-gating a learner into
    // /pricing before they've even seen the curriculum once.
    if (needsOnboarding && !profile?.assessment_completed) {
      const url = request.nextUrl.clone()
      url.pathname = '/learn/onboarding'
      return NextResponse.redirect(url)
    }

    if (needsPremium || needsElite) {
      const tier = profile?.subscription_tier ?? 'free'
      const allowed = needsElite ? canAccessElite(tier) : canAccessPremium(tier)
      if (!allowed) {
        const url = request.nextUrl.clone()
        url.pathname = '/pricing'
        return NextResponse.redirect(url)
      }
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
