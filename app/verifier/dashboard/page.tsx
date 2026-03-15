import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserWithRole } from '@/lib/supabase/auth'
import { getPendingInstallationReports } from '@/lib/supabase/installation'

export const dynamic = 'force-dynamic'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

export default async function VerifierDashboardPage() {
  let user: Awaited<ReturnType<typeof getUserWithRole>>['user'] = null
  let role: Awaited<ReturnType<typeof getUserWithRole>>['role'] = null

  try {
    ;({ user, role } = await getUserWithRole())
  } catch {
    redirect('/login')
  }

  if (!user || role !== 'verifier') redirect('/login')

  let reports: Awaited<ReturnType<typeof getPendingInstallationReports>> = []
  try {
    reports = await getPendingInstallationReports()
  } catch {
    // handled below
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pending Verification</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Installation reports awaiting your review
          </p>
        </div>
        {reports.length > 0 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-teal-100 text-teal-700 border border-teal-200">
            {reports.length} pending
          </span>
        )}
      </div>

      {/* List */}
      {reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700">All caught up</p>
          <p className="text-xs text-gray-400 mt-1">No installation reports pending verification.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const age = ageDays(report.submitted_at)
            const isUrgent = age >= 3

            return (
              <Link
                key={report.id}
                href={`/verifier/report/${report.id}`}
                className="block bg-white rounded-xl border border-gray-200 hover:border-teal-300 hover:shadow-sm transition-all p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Location code + name */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-blue-600">
                        {report.location.location_code}
                      </span>
                      {report.location.name && (
                        <span className="text-sm text-gray-700 truncate">
                          {report.location.name}
                        </span>
                      )}
                    </div>

                    {/* Location details */}
                    {(report.location.district || report.location.block) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {[report.location.district, report.location.block, report.location.village]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}

                    {/* Install checklist summary */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {[
                        { label: 'Toilet', val: report.toilet_installed },
                        { label: 'Ramp', val: report.ramp_installed },
                        { label: 'Hardware', val: report.hardware_installed },
                      ].map((item) => (
                        <span
                          key={item.label}
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            item.val === true
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : item.val === false
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {item.val === true ? '✓' : item.val === false ? '✗' : '—'}{' '}
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {/* Age badge */}
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        isUrgent
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {age === 0 ? 'Today' : age === 1 ? '1 day ago' : `${age} days ago`}
                    </span>
                    <p className="text-xs text-gray-400">{fmtDate(report.submitted_at)}</p>
                    <span className="text-xs font-semibold text-teal-600">Review →</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
