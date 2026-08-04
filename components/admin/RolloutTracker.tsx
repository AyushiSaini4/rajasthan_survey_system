'use client'

import { useMemo, useState } from 'react'
import type { Location, LocationStatus, CWSNSchool } from '@/types'

// ─── Pipeline stage order ───────────────────────────────────────────────────────
// qc_failed is a rework branch, not a forward stage — it's surfaced as a
// separate "needs attention" callout instead of breaking up the flow bar.

const FLOW_STAGES: { status: LocationStatus; label: string; barClass: string; dotClass: string }[] = [
  { status: 'pending',       label: 'Pending',       barClass: 'bg-gray-400',    dotClass: 'bg-gray-400' },
  { status: 'surveyed',      label: 'Surveyed',      barClass: 'bg-blue-500',    dotClass: 'bg-blue-500' },
  { status: 'assigned',      label: 'Assigned',      barClass: 'bg-indigo-500',  dotClass: 'bg-indigo-500' },
  { status: 'in_production', label: 'In Production', barClass: 'bg-amber-500',   dotClass: 'bg-amber-500' },
  { status: 'qc_passed',     label: 'QC Passed',     barClass: 'bg-green-500',   dotClass: 'bg-green-500' },
  { status: 'dispatched',    label: 'Dispatched',    barClass: 'bg-teal-500',    dotClass: 'bg-teal-500' },
  { status: 'delivered',     label: 'Delivered',     barClass: 'bg-sky-500',     dotClass: 'bg-sky-500' },
  { status: 'installed',     label: 'Installed',     barClass: 'bg-violet-500',  dotClass: 'bg-violet-500' },
  { status: 'verified',      label: 'Verified',      barClass: 'bg-emerald-500', dotClass: 'bg-emerald-500' },
  { status: 'closed',        label: 'Closed',        barClass: 'bg-slate-500',   dotClass: 'bg-slate-500' },
]

const COMPLETE_STATUSES: LocationStatus[] = ['verified', 'closed']
const IN_PROGRESS_STATUSES: LocationStatus[] = [
  'surveyed', 'assigned', 'in_production', 'qc_passed', 'dispatched', 'delivered', 'installed',
]

interface DistrictRow {
  district: string
  total: number
  pending: number
  inProgress: number
  reworking: number
  complete: number
}

interface Props {
  locations: Location[]
  /** Optional — omit the school-coverage card if the directory isn't loaded. */
  schools?: CWSNSchool[]
}

// ─── Small presentational pieces ────────────────────────────────────────────────

