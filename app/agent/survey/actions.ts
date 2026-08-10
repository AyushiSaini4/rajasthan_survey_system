'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Answers } from '@/lib/survey/questionnaire'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Tags each entry in `photoPaths` so the server can route it to the right
 * column after upload. Built client-side in the same order photos were
 * compressed/uploaded — see SurveyFormClient's handleSubmit.
 */
export type PhotoKind = 'mandatory' | 'field_photo' | 'signature'

export interface PhotoMeta {
  kind: PhotoKind
  /** Slot id for 'mandatory' (see MANDATORY_PHOTO_SLOTS) or 'team'/'authority' for 'signature'. */
  slotId?: string
  /** Questionnaire field id for 'field_photo' (e.g. 'toilet_site_photo'). */
  fieldId?: string
}

export interface SurveySubmission {
  locationId: string

  // Section 2 — toilet-site GPS, captured alongside toilet_site_photo
  gpsLat: number | null
  gpsLng: number | null
  gpsAccuracy: number | null

  // Sections 1–2 (non-photo fields)
  answers: Answers

  // Sections 2 (inline field photos) and 3 (mandatory named photos), plus
  // Section 4 signatures — all photos travel together as one ordered list +
  // parallel metadata so the offline queue (which only knows how to store
  // generic File[]) never needs to understand the questionnaire's structure.
  photoPaths: string[]
  photoMeta: PhotoMeta[]

  // Section 4 — Declaration
  teamName: string
  authorityName: string
  authorityDesignation: string
  declarationDate: string
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
 * 4. Reconstruct structured photo fields (named_photos, field_attachments,
 *    signatures) from the flat photoPaths/photoMeta
 * 5. INSERT into surveys (field_agent has INSERT via RLS)
 * 6. UPDATE locations.status → 'surveyed' (requires admin client — field_agent
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

  // ── 4. Reconstruct structured photo fields from the flat list ──────────────
  const namedPhotos: Record<string, string> = {}
  const fieldAttachments: Record<string, string[]> = {}
  let teamSignature: string | null = null
  let authoritySignature: string | null = null

  data.photoPaths.forEach((path, i) => {
    const meta = data.photoMeta[i]
    if (!meta) return
    switch (meta.kind) {
      case 'mandatory':
        if (meta.slotId) namedPhotos[meta.slotId] = path
        break
      case 'field_photo':
        if (meta.fieldId) {
          if (!fieldAttachments[meta.fieldId]) fieldAttachments[meta.fieldId] = []
          fieldAttachments[meta.fieldId].push(path)
        }
        break
      case 'signature':
        if (meta.slotId === 'team') teamSignature = path
        if (meta.slotId === 'authority') authoritySignature = path
        break
    }
  })

  // ── 5. Insert survey record ────────────────────────────────────────────────
  const { error: surveyError } = await supabase.from('surveys').insert({
    location_id: data.locationId,
    agent_id: user.id,

    gps_lat: data.gpsLat,
    gps_lng: data.gpsLng,
    gps_accuracy: data.gpsAccuracy,

    answers: data.answers,
    named_photos: namedPhotos,
    field_attachments: fieldAttachments,
    photos: [],
    videos: [],

    team_name: data.teamName.trim() || null,
    team_signature: teamSignature,
    authority_name: data.authorityName.trim() || null,
    authority_designation: data.authorityDesignation.trim() || null,
    authority_signature: authoritySignature,
    declaration_date: data.declarationDate || null,

    is_offline_submission: false,
    synced_at: new Date().toISOString(),
  })

  if (surveyError) {
    console.error('[submitSurvey] survey insert error:', surveyError.message)
    return { success: false, error: 'Failed to save survey data. Please try again.' }
  }

  // ── 6. Update location status → 'surveyed' ────────────────────────────────
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
