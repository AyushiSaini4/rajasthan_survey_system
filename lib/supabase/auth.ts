import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

// Role → dashboard path mapping — single source of truth used by both
// the root page (server-side redirect) and any UI that needs to link roles.
export const ROLE_DASHBOARDS: Record<UserRole, string> = {
  field_agent:        '/agent/dashboard',
  manufacturing_unit: '/unit/dashboard',
  qc_inspector:       '/qc/dashboard',
  admin:              '/admin/dashboard',
  verifier:           '/verifier/dashboard',
}

/**
 * Returns the authenticated user and their role from app_metadata.
 *
 * Uses getUser() (network round-trip to Supabase) rather than getSession()
 * (local cache only) so the role is always authoritative and cannot be
 * spoofed by a tampered local cookie.
 *
 * Returns null for both user and role if not authenticated.
 */
export async function getUserWithRole(): Promise<{
  user: Awaited<ReturnType<ReturnType<typeof createClient>['auth']['getUser']>>['data']['user']
  role: UserRole | null
}> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, role: null }
  }

  // Role is set server-side via the service role key into app_metadata,
  // which is read-only from the client — cannot be tampered with.
  const role = (user.app_metadata?.role as UserRole) ?? null

  return { user, role }
}

/**
 * Returns just the dashboard path for the current user's role,
 * or '/login' if not authenticated or role is unrecognised.
 */
export async function getDashboardForCurrentUser(): Promise<string> {
  const { role } = await getUserWithRole()
  if (!role || !(role in ROLE_DASHBOARDS)) return '/login'
  return ROLE_DASHBOARDS[role]
}
