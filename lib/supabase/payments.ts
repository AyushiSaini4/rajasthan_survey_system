import { createAdminClient } from './admin'
import type { PaymentContract, PaymentTranche, Location } from '@/types'

// ─── Extended types ───────────────────────────────────────────────────────────

export interface ContractWithLocation extends PaymentContract {
  location: Pick<Location, 'id' | 'location_code' | 'name'> | null
  tranches: PaymentTranche[]
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getAllContracts(): Promise<ContractWithLocation[]> {
  const admin = createAdminClient()

  const { data: contracts, error } = await admin
    .from('payment_contracts')
    .select('id, supplier_name, location_id, total_contract_value, currency, created_by, created_at, notes')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getAllContracts]', error.message)
    throw new Error('Failed to load payment contracts')
  }

  if (!contracts || contracts.length === 0) return []

  // Fetch tranches and locations for all contracts in two parallel queries
  const contractIds = contracts.map((c: PaymentContract) => c.id)
  const locationIds = contracts
    .map((c: PaymentContract) => c.location_id)
    .filter(Boolean) as string[]

  const [tranchesRes, locationsRes] = await Promise.all([
    admin
      .from('payment_tranches')
      .select('*')
      .in('contract_id', contractIds),
    locationIds.length > 0
      ? admin
          .from('locations')
          .select('id, location_code, name')
          .in('id', locationIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const tranches = (tranchesRes.data ?? []) as PaymentTranche[]
  const locations = (locationsRes.data ?? []) as Pick<Location, 'id' | 'location_code' | 'name'>[]

  return (contracts as PaymentContract[]).map((c) => ({
    ...c,
    location: locations.find((l) => l.id === c.location_id) ?? null,
    tranches: tranches.filter((t) => t.contract_id === c.id),
  }))
}

export async function getContractWithTranches(
  contractId: string
): Promise<ContractWithLocation | null> {
  const admin = createAdminClient()

  const { data: contract, error } = await admin
    .from('payment_contracts')
    .select('id, supplier_name, location_id, total_contract_value, currency, created_by, created_at, notes')
    .eq('id', contractId)
    .single()

  if (error || !contract) {
    if (error?.code !== 'PGRST116') console.error('[getContractWithTranches]', error?.message)
    return null
  }

  const c = contract as PaymentContract

  const [tranchesRes, locationRes] = await Promise.all([
    admin
      .from('payment_tranches')
      .select('*')
      .eq('contract_id', contractId)
      .order('percentage', { ascending: false }),
    c.location_id
      ? admin
          .from('locations')
          .select('id, location_code, name')
          .eq('id', c.location_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ])

  return {
    ...c,
    location: (locationRes.data as Pick<Location, 'id' | 'location_code' | 'name'> | null) ?? null,
    tranches: (tranchesRes.data ?? []) as PaymentTranche[],
  }
}

/** Fetch all location codes for the contract creation dropdown */
export async function getLocationsForDropdown(): Promise<
  Pick<Location, 'id' | 'location_code' | 'name'>[]
> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('locations')
    .select('id, location_code, name')
    .order('location_code', { ascending: true })

  if (error) {
    console.error('[getLocationsForDropdown]', error.message)
    return []
  }
  return (data ?? []) as Pick<Location, 'id' | 'location_code' | 'name'>[]
}
