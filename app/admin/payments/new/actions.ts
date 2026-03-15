'use server'

import { getUserWithRole } from '@/lib/supabase/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TrancheName, TriggerMilestone } from '@/types'

export interface NewContractData {
  supplierName: string
  totalValue: number
  locationId: string | null
  notes: string
  tranches: {
    name: TrancheName
    trigger: TriggerMilestone
    percentage: number
  }[]
}

export interface NewContractResult {
  success: boolean
  contractId?: string
  error?: string
}

export async function createPaymentContract(
  data: NewContractData
): Promise<NewContractResult> {
  const { user, role } = await getUserWithRole()
  if (!user || role !== 'admin') return { success: false, error: 'Unauthorized' }

  // Validate percentages sum to 100
  const total = data.tranches.reduce((sum, t) => sum + t.percentage, 0)
  if (Math.abs(total - 100) > 0.01) {
    return { success: false, error: 'Tranche percentages must add up to 100%' }
  }

  const admin = createAdminClient()

  // Insert contract
  const { data: contract, error: contractErr } = await admin
    .from('payment_contracts')
    .insert({
      supplier_name: data.supplierName.trim(),
      location_id: data.locationId || null,
      total_contract_value: data.totalValue,
      currency: 'INR',
      created_by: user.id,
      notes: data.notes.trim() || null,
    })
    .select('id')
    .single()

  if (contractErr || !contract) {
    console.error('[createPaymentContract]', contractErr?.message)
    return { success: false, error: 'Failed to create contract. Please try again.' }
  }

  const contractId = contract.id as string

  // Insert 4 tranches
  const trancheRows = data.tranches.map((t) => ({
    contract_id: contractId,
    tranche_name: t.name,
    trigger_milestone: t.trigger,
    percentage: t.percentage,
    amount: parseFloat(((data.totalValue * t.percentage) / 100).toFixed(2)),
    status: 'locked' as const,
  }))

  const { error: trancheErr } = await admin.from('payment_tranches').insert(trancheRows)

  if (trancheErr) {
    console.error('[createPaymentContract] tranches:', trancheErr.message)
    // Roll back the contract
    await admin.from('payment_contracts').delete().eq('id', contractId)
    return { success: false, error: 'Failed to create tranches. Please try again.' }
  }

  return { success: true, contractId }
}
