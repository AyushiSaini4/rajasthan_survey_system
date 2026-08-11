import { createClient } from './server'
import type { CWSNSchool } from '@/types'

// ─── Server-side queries — used by admin pages (RolloutTracker) ───────────────
//
// Kept separate from schools-search.ts (browser client) because this file
// pulls in the server client (next/headers), which cannot be bundled into
// client components. SchoolSearchCombobox uses schools-search.ts instead.

const SCHOOL_SELECT =
  'id, sno, district, block, school_name, udise_code, cwsn_toilet_no, ramp_no, ' +
  'tactile_tile_sqft, grab_bar_no, braille_signage_no, braille_layout_plan_no, ' +
  'sanction_amount_lacs, location_id, created_at'

// ─── Fetch the full CWSN school directory (admin only) ─────────────────────────
// Used by RolloutTracker to compute how many known schools have entered the
// survey pipeline. Directory is small (comparable to the 1,236 locations),
// so a single unpaginated fetch is fine.

export async function getAllCWSNSchools(): Promise<CWSNSchool[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('cwsn_schools')
    .select(SCHOOL_SELECT)
    .order('school_name', { ascending: true })

  if (error) {
    console.error('[getAllCWSNSchools] Supabase error:', error.message)
    throw new Error('Failed to fetch CWSN school directory')
  }

  return (data ?? []) as unknown as CWSNSchool[]
}

// ─── Fetch the sanctioned CWSN school record for one location ─────────────────
// Used on the admin location detail page to pre-fill production-job quantities
// with the RCSE sanction figures (the actual source of truth for how many
// toilet/ramp/tile/etc. units a school was approved for) rather than trying to
// derive counts from the field survey, which was never designed to capture
// unit quantities — it records feasibility and measurements, not counts.
// Returns null for locations with no matching sanctioned school (e.g.
// Anganwadi Kendras, or schools that simply weren't part of the sanctioned
// batch — see the cwsn_schools directory coverage discussion).

export async function getSanctionedSchoolForLocation(locationId: string): Promise<CWSNSchool | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('cwsn_schools')
    .select(SCHOOL_SELECT)
    .eq('location_id', locationId)
    .maybeSingle()

  if (error) {
    console.error('[getSanctionedSchoolForLocation] Supabase error:', error.message)
    return null
  }

  return data ? (data as unknown as CWSNSchool) : null
}
