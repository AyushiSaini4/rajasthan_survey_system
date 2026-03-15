import { createAdminClient } from './admin'
import type { Location, ManufacturingUnit, ProductionJob } from '@/types'

// ─── Extended type ────────────────────────────────────────────────────────────

export interface ProductionJobForQC {
  id: string
  location_id: string
  survey_id: string
  unit_id: string
  assigned_by: string
  assigned_at: string
  qty_tiles: number | null
  qty_toilet_units: number | null
  qty_ramp_units: number | null
  qty_fittings: number | null
  qty_other: Record<string, number> | null
  progress_pct: number
  status: ProductionJob['status']
  production_notes: string | null
  completed_at: string | null
  dispatched_at: string | null
  location: Pick<Location, 'id' | 'location_code' | 'name' | 'district' | 'block' | 'village'>
  unit: Pick<ManufacturingUnit, 'id' | 'name' | 'district'>
}

// ─── SELECT fragment shared by both queries ────────────────────────────────────

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
  location:locations(id, location_code, name, district, block, village),
  unit:manufacturing_units(id, name, district)
` as const

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns all production jobs with status = 'complete' — these are waiting
 * for a QC inspector to inspect them.
 * Uses admin client because RLS (when active) would otherwise require a
 * permissive SELECT policy for qc_inspector on production_jobs.
 */
export async function getJobsForQC(): Promise<ProductionJobForQC[]> {
  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('production_jobs')
    .select(JOB_SELECT)
    .eq('status', 'complete')
    .order('completed_at', { ascending: true }) // oldest-complete first

  if (error) {
    console.error('[getJobsForQC]', error.message)
    throw new Error('Failed to fetch QC queue')
  }

  return (data ?? []) as unknown as ProductionJobForQC[]
}

/**
 * Returns a single job by ID, only if its status is 'complete'.
 * Returning null for other statuses prevents inspecting already-processed jobs.
 */
export async function getJobForQCInspection(jobId: string): Promise<ProductionJobForQC | null> {
  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('production_jobs')
    .select(JOB_SELECT)
    .eq('id', jobId)
    .eq('status', 'complete')
    .single()

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('[getJobForQCInspection]', error.message)
    }
    return null
  }

  return data as unknown as ProductionJobForQC
}

/**
 * Returns how many previous inspections this job has had.
 * Used to set inspection_number = count + 1.
 */
export async function getInspectionCount(jobId: string): Promise<number> {
  const adminClient = createAdminClient()

  const { count, error } = await adminClient
    .from('qc_inspections')
    .select('*', { count: 'exact', head: true })
    .eq('production_job_id', jobId)

  if (error) {
    console.error('[getInspectionCount]', error.message)
    return 0
  }

  return count ?? 0
}
