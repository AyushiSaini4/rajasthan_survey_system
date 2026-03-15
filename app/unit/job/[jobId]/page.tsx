import { redirect, notFound } from 'next/navigation'
import { getUserWithRole } from '@/lib/supabase/auth'
import { getUnitForCurrentUser, getJobForUnit } from '@/lib/supabase/unit'
import JobDetailClient from '@/components/unit/JobDetailClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { jobId: string }
}

export default async function JobDetailPage({ params }: Props) {
  // ── Auth guard — wrapped in try/catch so a transient Supabase network error
  // doesn't bubble up as a hard 500; we redirect to login instead.
  let user: Awaited<ReturnType<typeof getUserWithRole>>['user'] = null
  let role: Awaited<ReturnType<typeof getUserWithRole>>['role'] = null

  try {
    ;({ user, role } = await getUserWithRole())
  } catch {
    redirect('/login')
  }

  if (!user || role !== 'manufacturing_unit') redirect('/login')

  // Find this user's unit.
  // Pass user.id directly — avoids a second auth.getUser() inside the lib function.
  let unit = null
  try {
    unit = await getUnitForCurrentUser(user.id)
  } catch {
    // Unexpected failure — show the "no unit" screen rather than crashing
  }

  if (!unit) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center">
        <p className="text-sm font-semibold text-red-800">No manufacturing unit found for your account.</p>
        <p className="text-xs text-red-600 mt-1">Please contact an admin to set up your unit.</p>
      </div>
    )
  }

  // Fetch job — enforces unit ownership in the query
  const job = await getJobForUnit(params.jobId, unit.id)
  if (!job) notFound()

  return <JobDetailClient job={job} />
}
