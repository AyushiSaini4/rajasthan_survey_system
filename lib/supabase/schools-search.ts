import { createClient } from './client'
import type { CWSNSchool } from '@/types'

// ─── Browser-client query — used by SchoolSearchCombobox ───────────────────────
//
// Separate from schools.ts (server client) so this file only ever pulls in
// the browser Supabase client — safe to import from a 'use client' component
// without dragging next/headers into the client bundle.

const SCHOOL_SELECT =
  'id, sno, district, block, school_name, udise_code, cwsn_toilet_no, ramp_no, ' +
  'tactile_tile_sqft, grab_bar_no, braille_signage_no, braille_layout_plan_no, ' +
  'sanction_amount_lacs, location_id, created_at'

/**
 * Searches the CWSN school directory by name or UDISE code.
 * Returns [] for queries shorter than 2 characters (avoids a full-table
 * ilike scan on every keystroke) and swallows errors — the combobox falls
 * back to manual entry if the network/query fails, so a thrown error here
 * would just be extra noise for something the UI already handles.
 */
export async function searchCWSNSchools(query: string, limit = 8): Promise<CWSNSchool[]> {
  const q = query.trim()
  if (q.length < 2) return []

  const supabase = createClient()
  const escaped = q.replace(/[%_]/g, (c) => `\\${c}`)

  const { data, error } = await supabase
    .from('cwsn_schools')
    .select(SCHOOL_SELECT)
    .or(`school_name.ilike.%${escaped}%,udise_code.ilike.%${escaped}%`)
    .order('school_name', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[searchCWSNSchools] Supabase error:', error.message)
    return []
  }

  return (data ?? []) as unknown as CWSNSchool[]
}
