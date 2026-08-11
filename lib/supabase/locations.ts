import { createClient } from './server'
import { fetchAllPages } from './paginate'
import type { Location } from '@/types'

// ─── Fetch all locations (admin only) ─────────────────────────────────────────
// Only selects columns needed for the dashboard list — keeps payload lean.
// Paginated — see paginate.ts. With 1,236 real locations, this project's
// 1,000-row server cap means the Locations Dashboard and Rollout Tracker
// were quietly truncating with no error until this was added.

export async function getAllLocations(): Promise<Location[]> {
  const supabase = createClient()

  const { data, error } = await fetchAllPages<Location>((from, to) =>
    supabase
      .from('locations')
      .select(
        'id, location_code, name, district, block, village, address, ' +
        'latitude, longitude, assigned_agent, assigned_unit_id, status, created_at'
      )
      .order('location_code', { ascending: true })
      .range(from, to) as unknown as PromiseLike<{ data: Location[] | null; error: unknown }>
  )

  if (error) {
    console.error('[getAllLocations] Supabase error:', (error as { message?: string })?.message)
    throw new Error('Failed to fetch locations')
  }

  return data ?? []
}

// ─── Fetch a single location by ID ────────────────────────────────────────────

export async function getLocationById(id: string): Promise<Location | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[getLocationById] Supabase error:', error.message)
    return null
  }

  return data as unknown as Location
}
