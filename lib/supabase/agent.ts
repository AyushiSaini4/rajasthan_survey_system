import { createClient } from './server'
import type { Location } from '@/types'

// ─── Agent locations ──────────────────────────────────────────────────────────

/**
 * Returns all locations assigned to the currently authenticated field agent.
 *
 * RLS policy `field_agent_select_locations` restricts the result set to rows
 * where `assigned_agent = auth.uid()` — this function does not need to pass
 * the agent ID explicitly; the Postgres policy enforces it.
 */
export async function getAgentLocations(): Promise<Location[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('locations')
    .select(
      'id, location_code, name, district, block, village, address, ' +
      'latitude, longitude, assigned_agent, assigned_unit_id, status, created_at'
    )
    .order('location_code', { ascending: true })

  if (error) {
    console.error('[getAgentLocations] Supabase error:', error.message)
    throw new Error('Failed to fetch your locations')
  }

  return (data ?? []) as unknown as Location[]
}

/**
 * Returns a single location by ID for a field agent.
 *
 * RLS prevents access to locations not assigned to this agent —
 * the query returns null rather than throwing if access is denied.
 */
export async function getLocationForAgent(locationId: string): Promise<Location | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', locationId)
    .single()

  if (error) {
    // PGRST116 = "no rows returned" (expected when location not assigned to agent)
    if (error.code !== 'PGRST116') {
      console.error('[getLocationForAgent] Supabase error:', error.message)
    }
    return null
  }

  return data as unknown as Location
}
