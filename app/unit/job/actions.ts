'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserWithRole } from '@/lib/supabase/auth'
import type { ProductionJobStatus } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpdateJobResult {
  success: boolean
  error?: string
}

// ─── Guard helper ─────────────────────────────────────────────────────────────

async function verifyUnitOwnership(jobId: string): Promise<{
  unitId: string | null
  locationId: string | null
  error?: string
}> {
  const { user, role } = await getUserWithRole()
  if (!user || role !== 'manufacturing_unit') {
    return { unitId: null, locationId: null, error: 'Unauthorized' }
  }

  // Look up this user's manufacturing_unit record via admin client
  const adminClient = createAdminClient()
  const { data: unitRow, error: unitError } = await adminClient
    .from('manufacturing_units')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (unitError || !unitRow) {
    return { unitId: null, locationId: null, error: 'No manufacturing unit found for this user' }
  }

  // Verify the job belongs to this unit
  const supabase = createClient()
  const { data: job, error: jobError } = await supabase
    .from('production_jobs')
    .select('id, unit_id, location_id, status')
    .eq('id', jobId)
    .eq('unit_id', unitRow.id)
    .single()

  if (jobError || !job) {
    return { unitId: null, locationId: null, error: 'Job not found or access denied' }
  }

  return { unitId: unitRow.id as string, locationId: job.location_id as string }
}

// ─── Save progress + notes ────────────────────────────────────────────────────

/**
 * Updates progress_pct and production_notes on a production job.
 * Does NOT change the job status — status is changed via dedicated actions below.
 */
export async function saveJobProgress(
  jobId: string,
  progressPct: number,
  productionNotes: string
): Promise<UpdateJobResult> {
  const { unitId, error: guardError } = await verifyUnitOwnership(jobId)
  if (!unitId) return { success: false, error: guardError }

  // Clamp progress to 0–100 in steps of 10
  const clamped = Math.min(100, Math.max(0, Math.round(progressPct / 10) * 10))

  const supabase = createClient()
  const { error } = await supabase
    .from('production_jobs')
    .update({
      progress_pct: clamped,
      production_notes: productionNotes.trim() || null,
    })
    .eq('id', jobId)

  if (error) {
    console.error('[saveJobProgress]', error.message)
    return { success: false, error: 'Failed to save progress. Please try again.' }
  }

  return { success: true }
}

// ─── Start production ─────────────────────────────────────────────────────────

/**
 * Transitions: production_job.status pending → in_production
 *              location.status assigned → in_production
 */
export async function startProduction(jobId: string): Promise<UpdateJobResult> {
  const { unitId, locationId, error: guardError } = await verifyUnitOwnership(jobId)
  if (!unitId || !locationId) return { success: false, error: guardError }

  const supabase = createClient()

  // Guard: only allow if currently pending
  const { data: job } = await supabase
    .from('production_jobs')
    .select('status')
    .eq('id', jobId)
    .single()

  if (!job || job.status !== 'pending') {
    return { success: false, error: 'Job is not in pending state' }
  }

  // Update production job
  const { error: jobError } = await supabase
    .from('production_jobs')
    .update({ status: 'in_production' as ProductionJobStatus })
    .eq('id', jobId)

  if (jobError) {
    console.error('[startProduction] job update:', jobError.message)
    return { success: false, error: 'Failed to start production. Please try again.' }
  }

  // Update location status via admin client (unit RLS cannot UPDATE locations)
  const adminClient = createAdminClient()
  const { error: locError } = await adminClient
    .from('locations')
    .update({ status: 'in_production' })
    .eq('id', locationId)

  if (locError) {
    console.error('[startProduction] location update:', locError.message)
    // Non-fatal — job status was updated; location sync can be retried
  }

  return { success: true }
}

// ─── Mark production complete ──────────────────────────────────────────────────

/**
 * Transitions: production_job.status in_production → complete
 * Location status is NOT changed here — QC inspector handles that when they
 * inspect the goods and mark pass/fail.
 */
export async function markProductionComplete(jobId: string): Promise<UpdateJobResult> {
  const { unitId, error: guardError } = await verifyUnitOwnership(jobId)
  if (!unitId) return { success: false, error: guardError }

  const supabase = createClient()

  // Guard: only allow if currently in_production
  const { data: job } = await supabase
    .from('production_jobs')
    .select('status, progress_pct')
    .eq('id', jobId)
    .single()

  if (!job || job.status !== 'in_production') {
    return { success: false, error: 'Job is not currently in production' }
  }

  const { error } = await supabase
    .from('production_jobs')
    .update({
      status: 'complete' as ProductionJobStatus,
      progress_pct: 100,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  if (error) {
    console.error('[markProductionComplete]', error.message)
    return { success: false, error: 'Failed to mark complete. Please try again.' }
  }

  return { success: true }
}

// ─── Mark dispatched ──────────────────────────────────────────────────────────

/**
 * Transitions: production_job.status qc_passed → dispatched
 *              location.status qc_passed → dispatched
 * Only available after QC passes.
 */
export async function markDispatched(jobId: string): Promise<UpdateJobResult> {
  const { unitId, locationId, error: guardError } = await verifyUnitOwnership(jobId)
  if (!unitId || !locationId) return { success: false, error: guardError }

  const supabase = createClient()

  // Guard: only allow if currently qc_passed
  const { data: job } = await supabase
    .from('production_jobs')
    .select('status')
    .eq('id', jobId)
    .single()

  if (!job || job.status !== 'qc_passed') {
    return { success: false, error: 'Job must have passed QC before dispatch' }
  }

  const { error: jobError } = await supabase
    .from('production_jobs')
    .update({
      status: 'dispatched' as ProductionJobStatus,
      dispatched_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  if (jobError) {
    console.error('[markDispatched] job update:', jobError.message)
    return { success: false, error: 'Failed to mark dispatched. Please try again.' }
  }

  const adminClient = createAdminClient()
  const { error: locError } = await adminClient
    .from('locations')
    .update({ status: 'dispatched' })
    .eq('id', locationId)

  if (locError) {
    console.error('[markDispatched] location update:', locError.message)
  }

  return { success: true }
}
