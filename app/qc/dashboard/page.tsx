import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserWithRole } from '@/lib/supabase/auth'
import { getJobsForQC, type ProductionJobForQC } from '@/lib/supabase/qc'

export const dynamic = 'force-dynamic'

// ─── Job row ──────────────────────────────────────────────────────────────────

function JobRow({ job }: { job: ProductionJobForQC }) {
  const loc = job.location
  const unit = job.unit

  const completedAgo = job.completed_at
    ? Math.floor((Date.now() - new Date(job.completed_at).getTime()) / (1000 * 60 * 60 * 24))
    : null

  const hasQty =
    (job.qty_tiles ?? 0) > 0 ||
    (job.qty_toilet_units ?? 0) > 0 ||
    (job.qty_ramp_units ?? 0) > 0 ||
    (job.qty_fittings ?? 0) > 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-mono font-bold text-indigo-600">{loc.location_code}</span>
            {completedAgo !== null && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                completedAgo === 0 ? 'bg-green-100 text-green-700' :
                completedAgo <= 3 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {completedAgo === 0 ? 'Today' : `${completedAgo}d ago`}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-gray-900">{loc.name ?? loc.location_code}</h3>
          {(loc.district || loc.block) && (
            <p className="text-xs text-gray-500 mt-0.5">{[loc.block, loc.district].filter(Boolean).join(', ')}</p>
          )}
        </div>
        <Link
          href={`/qc/inspect/${job.id}`}
          className="flex-shrink-0 inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Inspect →
        </Link>
      </div>

      {/* Unit + quantities */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="font-medium text-gray-700">{unit.name}</span>
        {hasQty && (
          <>
            {(job.qty_tiles ?? 0) > 0 && <span>{job.qty_tiles} sq ft tiles</span>}
            {(job.qty_toilet_units ?? 0) > 0 && <span>{job.qty_toilet_units} toilet units</span>}
            {(job.qty_ramp_units ?? 0) > 0 && <span>{job.qty_ramp_units} ramp units</span>}
            {(job.qty_fittings ?? 0) > 0 && <span>{job.qty_fittings} fitting sets</span>}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function QCDashboardPage({
  searchParams,
}: {
  searchParams: Record<string, string>
}) {
  let user: Awaited<ReturnType<typeof getUserWithRole>>['user'] = null
  let role: Awaited<ReturnType<typeof getUserWithRole>>['role'] = null

  try {
    ;({ user, role } = await getUserWithRole())
  } catch {
    redirect('/login')
  }

  if (!user || role !== 'qc_inspector') redirect('/login')

  let jobs: ProductionJobForQC[] = []
  let fetchError: string | null = null

  try {
    jobs = await getJobsForQC()
  } catch {
    fetchError = 'Could not load the QC queue. Please refresh.'
  }

  const justSubmitted = searchParams.submitted === '1'

  return (
    <div className="space-y-5">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">QC Inspection Queue</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {fetchError
            ? 'Error loading queue'
            : jobs.length === 0
            ? 'No jobs awaiting inspection'
            : `${jobs.length} job${jobs.length !== 1 ? 's' : ''} ready for inspection`}
        </p>
      </div>

      {/* ── Success toast after submission ─────────────────────────────────── */}
      {justSubmitted && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium">
          ✓ Inspection submitted successfully. PDF report is being generated.
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {fetchError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {/* ── Empty ─────────────────────────────────────────────────────────── */}
      {!fetchError && jobs.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-14 text-center">
          <div
            className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg
              className="w-6 h-6 text-indigo-400"
              width={24}
              height={24}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-600">All clear — no jobs awaiting QC</p>
          <p className="text-xs text-gray-400 mt-1">
            Jobs appear here when a manufacturing unit marks production complete.
          </p>
        </div>
      )}

      {/* ── Job list ──────────────────────────────────────────────────────── */}
      {jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  )
}
