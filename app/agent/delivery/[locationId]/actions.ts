'use server'

import { getUserWithRole } from '@/lib/supabase/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export interface DeliveryResult {
  success: boolean
  error?: string
}

export async function confirmDelivery(data: {
  locationId: string
  gpsLat: number | null
  gpsLng: number | null
  gpsAccuracy: number | null
}): Promise<DeliveryResult> {
  const { user, role } = await getUserWithRole()
  if (!user || role !== 'field_agent') return { success: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Check for an existing report for this location
  const { data: existing } = await admin
    .from('installation_reports')
    .select('id, delivery_confirmed')
    .eq('location_id', data.locationId)
    .maybeSingle()

  if (existing?.delivery_confirmed) {
    return { success: false, error: 'Delivery already confirmed for this location' }
  }

  if (existing) {
    await admin
      .from('installation_reports')
      .update({
        delivery_confirmed: true,
        goods_received_at: now,
        goods_received_by: user.id,
        gps_lat: data.gpsLat,
        gps_lng: data.gpsLng,
        submitted_at: now,
      })
      .eq('id', existing.id)
  } else {
    const { error: insertErr } = await admin.from('installation_reports').insert({
      location_id: data.locationId,
      agent_id: user.id,
      gps_lat: data.gpsLat,
      gps_lng: data.gpsLng,
      delivery_confirmed: true,
      goods_received_at: now,
      goods_received_by: user.id,
      submitted_at: now,
      status: 'pending',
    })
    if (insertErr) {
      console.error('[confirmDelivery] insert:', insertErr.message)
      return { success: false, error: 'Failed to save delivery record. Please try again.' }
    }
  }

  // Update location status → 'delivered'
  await admin.from('locations').update({ status: 'delivered' }).eq('id', data.locationId)

  // Auto-unlock 'On Delivery' payment tranches
  const { data: contracts } = await admin
    .from('payment_contracts')
    .select('id')
    .eq('location_id', data.locationId)

  if (contracts && contracts.length > 0) {
    await admin
      .from('payment_tranches')
      .update({ status: 'unlocked', unlocked_at: now })
      .in('contract_id', contracts.map((c: { id: string }) => c.id))
      .eq('trigger_milestone', 'delivered')
      .eq('status', 'locked')
  }

  return { success: true }
}