function StatCard({
  label, value, subtitle, colorClass, bgClass,
}: { label: string; value: string | number; subtitle?: string; colorClass: string; bgClass: string }) {
  return (
    <div className={`${bgClass} rounded-xl border p-4`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colorClass}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function RolloutTracker({ locations, schools }: Props) {
  const [districtSort, setDistrictSort] = useState<'total' | 'complete_pct'>('total')

  const total = locations.length

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<LocationStatus, number>> = {}
    for (const loc of locations) counts[loc.status] = (counts[loc.status] ?? 0) + 1
    return counts
  }, [locations])

  const reworkCount = statusCounts.qc_failed ?? 0
  const completeCount = locations.filter((l) => COMPLETE_STATUSES.includes(l.status)).length
  const inProgressCount = locations.filter((l) => IN_PROGRESS_STATUSES.includes(l.status)).length
  const pendingCount = statusCounts.pending ?? 0
  const completionPct = total > 0 ? Math.round((completeCount / total) * 100) : 0

  const districtRows = useMemo<DistrictRow[]>(() => {
    const map = new Map<string, DistrictRow>()
    for (const loc of locations) {
      const key = loc.district ?? 'Unknown'
      if (!map.has(key)) {
        map.set(key, { district: key, total: 0, pending: 0, inProgress: 0, reworking: 0, complete: 0 })
      }
      const row = map.get(key)!
      row.total++
      if (loc.status === 'pending') row.pending++
      else if (loc.status === 'qc_failed') row.reworking++
      else if (COMPLETE_STATUSES.includes(loc.status)) row.complete++
      else row.inProgress++
    }
    const rows = Array.from(map.values())
    return rows.sort((a, b) =>
      districtSort === 'total'
        ? b.total - a.total
        : (b.complete / (b.total || 1)) - (a.complete / (a.total || 1))
    )
  }, [locations, districtSort])

  const schoolCoverage = useMemo(() => {
    if (!schools) return null
    const onboarded = schools.filter((s) => s.location_id !== null).length
    return { total: schools.length, onboarded, pending: schools.length - onboarded }
  }, [schools])

  return (
    <div className="space-y-6">
      {/* ── Top-line stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Overall Completion"
          value={`${completionPct}%`}
          subtitle={`${completeCount} of ${total} locations`}
          colorClass="text-emerald-700"
          bgClass="bg-emerald-50 border-emerald-200"
        />
        <StatCard
          label="Pending Survey"
          value={pendingCount}
          subtitle="Not yet visited"
          colorClass="text-gray-700"
          bgClass="bg-gray-50 border-gray-200"
        />
        <StatCard
          label="In Progress"
          value={inProgressCount}
          subtitle="Surveyed → Installed"
          colorClass="text-blue-700"
          bgClass="bg-blue-50 border-blue-200"
        />
        <StatCard
          label="Needs Attention"
          value={reworkCount}
          subtitle="QC failed — rework pending"
          colorClass={reworkCount > 0 ? 'text-red-700' : 'text-gray-400'}
          bgClass={reworkCount > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}
        />
      </div>

      {/* ── School directory coverage (optional) ────────────────────────── */}
      {schoolCoverage && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">CWSN School Directory Coverage</h3>
            <span className="text-xs text-gray-400">
              {schoolCoverage.onboarded} / {schoolCoverage.total} onboarded
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${schoolCoverage.total > 0 ? Math.round((schoolCoverage.onboarded / schoolCoverage.total) * 100) : 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {schoolCoverage.pending} known CWSN school{schoolCoverage.pending !== 1 ? 's' : ''} in the master directory
            {' '}{schoolCoverage.pending === 1 ? 'has' : 'have'} not yet entered the survey pipeline.
          </p>
        </div>
      )}

      {/* ── Pipeline funnel ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Rollout Pipeline</h3>

        {total > 0 && (
          <div className="w-full h-4 rounded-full overflow-hidden flex bg-gray-100 mb-4">
            {FLOW_STAGES.map((stage) => {
              const count = statusCounts[stage.status] ?? 0
              const pct = (count / total) * 100
              if (pct === 0) return null
              return (
                <div
                  key={stage.status}
                  className={`${stage.barClass} h-full transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                  title={`${stage.label}: ${count} (${Math.round(pct)}%)`}
                />
              )
            })}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-2">
          {FLOW_STAGES.map((stage) => {
            const count = statusCounts[stage.status] ?? 0
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={stage.status} className="flex items-center gap-1.5 text-xs">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${stage.dotClass}`} />
                <span className="text-gray-600">{stage.label}</span>
                <span className="text-gray-400 ml-auto">{count} ({pct}%)</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── District-wise breakdown ──────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">District-wise Rollout</h3>
          <div className="flex gap-1">
            {(['total', 'complete_pct'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setDistrictSort(key)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                  districtSort === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {key === 'total' ? 'Sort by size' : 'Sort by completion'}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {districtRows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">No locations yet.</p>
          ) : (
            districtRows.map((row) => {
              const completePct = row.total > 0 ? Math.round((row.complete / row.total) * 100) : 0
              const inProgressPct = row.total > 0 ? Math.round((row.inProgress / row.total) * 100) : 0
              return (
                <div key={row.district} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-x-3 gap-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{row.district}</span>
                      <span className="text-xs text-gray-400">{row.total} locations</span>
                      {row.reworking > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-medium">
                          {row.reworking} rework
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-emerald-700">{completePct}% complete</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden flex">
                    <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${completePct}%` }} />
                    <div className="bg-blue-400 h-full transition-all duration-500" style={{ width: `${inProgressPct}%` }} />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
