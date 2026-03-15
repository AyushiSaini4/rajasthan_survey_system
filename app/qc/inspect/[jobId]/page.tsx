import { redirect, notFound } from 'next/navigation'
import { getUserWithRole } from '@/lib/supabase/auth'
import { getJobForQCInspection } from '@/lib/supabase/qc'
import QCInspectionForm from '@/components/qc/QCInspectionForm'

export const dynamic = 'force-dynamic'

interface Props {
  params: { jobId: string }
}

export default async function QCInspectPage({ params }: Props) {
  let user: Awaited<ReturnType<typeof getUserWithRole>>['user'] = null
  let role: Awaited<ReturnType<typeof getUserWithRole>>['role'] = null

  try {
    ;({ user, role } = await getUserWithRole())
  } catch {
    redirect('/login')
  }

  if (!user || role !== 'qc_inspector') redirect('/login')

  // Fetch the job — only returns if status === 'complete'
  let job = null
  try {
    job = await getJobForQCInspection(params.jobId)
  } catch {
    // DB error — notFound gives a clear 404 rather than a 500
  }

  if (!job) notFound()

  return <QCInspectionForm job={job} />
}
