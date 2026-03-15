'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SurveySubmission {
  locationId:       string
  gpsLat:           number | null
  gpsLng:           number | null
  gpsAccuracy:      number | null
  toiletPresent:    boolean
  toiletCondition:  'good' | 'damaged' | 'missing' | null
  rampPresent:      boolean
  rampCondition:    'good' | 'damaged' | 'missing' | null
  hardwareCondition: 'good' | 'damaged' | 'missing'
  notes:            string
  qtyTiles:         number
  qtyToiletUnits:   number
  qtyRampUnits:     number
  qtyFittings:      number
  photoPaths:       string[]
}

export type SurveyResult =
  | { success: true }
  | { success: false; error: string }

// ─── Action ───────────────────────────────────────────────────────────────────

/**
 * submitSurvey — server action called from SurveyFormClient on form submit.
 *
 * Flow:
 * 1. Verify auth (server client uses the user's JWT cookie)
 * 2. Verify the location is assigned to this agent (via RLS on server client)
 * 3. Guard against duplicate submissions (status !== 'pending')
 * 4. INSERT into surveys (field_agent has INSERT via RLS)
 * 5. UPDATE locations.status → 'surveyed' (requires admin client — field_agent
 *    does not have UPDATE on locations per RLS policy)
 */
export async function submitSurvey(data: SurveySubmission): Promise<SurveyResult> {
  const supabase = createClient()

  // ── 1. Auth check ──────────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'You must be logged in to submit a survey.' }
  }

  // ── 2. Verify location is accessible to this agent (RLS enforces ownership) ─
  const { data: location, error: locError } = await supabase
    .from('locations')
    .select('id, status')
    .eq('id', data.locationId)
    .single()

  if (locError || !location) {
    return {
      success: false,
      error: 'Location not found or not assigned to your account.',
    }
  }

  // ── 3. Guard against duplicate submission ──────────────────────────────────
  if (location.status !== 'pending') {
    return {
      success: false,
      error: 'This location has already been surveyed and cannot be submitted again.',
    }
  }

  // ── 4. Insert survey record ────────────────────────────────────────────────
  const { error: surveyError } = await supabase.from('surveys').insert({
    location_id:        data.locationId,
    agent_id:           user.id,
    gps_lat:            data.gpsLat,
    gps_lng:            data.gpsLng,
    gps_accuracy:       data.gpsAccuracy,
    toilet_present:     data.toiletPresent,
    // Only store condition when the item is present
    toilet_condition:   data.toiletPresent  ? data.toiletCondition  : null,
    ramp_present:       data.rampPresent,
    ramp_condition:     data.rampPresent    ? data.rampCondition    : null,
    hardware_condition: data.hardwareCondition,
    notes:              data.notes.trim() || null,
    qty_tiles:          data.qtyTiles,
    qty_toilet_units:   data.qtyToiletUnits,
    qty_ramp_units:     data.qtyRampUnits,
    qty_fittings:       data.qtyFittings,
    photos:             data.photoPaths,
    videos:             [],
    is_offline_submission: false,
    synced_at:          new Date().toISOString(),
  })

  if (surveyError) {
    console.error('[submitSurvey] survey insert error:', surveyError.message)
    return { success: false, error: 'Failed to save survey data. Please try again.' }
  }

  // ── 5. Update location status → 'surveyed' ────────────────────────────────
  // Admin client required: field_agent RLS does not include UPDATE on locations.
  const adminClient = createAdminClient()
  const { error: updateError } = await adminClient
    .from('locations')
    .update({ status: 'surveyed' })
    .eq('id', data.locationId)

  if (updateError) {
    // Survey data is saved — this is recoverable. Log and continue.
    console.error('[submitSurvey] location status update error:', updateError.message)
  }

  return { success: true }
}
