'use server'

import { getUserWithRole } from '@/lib/supabase/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export interface VerifyResult {
  success: boolean
  error?: string
}

export async function approveInstallationReport(
  reportId: string,
  verifierNotes: string
): Promise<VerifyResult> {
  const { user, role } = await getUserWithRole()
  if (!user || role !== 'verifier') return { success: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Fetch report to get location_id
  const { data: report, error: fetchErr } = await admin
    .from('installation_reports')
    .select('id, location_id, status')
    .eq('id', reportId)
    .single()

  if (fetchErr || !report) return { success: false, error: 'Report not found' }
  if (report.status === 'approved') return { success: false, error: 'Already approved' }

  // Update report
  const { error: updateErr } = await admin
    .from('installation_reports')
    .update({
      status: 'approved',
      verified_by: user.id,
      verified_at: now,
      verifier_notes: verifierNotes.trim() || null,
      rejection_reason: null,
    })
    .eq('id', reportId)

  if (updateErr) {
    console.error('[approveInstallationReport]', updateErr.message)
    return { success: false, error: 'Database error. Please try again.' }
  }

  // Update location status → 'verified' then 'closed'
  await admin
    .from('locations')
    .update({ status: 'closed' })
    .eq('id', report.location_id)

  // Auto-unlock 'On Verification' payment tranches
  const { data: contracts } = await admin
    .from('payment_contracts')
    .select('id')
    .eq('location_id', report.location_id)

  if (contracts && contracts.length > 0) {
    await admin
      .from('payment_tranches')
      .update({ status: 'unlocked', unlocked_at: now })
      .in('contract_id', contracts.map((c: { id: string }) => c.id))
      .eq('trigger_milestone', 'verified')
      .eq('status', 'locked')
  }

  return { success: true }
}

export async function rejectInstallationReport(
  reportId: string,
  rejectionReason: string,
  verifierNotes: string
): Promise<VerifyResult> {
  const { user, role } = await getUserWithRole()
  if (!user || role !== 'verifier') return { success: false, error: 'Unauthorized' }

  if (!rejectionReason.trim()) {
    return { success: false, error: 'Rejection reason is required' }
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { error } = await admin
    .from('installation_reports')
    .update({
      status: 'rejected',
      verified_by: user.id,
      verified_at: now,
      verifier_notes: verifierNotes.trim() || null,
      rejection_reason: rejectionReason.trim(),
    })
    .eq('id', reportId)

  if (error) {
    console.error('[rejectInstallationReport]', error.message)
    return { success: false, error: 'Database error. Please try again.' }
  }

  // Location stays at 'installed' — field agent must resubmit
  return { success: true }
}
