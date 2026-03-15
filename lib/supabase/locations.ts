import { createClient } from './server'
import type { Location } from '@/types'

// ─── Fetch all locations (admin only) ─────────────────────────────────────────
// Only selects columns needed for the dashboard list — keeps payload lean.

export async function getAllLocations(): Promise<Location[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('locations')
    .select(
      'id, location_code, name, district, block, village, address, ' +
      'latitude, longitude, assigned_agent, assigned_unit_id, status, created_at'
    )
    .order('location_code', { ascending: true })

  if (error) {
    console.error('[getAllLocations] Supabase error:', error.message)
    throw new Error('Failed to fetch locations')
  }

  return (data ?? []) as unknown as Location[]
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
