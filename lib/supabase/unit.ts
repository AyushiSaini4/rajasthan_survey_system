import { createClient } from './server'
import { createAdminClient } from './admin'
import type { ProductionJob, ManufacturingUnit, Location } from '@/types'

// Note: createClient is used by getUnitJobs and getJobForUnit (user-scoped RLS queries).
// getUnitForCurrentUser uses only createAdminClient so it doesn't call cookies() internally.

// ─── Extended types ───────────────────────────────────────────────────────────

export interface ProductionJobWithLocation extends ProductionJob {
  location: Pick<Location, 'id' | 'location_code' | 'name' | 'district' | 'block' | 'village' | 'status'>
}

// ─── Manufacturing unit lookup ────────────────────────────────────────────────

/**
 * Finds the ManufacturingUnit row whose user_id matches the given userId.
 *
 * Accepts userId as a parameter so the caller (a server component that already
 * has the user from getUserWithRole()) doesn't need to make a second auth
 * round-trip here. Using only the admin client avoids the createClient() /
 * cookies() call that was causing the 500 before the error boundary mounted.
 */
export async function getUnitForCurrentUser(userId: string): Promise<ManufacturingUnit | null> {
  try {
    const adminClient = createAdminClient()
    const { data, error } = await adminClient
      .from('manufacturing_units')
      .select('id, name, district, contact_name, contact_phone, user_id, is_active')
      .eq('user_id', userId)
      .single()

    if (error) {
      // PGRST116 = no rows found (unit not yet set up) — not a real error
      if (error.code !== 'PGRST116') {
        console.error('[getUnitForCurrentUser]', error.message)
      }
      return null
    }

    return data as unknown as ManufacturingUnit
  } catch (err) {
    console.error('[getUnitForCurrentUser] unexpected error:', err)
    return null
  }
}

// ─── Job queries ──────────────────────────────────────────────────────────────

/**
 * Returns all production jobs for a given unit, joined with their location.
 * RLS ensures the manufacturing_unit user can only read their own unit's jobs.
 */
export async function getUnitJobs(unitId: string): Promise<ProductionJobWithLocation[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('production_jobs')
    .select(`
      id,
      location_id,
      survey_id,
      unit_id,
      assigned_by,
      assigned_at,
      qty_tiles,
      qty_toilet_units,
      qty_ramp_units,
      qty_fittings,
      qty_other,
      progress_pct,
      status,
      production_notes,
      completed_at,
      dispatched_at,
      location:locations(id, location_code, name, district, block, village, status)
    `)
    .eq('unit_id', unitId)
    .order('assigned_at', { ascending: false })

  if (error) {
    console.error('[getUnitJobs]', error.message)
    throw new Error('Failed to fetch production jobs')
  }

  return (data ?? []) as unknown as ProductionJobWithLocation[]
}

/**
 * Returns a single production job for a given unit, or null if not found.
 * The .eq('unit_id', unitId) guard ensures units cannot access other units' jobs.
 */
export async function getJobForUnit(
  jobId: string,
  unitId: string
): Promise<ProductionJobWithLocation | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('production_jobs')
    .select(`
      id,
      location_id,
      survey_id,
      unit_id,
      assigned_by,
      assigned_at,
      qty_tiles,
      qty_toilet_units,
      qty_ramp_units,
      qty_fittings,
      qty_other,
      progress_pct,
      status,
      production_notes,
      completed_at,
      dispatched_at,
      location:locations(id, location_code, name, district, block, village, status)
    `)
    .eq('id', jobId)
    .eq('unit_id', unitId)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('[getJobForUnit]', error.message)
    }
    return null
  }

  return data as unknown as ProductionJobWithLocation
}
