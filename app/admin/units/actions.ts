'use server'

import { revalidatePath } from 'next/cache'
import { getUserWithRole } from '@/lib/supabase/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export interface CreateUnitInput {
  name: string
  district: string
  contactName: string
  contactPhone: string
  email: string
  password: string
}

export interface CreateUnitResult {
  success: boolean
  error?: string
}

/**
 * createUnitWithLogin — the "Add Unit" flow, admin-only.
 *
 * Creates BOTH the manufacturing_units row AND the login the unit will
 * actually use, in one step. Previously these were disconnected: an admin
 * could create a unit row with no way to log in as it, requiring a manual
 * Supabase dashboard + SQL round-trip (create auth user → set
 * app_metadata.role → UPDATE manufacturing_units.user_id) every single
 * time a new unit was onboarded.
 *
 * Order matters: create the auth user first. If the manufacturing_units
 * insert then fails, delete the orphaned auth user so a retry doesn't hit
 * "email already registered".
 */
export async function createUnitWithLogin(input: CreateUnitInput): Promise<CreateUnitResult> {
  const { user, role } = await getUserWithRole()
  if (!user || role !== 'admin') return { success: false, error: 'Unauthorized' }

  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  const password = input.password

  if (!name) return { success: false, error: 'Unit name is required.' }
  if (!email) return { success: false, error: 'Login email is required.' }
  if (password.length < 6) return { success: false, error: 'Password must be at least 6 characters.' }

  const admin = createAdminClient()

  // ── 1. Create the auth user with role pre-set in app_metadata ──────────────
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip the confirmation email — admin is vouching for this account
    app_metadata: { role: 'manufacturing_unit' },
  })

  if (createErr || !created.user) {
    return { success: false, error: createErr?.message ?? 'Failed to create login.' }
  }

  // ── 2. Create the manufacturing_units row, linked to that login ────────────
  const { error: insertErr } = await admin.from('manufacturing_units').insert({
    name,
    district: input.district.trim() || null,
    contact_name: input.contactName.trim() || null,
    contact_phone: input.contactPhone.trim() || null,
    is_active: true,
    user_id: created.user.id,
  })

  if (insertErr) {
    // Roll back the auth user so the email isn't stranded on a failed unit.
    await admin.auth.admin.deleteUser(created.user.id)
    return { success: false, error: insertErr.message }
  }

  revalidatePath('/admin/units')
  return { success: true }
}
