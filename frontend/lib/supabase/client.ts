import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Module-level singleton — @supabase/ssr 0.10.x does NOT auto-memoize
// createBrowserClient. Multiple instances cause race conditions on token
// refresh because each has independent in-memory state, even though they
// share cookie storage. One instance = one authoritative refresh queue.
let _client: SupabaseClient | null = null

export function createClient(): SupabaseClient {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _client
}
