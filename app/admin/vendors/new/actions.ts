'use server'

import { createClient } from '@/lib/supabase/server'
import type { VendorOnboardingFormData } from '@/types'

export interface OnboardVendorResult {
  success: boolean
  vendorId?: string
  error?: string
}

export async function onboardVendor(
  data: Omit<VendorOnboardingFormData, 'bank_account_number_confirm'>
): Promise<OnboardVendorResult> {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorised — please log in.' }
    }

    const { data: vendor, error } = await supabase
      .from('vendors')
      .insert({
        company_name: data.company_name.trim(),
        vendor_type: data.vendor_type,
        registration_number: data.registration_number.trim() || null,
        contact_person: data.contact_person.trim(),
        phone: data.phone.trim(),
        email: data.email.trim() || null,
        website: data.website.trim() || null,
        address: data.address.trim(),
        district: data.district.trim(),
        city: data.city.trim(),
        state: data.state.trim(),
        pincode: data.pincode.trim(),
        gst_number: data.gst_number.trim().toUpperCase() || null,
        pan_number: data.pan_number.trim().toUpperCase() || null,
        bank_name: data.bank_name.trim(),
        bank_account_holder: data.bank_account_holder.trim(),
        bank_account_number: data.bank_account_number.trim(),
        bank_ifsc: data.bank_ifsc.trim().toUpperCase(),
        bank_account_type: data.bank_account_type,
        supply_categories: data.supply_categories,
        notes: data.notes.trim() || null,
        status: 'active',
        created_by: user.id,
      })
      .select('id')
      .single()

    if (error) {
      console.error('onboardVendor error:', error)
      if (error.code === '23505') {
        return { success: false, error: 'A vendor with this GST or PAN number already exists.' }
      }
      return { success: false, error: 'Failed to save vendor. Please try again.' }
    }

    return { success: true, vendorId: vendor.id }
  } catch (err) {
    console.error('onboardVendor unexpected error:', err)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}
