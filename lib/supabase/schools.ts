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
// survey pipeline. Directory is small (comparable to the 1,250 locations),
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
