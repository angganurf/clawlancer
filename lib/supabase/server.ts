import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Server client for authenticated requests (respects RLS)
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component - ignore
          }
        },
      },
    }
  )
}

// Admin client with service role (bypasses RLS)
// Lazy-initialized to avoid crashing when env vars are missing at build time
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabaseAdmin: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAdmin: any = new Proxy({} as any, {
  get(_target, prop) {
    if (!_supabaseAdmin) {
      _supabaseAdmin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
    }
    return _supabaseAdmin[prop]
  },
})
