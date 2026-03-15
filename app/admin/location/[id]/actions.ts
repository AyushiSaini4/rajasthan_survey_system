'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ─── Assign a location to a manufacturing unit ────────────────────────────────
// 1. Verifies the requesting user is an admin
// 2. Loads the location's latest survey to copy quantities
// 3. Creates a production_jobs row with those quantities
// 4. Updates location.status → 'assigned' and location.assigned_unit_id
// All mutations use the admin client (bypasses RLS) after server-side auth check.

export async function assignLocationToUnit(
  locationId: string,
  unitId: string
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

  // ── Fetch survey to copy quantities ─────────────────────────────────────────
  const admin = createAdminClient()

  const { data: surveyData, error: surveyError } = await admin
    .from('surveys')
    .select('id, qty_tiles, qty_toilet_units, qty_ramp_units, qty_fittings, qty_other')
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
      qty_tiles: surveyData.qty_tiles,
      qty_toilet_units: surveyData.qty_toilet_units,
      qty_ramp_units: surveyData.qty_ramp_units,
      qty_fittings: surveyData.qty_fittings,
      qty_other: surveyData.qty_other,
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
