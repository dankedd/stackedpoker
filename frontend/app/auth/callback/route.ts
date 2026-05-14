import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  // On Vercel and other proxied hosts, `origin` reflects the internal URL
  // rather than the public-facing domain. x-forwarded-host gives us the real one.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocal = process.env.NODE_ENV === 'development'
  const baseUrl = isLocal
    ? origin
    : forwardedHost
    ? `https://${forwardedHost}`
    : origin

  if (code) {
    // Pre-create the success redirect so session cookies can be attached to it
    // directly. Using NextResponse.redirect here (instead of cookies() from
    // next/headers) avoids the ambiguity of whether mutations to the
    // cookieStore are merged into a separately-returned NextResponse.
    const successResponse = NextResponse.redirect(`${baseUrl}${next}`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            // Write to the request for any subsequent calls in this handler,
            // AND write to the redirect response so the browser receives them.
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            cookiesToSet.forEach(({ name, value, options }) =>
              successResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    console.log('[auth/callback] exchangeCodeForSession:', error ? error.message : 'ok')

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      console.log('[auth/callback] user:', user?.id ?? 'none')

      if (user) {
        // Upsert profile for new OAuth users. ignoreDuplicates prevents
        // overwriting existing usernames on returning logins.
        const { error: upsertError } = await supabase.from('profiles').upsert(
          {
            id:         user.id,
            email:      user.email,
            full_name:  user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
            avatar_url: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
          },
          { onConflict: 'id', ignoreDuplicates: true },
        )
        if (upsertError) {
          console.warn('[auth/callback] profile upsert warning:', upsertError.message)
        }
      }

      console.log('[auth/callback] redirecting to:', `${baseUrl}${next}`)
      return successResponse
    }
  }

  console.warn('[auth/callback] failed — no code or exchange error')
  return NextResponse.redirect(`${baseUrl}/login?error=auth_callback_failed`)
}
