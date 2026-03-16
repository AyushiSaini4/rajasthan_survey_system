import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserWithRole } from '@/lib/supabase/auth'
import { getUnitForCurrentUser, getUnitJobs, type ProductionJobWithLocation } from '@/lib/supabase/unit'
import type { ProductionJobStatus } from '@/types'

export const dynamic = 'force-dynamic'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(status: ProductionJobStatus): string {
  switch (status) {
    case 'pending':       return 'Pending'
    case 'in_production': return 'In Production'
    case 'complete':      return 'Complete — Awaiting QC'
    case 'qc_passed':     return 'QC Passed'
    case 'qc_failed':     return 'QC Failed'
    case 'dispatched':    return 'Dispatched'
  }
}

function statusBadgeClass(status: ProductionJobStatus): string {
  switch (status) {
    case 'pending':       return 'bg-gray-100 text-gray-700 border-gray-300'
    case 'in_production': return 'bg-blue-100 text-blue-700 border-blue-300'
    case 'complete':      return 'bg-yellow-100 text-yellow-700 border-yellow-300'
    case 'qc_passed':     return 'bg-green-100 text-green-700 border-green-300'
    case 'qc_failed':     return 'bg-red-100 text-red-700 border-red-300'
    case 'dispatched':    return 'bg-purple-100 text-purple-700 border-purple-300'
  }
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({ job }: { job: ProductionJobWithLocation }) {
  // Defensive: location join can return null if the locations row is missing or
  // RLS is blocking the join.  Render a fallback rather than crashing the page.
  const loc = job.location
  if (!loc) {
    return (
      <div className="bg-white rounded-lg border border-amber-200 p-4 text-sm text-amber-700">
        Job {job.id.slice(0, 8)}… — location data unavailable (contact admin)
      </div>
    )
  }

  const hasQty =
    (job.qty_tiles ?? 0) > 0 ||
    (job.qty_toilet_units ?? 0) > 0 ||
    (job.qty_ramp_units ?? 0) > 0 ||
    (job.qty_fittings ?? 0) > 0

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-orange-300 hover:shadow-sm transition-all">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-mono text-gray-400">{loc.location_code}</span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {loc.name ?? loc.location_code}
          </h3>
          {(loc.district || loc.block) && (
            <p className="text-xs text-gray-500 mt-0.5">
              {[loc.block, loc.district].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ${statusBadgeClass(job.status)}`}
        >
          {statusLabel(job.status)}
        </span>
      </div>

      {/* Quantities */}
      {hasQty && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-gray-600">
          {(job.qty_tiles ?? 0) > 0 && (
            <span>{job.qty_tiles} sq ft tiles</span>
          )}
          {(job.qty_toilet_units ?? 0) > 0 && (
            <span>{job.qty_toilet_units} toilet units</span>
          )}
          {(job.qty_ramp_units ?? 0) > 0 && (
            <span>{job.qty_ramp_units} ramp units</span>
          )}
          {(job.qty_fittings ?? 0) > 0 && (
            <span>{job.qty_fittings} fitting sets</span>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">Progress</span>
          <span className="text-xs font-semibold text-gray-700">{job.progress_pct ?? 0}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${job.status === 'qc_failed' ? 'bg-red-500' : 'bg-orange-500'}`}
            style={{ width: `${job.progress_pct ?? 0}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          Assigned {new Date(job.assigned_at).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short',
          })}
        </span>
        <Link
          href={`/unit/job/${job.id}`}
          className="inline-flex items-center px-3 py-1.5 bg-orange-50 text-orange-700 text-xs font-semibold rounded-md hover:bg-orange-100 border border-orange-200 transition-colors"
        >
          View Job →
        </Link>
      </div>
    </div>
  )
}

// ─── Group section ────────────────────────────────────────────────────────────

function JobGroup({
  title,
  jobs,
  emptyText,
  accent,
}: {
  title: string
  jobs: ProductionJobWithLocation[]
  emptyText: string
  accent: string
}) {
  if (jobs.length === 0 && !emptyText) return null

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        {jobs.length > 0 && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${accent}`}
          >
            {jobs.length}
          </span>
        )}
      </div>
      {jobs.length > 0 ? (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      ) : (
        emptyText && <p className="text-sm text-gray-400 py-4 text-center">{emptyText}</p>
      )}
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function UnitDashboardPage() {
  // ── Auth guard — wrapped in try/catch so a transient Supabase network error
  // doesn't bubble up as a hard 500; we redirect to login instead.
  let user: Awaited<ReturnType<typeof getUserWithRole>>['user'] = null
  let role: Awaited<ReturnType<typeof getUserWithRole>>['role'] = null

  try {
    ;({ user, role } = await getUserWithRole())
  } catch (err) {
    console.error('[UnitDashboard] getUserWithRole failed:', err)
    redirect('/login')
  }

  if (!user || role !== 'manufacturing_unit') redirect('/login')

  // Find this user's manufacturing unit record.
  // Pass user.id directly — avoids a second auth.getUser() inside the lib function.
  let unit = null
  try {
    unit = await getUnitForCurrentUser(user.id)
  } catch (err) {
    // createAdminClient() throws if SUPABASE_SERVICE_ROLE_KEY is missing —
    // that error is logged inside getUnitForCurrentUser, but log it here too
    // so it's easy to find in Vercel logs alongside the page context.
    console.error('[UnitDashboard] getUnitForCurrentUser failed for user', user.id, err)
  }

  if (!unit) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center">
        <p className="text-sm font-semibold text-red-800">No manufacturing unit found for your account.</p>
        <p className="text-xs text-red-600 mt-1">Please contact an admin to set up your unit.</p>
      </div>
    )
  }

  let jobs: ProductionJobWithLocation[] = []
  let fetchError: string | null = null

  try {
    jobs = await getUnitJobs(unit.id)
  } catch (err) {
    console.error('[UnitDashboard] getUnitJobs failed for unit', unit.id, err)
    fetchError = 'Could not load your production jobs. Please refresh.'
  }

  // Count summaries
  const active = jobs.filter((j) => j.status === 'pending' || j.status === 'in_production')
  const awaiting = jobs.filter((j) => j.status === 'complete')
  const failed = jobs.filter((j) => j.status === 'qc_failed')
  const passed = jobs.filter((j) => j.status === 'qc_passed')
  const dispatched = jobs.filter((j) => j.status === 'dispatched')

  return (
    <div className="space-y-6">

      {/* ── Unit info header ───────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">{unit.name}</h1>
        {unit.district && (
          <p className="text-sm text-gray-500 mt-0.5">{unit.district}</p>
        )}
      </div>

      {/* ── Summary chips ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{active.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Active</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-yellow-600">{awaiting.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Awaiting QC</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{failed.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">QC Failed</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{passed.length + dispatched.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Cleared / Out</div>
        </div>
      </div>

      {/* ── Error state ────────────────────────────────────────────────────── */}
      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{fetchError}</p>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!fetchError && jobs.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-12 text-center">
          <p className="text-sm font-medium text-gray-600">No production jobs assigned yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Jobs will appear here once an admin assigns locations to your unit.
          </p>
        </div>
      )}

      {/* ── Job groups ─────────────────────────────────────────────────────── */}
      {jobs.length > 0 && (
        <div className="space-y-6">
          <JobGroup
            title="Active Jobs"
            jobs={active}
            emptyText="No active jobs."
            accent="bg-blue-100 text-blue-700"
          />
          <JobGroup
            title="Complete — Awaiting QC"
            jobs={awaiting}
            emptyText=""
            accent="bg-yellow-100 text-yellow-700"
          />
          {failed.length > 0 && (
            <JobGroup
              title="QC Failed — Rework Required"
              jobs={failed}
              emptyText=""
              accent="bg-red-100 text-red-700"
            />
          )}
          {passed.length > 0 && (
            <JobGroup
              title="QC Passed — Ready to Dispatch"
              jobs={passed}
              emptyText=""
              accent="bg-green-100 text-green-700"
            />
          )}
          {dispatched.length > 0 && (
            <JobGroup
              title="Dispatched"
              jobs={dispatched}
              emptyText=""
              accent="bg-purple-100 text-purple-700"
            />
          )}
        </div>
      )}
    </div>
  )
}
