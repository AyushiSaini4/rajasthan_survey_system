import { createClient } from '@supabase/supabase-js'

// Server-side only — never expose to client.
// The service role key bypasses ALL Row Level Security policies.
// Only use this for server-side operations where you enforce access control
// programmatically (e.g. filtering by user-owned IDs).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Fail fast with a clear message rather than a cryptic 401 from Supabase.
  // This surfaces immediately in Vercel Function logs if an env var is missing.
  if (!url) {
    console.error(
      '[createAdminClient] NEXT_PUBLIC_SUPABASE_URL is not set. ' +
      'Check Vercel → Project Settings → Environment Variables.'
    )
    throw new Error('Server configuration error: missing NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!key) {
    console.error(
      '[createAdminClient] SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Check Vercel → Project Settings → Environment Variables. ' +
      'This key is required for all server-side admin operations.'
    )
    throw new Error('Server configuration error: missing SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
