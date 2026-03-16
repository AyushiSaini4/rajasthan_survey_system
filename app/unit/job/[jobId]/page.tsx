import { redirect, notFound } from 'next/navigation'
import { getUserWithRole } from '@/lib/supabase/auth'
import { getUnitForCurrentUser, getJobForUnit } from '@/lib/supabase/unit'
import JobDetailClient from '@/components/unit/JobDetailClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { jobId: string }
}

export default async function JobDetailPage({ params }: Props) {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  let user: Awaited<ReturnType<typeof getUserWithRole>>['user'] = null
  let role: Awaited<ReturnType<typeof getUserWithRole>>['role'] = null

  try {
    ;({ user, role } = await getUserWithRole())
  } catch (err) {
    console.error('[JobDetailPage] getUserWithRole failed:', err)
    redirect('/login')
  }

  if (!user || role !== 'manufacturing_unit') redirect('/login')

  // ── Unit lookup ────────────────────────────────────────────────────────────
  let unit = null
  try {
    unit = await getUnitForCurrentUser(user.id)
  } catch (err) {
    console.error('[JobDetailPage] getUnitForCurrentUser failed for user', user.id, err)
  }

  if (!unit) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center">
        <p className="text-sm font-semibold text-red-800">No manufacturing unit found for your account.</p>
        <p className="text-xs text-red-600 mt-1">Please contact an admin to set up your unit.</p>
      </div>
    )
  }

  // ── Job fetch — wrapped in try/catch so a Supabase error shows notFound
  // rather than hitting the error boundary. getJobForUnit returns null (not
  // throws) for most errors, but we guard the await itself too.
  let job = null
  try {
    job = await getJobForUnit(params.jobId, unit.id)
  } catch (err) {
    console.error('[JobDetailPage] getJobForUnit failed for job', params.jobId, 'unit', unit.id, err)
  }

  if (!job) notFound()

  return <JobDetailClient job={job} />
}
