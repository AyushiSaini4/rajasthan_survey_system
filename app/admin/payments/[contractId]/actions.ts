'use server'

import { getUserWithRole } from '@/lib/supabase/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export interface ReleaseTrancheResult {
  success: boolean
  error?: string
}

/**
 * Release a payment tranche.
 *
 * Rules:
 * - tranche must be 'unlocked' OR have trigger_milestone = 'manual' (Advance)
 * - admin must provide a non-empty payment reference
 * - system never auto-releases; human always confirms here
 */
export async function releaseTranche(
  trancheId: string,
  paymentReference: string
): Promise<ReleaseTrancheResult> {
  const { user, role } = await getUserWithRole()
  if (!user || role !== 'admin') return { success: false, error: 'Unauthorized' }

  if (!paymentReference.trim()) {
    return { success: false, error: 'Payment reference is required' }
  }

  const admin = createAdminClient()

  // Fetch the tranche to verify it's releasable
  const { data: tranche, error: fetchErr } = await admin
    .from('payment_tranches')
    .select('id, status, trigger_milestone, unlocked_at')
    .eq('id', trancheId)
    .single()

  if (fetchErr || !tranche) {
    return { success: false, error: 'Tranche not found' }
  }

  const isManual = tranche.trigger_milestone === 'manual'
  const isUnlocked = tranche.status === 'unlocked'
  const isLocked = tranche.status === 'locked'

  // Allow release if:
  // a) already unlocked by system (auto-unlock milestone was hit), OR
  // b) manual trigger (Advance) — admin can release directly from locked
  if (!isUnlocked && !(isManual && isLocked)) {
    if (tranche.status === 'released') {
      return { success: false, error: 'This tranche has already been released' }
    }
    return { success: false, error: 'This tranche cannot be released yet — milestone not reached' }
  }

  const now = new Date().toISOString()

  const { error: updateErr } = await admin
    .from('payment_tranches')
    .update({
      status: 'released',
      unlocked_at: isManual && isLocked ? now : tranche.unlocked_at ?? now,
      released_at: now,
      released_by: user.id,
      payment_reference: paymentReference.trim(),
    })
    .eq('id', trancheId)

  if (updateErr) {
    console.error('[releaseTranche]', updateErr.message)
    return { success: false, error: 'Database update failed. Please try again.' }
  }

  return { success: true }
}
