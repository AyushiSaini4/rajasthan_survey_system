'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { Location, LocationStatus } from '@/types'
import LocationStatusBadge from '@/components/shared/LocationStatusBadge'

// ─── Filter tab definition ─────────────────────────────────────────────────────

const FILTER_TABS: { key: LocationStatus | 'all'; label: string }[] = [
  { key: 'all',          label: 'All' },
  { key: 'pending',      label: 'Pending' },
  { key: 'surveyed',     label: 'Surveyed' },
  { key: 'assigned',     label: 'Assigned' },
  { key: 'in_production',label: 'In Production' },
  { key: 'qc_failed',    label: 'QC Failed' },
  { key: 'qc_passed',    label: 'QC Passed' },
  { key: 'closed',       label: 'Closed' },
]

// ─── Summary card ──────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number
  subtitle?: string
  colorClass: string
  bgClass: string
}

function StatCard({ label, value, subtitle, colorClass, bgClass }: StatCardProps) {
  return (
    <div className={`${bgClass} rounded-xl border p-4`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colorClass}`}>{value.toLocaleString()}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  locations: Location[]
}

export default function AdminDashboardClient({ locations }: Props) {
  const [activeTab, setActiveTab] = useState<LocationStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:         locations.length,
    pending:       locations.filter((l) => l.status === 'pending').length,
    surveyed:      locations.filter((l) => l.status === 'surveyed').length,
    in_production: locations.filter((l) => l.status === 'in_production').length,
  }), [locations])

  // ── Per-tab counts (shown inside tab buttons) ──────────────────────────────
  const tabCounts = useMemo(() => {
    const counts: Partial<Record<LocationStatus | 'all', number>> = { all: locations.length }
    for (const loc of locations) {
      counts[loc.status] = (counts[loc.status] ?? 0) + 1
    }
    return counts
  }, [locations])

  // ── Filtered rows ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = locations

    if (activeTab !== 'all') {
      result = result.filter((l) => l.status === activeTab)
    }

    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (l) =>
          l.location_code.toLowerCase().includes(q) ||
          (l.name?.toLowerCase().includes(q) ?? false)
      )
    }

    return result
  }, [locations, activeTab, search])

  return (
    <div>
      {/* ── Summary Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Locations"
          value={stats.total}
          subtitle="RJ-0001 to RJ-1250"
          colorClass="text-blue-700"
          bgClass="bg-blue-50 border-blue-200"
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          subtitle="Not yet surveyed"
          colorClass="text-gray-700"
          bgClass="bg-gray-50 border-gray-200"
        />
        <StatCard
          label="Surveyed"
          value={stats.surveyed}
          subtitle="Awaiting assignment"
          colorClass="text-amber-700"
          bgClass="bg-amber-50 border-amber-200"
        />
        <StatCard
          label="In Production"
          value={stats.in_production}
          subtitle="Being manufactured"
          colorClass="text-violet-700"
          bgClass="bg-violet-50 border-violet-200"
        />
      </div>

      {/* ── Filters + Search ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-shrink-0 sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search code or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Result count when searching */}
        {search.trim() && (
          <span className="text-sm text-gray-500">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Filter Tabs ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTER_TABS.map((tab) => {
          const count = tabCounts[tab.key] ?? 0
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {tab.label}
              <span
                className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${
                  isActive ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Locations Table ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  District
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  Block
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  &nbsp;
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm">No locations found</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((location) => (
                  <tr key={location.id} className="hover:bg-gray-50 transition-colors">
                    {/* Location code — mono font */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-gray-900">
                        {location.location_code}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate">
                      {location.name ?? <span className="text-gray-400">—</span>}
                    </td>

                    {/* District — hidden on mobile */}
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                      {location.district ?? <span className="text-gray-400">—</span>}
                    </td>

                    {/* Block — hidden below md */}
                    <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                      {location.block ?? <span className="text-gray-400">—</span>}
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-3">
                      <LocationStatusBadge status={location.status} />
                    </td>

                    {/* View link */}
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/location/${location.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        View
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer row ─ showing count ──────────────────────────────── */}
        {filtered.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
            Showing {filtered.length.toLocaleString()} of {locations.length.toLocaleString()} locations
          </div>
        )}
      </div>
    </div>
  )
}
