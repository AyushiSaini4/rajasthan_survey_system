import { createAdminClient } from './admin'
import type { ProductionJob, ManufacturingUnit, Location } from '@/types'

// ─── Why admin client everywhere in this file ─────────────────────────────────
//
// getUnitJobs and getJobForUnit previously used the user-scoped createClient().
// The embedded .select('location:locations(...)') join requires the querying
// user to also have SELECT on the locations table via RLS.  If those RLS
// policies are not active in production, the join silently returns null for
// every row — causing a TypeError at render time ("Cannot read properties of
// null, reading 'location_code'") that bubbles up to the error boundary.
//
// Fix: use createAdminClient() so the join always resolves regardless of RLS
// state.  Security is maintained programmatically:
//   • unitId always comes from getUnitForCurrentUser(user.id) — auth-gated
//   • getUnitJobs filters by unit_id = unitId
//   • getJobForUnit filters by BOTH job id AND unit_id
//   → a manufacturing_unit user can never access another unit's jobs
//
// ─────────────────────────────────────────────────────────────────────────────

// ─── Extended types ───────────────────────────────────────────────────────────

export interface ProductionJobWithLocation extends ProductionJob {
  location: Pick<Location, 'id' | 'location_code' | 'name' | 'district' | 'block' | 'village' | 'status'> | null
}

// ─── Shared select string ─────────────────────────────────────────────────────

const JOB_SELECT = `
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
`

// ─── Manufacturing unit lookup ────────────────────────────────────────────────

/**
 * Finds the ManufacturingUnit row whose user_id matches the given userId.
 * Accepts userId as a parameter so the caller does not need a second auth
 * round-trip. Uses admin client — access is scoped by .eq('user_id', userId).
 */
export async function getUnitForCurrentUser(userId: string): Promise<ManufacturingUnit | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('manufacturing_units')
      .select('id, name, district, contact_name, contact_phone, user_id, is_active')
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows — unit not yet set up for this user, not a system error
        console.log(`[getUnitForCurrentUser] No unit found for user ${userId}`)
        return null
      }
      console.error(
        '[getUnitForCurrentUser] Supabase query failed:',
        { code: error.code, message: error.message, hint: error.hint, userId }
      )
      return null
    }

    return data as unknown as ManufacturingUnit
  } catch (err) {
    console.error('[getUnitForCurrentUser] Unexpected exception:', err)
    return null
  }
}

// ─── Job queries ──────────────────────────────────────────────────────────────

/**
 * Returns all production jobs for a given unit, joined with their location.
 * Uses admin client so the locations join resolves regardless of RLS state.
 * Access restricted to the authenticated user's own unit via unitId filter.
 */
export async function getUnitJobs(unitId: string): Promise<ProductionJobWithLocation[]> {
  try {
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('production_jobs')
      .select(JOB_SELECT)
      .eq('unit_id', unitId)
      .order('assigned_at', { ascending: false })

    if (error) {
      console.error(
        '[getUnitJobs] Supabase query failed:',
        { code: error.code, message: error.message, hint: error.hint, unitId }
      )
      throw new Error(`Failed to fetch production jobs: ${error.message}`)
    }

    const jobs = (data ?? []) as unknown as ProductionJobWithLocation[]

    // Log a warning for any job where the location join returned null.
    // This indicates an orphaned production_job referencing a non-existent location.
    const nullLocations = jobs.filter((j) => !j.location)
    if (nullLocations.length > 0) {
      console.error(
        `[getUnitJobs] ${nullLocations.length}/${jobs.length} jobs have null location for unit ${unitId}. ` +
        `Job IDs: ${nullLocations.map((j) => j.id).join(', ')}`
      )
    }

    return jobs
  } catch (err) {
    console.error('[getUnitJobs] Unexpected exception:', err)
    throw err
  }
}

/**
 * Returns a single production job for a given unit, or null if not found.
 * Filters by BOTH job id AND unit_id — prevents cross-unit data access.
 * Uses admin client so the locations join resolves regardless of RLS state.
 */
export async function getJobForUnit(
  jobId: string,
  unitId: string
): Promise<ProductionJobWithLocation | null> {
  try {
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('production_jobs')
      .select(JOB_SELECT)
      .eq('id', jobId)
      .eq('unit_id', unitId)  // ownership check — unit cannot access other units' jobs
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        console.log(`[getJobForUnit] Job ${jobId} not found for unit ${unitId}`)
        return null
      }
      console.error(
        '[getJobForUnit] Supabase query failed:',
        { code: error.code, message: error.message, hint: error.hint, jobId, unitId }
      )
      return null
    }

    const job = data as unknown as ProductionJobWithLocation
    if (!job.location) {
      console.error(
        `[getJobForUnit] Job ${jobId} returned null location. ` +
        `location_id ${(data as { location_id: string }).location_id} has no matching row in locations.`
      )
    }

    return job
  } catch (err) {
    console.error('[getJobForUnit] Unexpected exception:', err)
    return null
  }
}
