'use server'

import { revalidatePath } from 'next/cache'
import { getUserWithRole } from '@/lib/supabase/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export interface QCInspector {
  id: string
  email: string
  createdAt: string
  isBanned: boolean
}

export interface ActionResult {
  success: boolean
  error?: string
}

/**
 * listQCInspectors — every auth.users row with app_metadata.role === 'qc_inspector'.
 *
 * There's no dedicated `qc_inspectors` table (unlike manufacturing_units) —
 * QC inspectors aren't scoped to a location/unit, they see every job that
 * reaches 'complete' status. So "the list of QC inspectors" IS the list of
 * auth users with that role, fetched via the admin API.
 *
 * admin.auth.admin.listUsers() doesn't support filtering by app_metadata
 * server-side, so this fetches (paginated, 200/page — plenty for a project
 * this size) and filters in memory.
 */
export async function listQCInspectors(): Promise<QCInspector[]> {
  const { user, role } = await getUserWithRole()
  if (!user || role !== 'admin') return []

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 })
  if (error || !data) return []

  return data.users
    .filter((u) => u.app_metadata?.role === 'qc_inspector')
    .map((u) => ({
      id: u.id,
      email: u.email ?? '(no email)',
      createdAt: u.created_at,
      isBanned: Boolean(u.banned_until && new Date(u.banned_until) > new Date()),
    }))
    .sort((a, b) => a.email.localeCompare(b.email))
}

export interface CreateQCInspectorInput {
  email: string
  password: string
}

/** createQCInspector — admin-only. Creates a login pre-tagged with role: qc_inspector. */
export async function createQCInspector(input: CreateQCInspectorInput): Promise<ActionResult> {
  const { user, role } = await getUserWithRole()
  if (!user || role !== 'admin') return { success: false, error: 'Unauthorized' }

  const email = input.email.trim().toLowerCase()
  if (!email) return { success: false, error: 'Email is required.' }
  if (input.password.length < 6) return { success: false, error: 'Password must be at least 6 characters.' }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    app_metadata: { role: 'qc_inspector' },
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/qc-inspectors')
  return { success: true }
}

/** setQCInspectorBanned — suspend/restore login access without deleting the account or its inspection history. */
export async function setQCInspectorBanned(userId: string, banned: boolean): Promise<ActionResult> {
  const { user, role } = await getUserWithRole()
  if (!user || role !== 'admin') return { success: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, {
    // Supabase's ban API: '876000h' (~100 years) as an effectively-permanent
    // ban, 'none' to lift it. There's no simple boolean toggle in the API.
    ban_duration: banned ? '876000h' : 'none',
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/qc-inspectors')
  return { success: true }
}

/**
 * deleteQCInspector — admin-only, permanent.
 *
 * Unlike deleting a manufacturing unit (which only removes a metadata row
 * and explicitly leaves the login account intact), there's no separate
 * qc_inspectors table — this deletes the actual auth.users account. Refuses
 * if the inspector has any historical qc_inspections or installation_reports
 * tied to their id, since deleting them could orphan or silently detach real
 * inspection/certification history depending on how those foreign keys are
 * configured — safer to have admin use Suspend access instead for an
 * inspector who's done real work, and reserve Delete for accounts created
 * by mistake or never used.
 */
export async function deleteQCInspector(userId: string): Promise<ActionResult> {
  const { user, role } = await getUserWithRole()
  if (!user || role !== 'admin') return { success: false, error: 'Unauthorized' }

  const admin = createAdminClient()

  const [qcResult, installResult] = await Promise.all([
    admin.from('qc_inspections').select('id').eq('inspector_id', userId).limit(1),
    admin.from('installation_reports').select('id').eq('agent_id', userId).limit(1),
  ])

  if (qcResult.error || installResult.error) {
    console.error('[deleteQCInspector] history check error:', qcResult.error?.message ?? installResult.error?.message)
    return { success: false, error: 'Failed to check inspection history' }
  }

  if ((qcResult.data?.length ?? 0) > 0 || (installResult.data?.length ?? 0) > 0) {
    return {
      success: false,
      error: 'Cannot delete — this inspector has real inspection or site report history. Use Suspend access instead to preserve records.',
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/qc-inspectors')
  return { success: true }
}
