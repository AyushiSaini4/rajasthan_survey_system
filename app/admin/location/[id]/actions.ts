'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ─── Assign a location to a manufacturing unit ────────────────────────────────
// 1. Verifies the requesting user is an admin
// 2. Confirms a survey exists for this location (still required before assignment)
// 3. Creates a production_jobs row using the quantities the admin confirmed in
//    the UI — pre-filled from cwsn_schools (the RCSE sanction record), NOT from
//    surveys.qty_* (those columns are never populated by the survey form; the
//    17-section questionnaire captures feasibility and measurements, not unit
//    counts, so reading quantities from there was always going to return nulls)
// 4. Updates location.status → 'assigned' and location.assigned_unit_id
// All mutations use the admin client (bypasses RLS) after server-side auth check.

export interface AssignQuantities {
  qtyTiles: number | null
  qtyToiletUnits: number | null
  qtyRampUnits: number | null
  qtyFittings: number | null
  qtyOther: Record<string, number> | null
}

export async function assignLocationToUnit(
  locationId: string,
  unitId: string,
  quantities: AssignQuantities
): Promise<{ success: boolean; error?: string }> {
  // ── Auth check ──────────────────────────────────────────────────────────────
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  const role = user.app_metadata?.role as string | undefined
  if (role !== 'admin') {
    return { success: false, error: 'Forbidden — admin only' }
  }

  // ── Confirm a survey exists ─────────────────────────────────────────────────
  const admin = createAdminClient()

  const { data: surveyData, error: surveyError } = await admin
    .from('surveys')
    .select('id')
    .eq('location_id', locationId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (surveyError) {
    console.error('[assignLocationToUnit] survey fetch error:', surveyError.message)
    return { success: false, error: 'Failed to load survey data' }
  }

  if (!surveyData) {
    return { success: false, error: 'No survey found for this location — survey must be completed before assignment' }
  }

  // ── Create production job ───────────────────────────────────────────────────
  const { data: newJob, error: jobError } = await admin
    .from('production_jobs')
    .insert({
      location_id: locationId,
      survey_id: surveyData.id,
      unit_id: unitId,
      assigned_by: user.id,
      qty_tiles: quantities.qtyTiles,
      qty_toilet_units: quantities.qtyToiletUnits,
      qty_ramp_units: quantities.qtyRampUnits,
      qty_fittings: quantities.qtyFittings,
      qty_other: quantities.qtyOther,
      status: 'pending',
      progress_pct: 0,
    })
    .select('id')
    .single()

  if (jobError || !newJob) {
    console.error('[assignLocationToUnit] production job insert error:', jobError?.message)
    return { success: false, error: 'Failed to create production job' }
  }

  // ── Update location status and assigned unit ────────────────────────────────
  const { error: locationError } = await admin
    .from('locations')
    .update({
      status: 'assigned',
      assigned_unit_id: unitId,
    })
    .eq('id', locationId)

  if (locationError) {
    console.error('[assignLocationToUnit] location update error:', locationError.message)
    // Production job was created — attempt to clean it up
    await admin.from('production_jobs').delete().eq('id', newJob.id)
    return { success: false, error: 'Failed to update location status' }
  }

  // ── Revalidate pages that show this location ────────────────────────────────
  revalidatePath(`/admin/location/${locationId}`)
  revalidatePath('/admin/dashboard')

  return { success: true }
}

// ─── Edit quantities on an existing production job ────────────────────────────
// Separate from assignLocationToUnit's initial quantities: this lets admin go
// back and fill in / correct material quantities on a job that's already been
// assigned — needed for locations with no cwsn_schools sanction match (like
// RJ-0002), where quantities were deliberately left blank at assignment time
// rather than fabricated, and someone with the real figures needs a way to
// enter them afterward.

export async function updateProductionJobQuantities(
  jobId: string,
  quantities: AssignQuantities
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  const role = user.app_metadata?.role as string | undefined
  if (role !== 'admin') {
    return { success: false, error: 'Forbidden — admin only' }
  }

  const admin = createAdminClient()

  const { data: job, error: fetchError } = await admin
    .from('production_jobs')
    .select('id, location_id')
    .eq('id', jobId)
    .single()

  if (fetchError || !job) {
    return { success: false, error: 'Production job not found' }
  }

  const { error: updateError } = await admin
    .from('production_jobs')
    .update({
      qty_tiles: quantities.qtyTiles,
      qty_toilet_units: quantities.qtyToiletUnits,
      qty_ramp_units: quantities.qtyRampUnits,
      qty_fittings: quantities.qtyFittings,
      qty_other: quantities.qtyOther,
    })
    .eq('id', jobId)

  if (updateError) {
    console.error('[updateProductionJobQuantities] update error:', updateError.message)
    return { success: false, error: 'Failed to update quantities' }
  }

  revalidatePath(`/admin/location/${job.location_id}`)
  revalidatePath('/unit/dashboard')

  return { success: true }
}

// ─── Assign a field agent to a location ──────────────────────────────────────
export async function assignAgentToLocation(
  locationId: string,
  agentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) return { success: false, error: 'Not authenticated' }
  const role = user.app_metadata?.role as string | undefined
  if (role !== 'admin') return { success: false, error: 'Forbidden — admin only' }

  const admin = createAdminClient()

  const { error: locationError } = await admin
    .from('locations')
    .update({ assigned_agent: agentId })
    .eq('id', locationId)

  if (locationError) {
    console.error('[assignAgentToLocation] error:', locationError.message)
    return { success: false, error: 'Failed to assign agent' }
  }

  revalidatePath(`/admin/location/${locationId}`)
  revalidatePath('/admin/dashboard')
  return { success: true }
}
