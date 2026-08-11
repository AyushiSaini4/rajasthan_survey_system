'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchAllPages } from '@/lib/supabase/paginate'
import Link from 'next/link'

type LocationRow = { location_code: string; name: string | null; district: string; block: string; status: string }

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Survey Pending', surveyed: 'Surveyed', assigned: 'Assigned', in_production: 'In Production',
  qc_passed: 'QC Passed', qc_failed: 'QC Failed', dispatched: 'Dispatched', delivered: 'Delivered',
  installed: 'Installed', verified: 'Verified', closed: 'Closed',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-500/20 text-slate-300', surveyed: 'bg-blue-500/20 text-blue-300',
  assigned: 'bg-indigo-500/20 text-indigo-300', in_production: 'bg-purple-500/20 text-purple-300',
  qc_passed: 'bg-teal-500/20 text-teal-300', qc_failed: 'bg-red-500/20 text-red-300',
  dispatched: 'bg-cyan-500/20 text-cyan-300', delivered: 'bg-sky-500/20 text-sky-300',
  installed: 'bg-emerald-500/20 text-emerald-300', verified: 'bg-green-500/20 text-green-300',
  closed: 'bg-green-500/20 text-green-300',
}

export default function PublicLocationsListPage() {
  return (
    <Suspense fallback={null}>
      <PublicLocationsListInner />
    </Suspense>
  )
}

function PublicLocationsListInner() {
  const params = useSearchParams()
  const statusFilter = params.get('status')
  const districtFilter = params.get('district')

  const [rows, setRows] = useState<LocationRow[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      // Paginated — see lib/supabase/paginate.ts. Same 1,000-row server cap
      // as the main dashboard; a common status like "pending" alone could
      // exceed 1,000 of the 1,236 real locations. Query rebuilt fresh per
      // page rather than reusing one builder across multiple .range() calls.
      const { data } = await fetchAllPages<LocationRow>((from, to) => {
        let query = supabase.from('public_location_stats').select('location_code,name,district,block,status')
        if (statusFilter) query = query.eq('status', statusFilter)
        if (districtFilter) query = query.eq('district', districtFilter)
        return query.order('location_code', { ascending: true }).range(from, to)
      })
      setRows(data ?? [])
      setLoading(false)
    }
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [statusFilter, districtFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const title = statusFilter
    ? STATUS_LABELS[statusFilter] ?? statusFilter
    : districtFilter
    ? titleCase(districtFilter)
    : 'All Locations'

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <nav className="border-b border-white/10 bg-white/5 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/public" className="text-slate-300 hover:text-white text-sm flex items-center gap-1.5">
            ← Back to dashboard
          </Link>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />Live
          </span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-1">{title}</h1>
        <p className="text-slate-400 text-sm mb-6">{loading ? 'Loading…' : `${rows.length} location${rows.length !== 1 ? 's' : ''}`}</p>

        {loading ? (
          <div className="flex justify-center py-16">
            <svg className="w-6 h-6 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-slate-500 text-sm">No locations match this filter.</p>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5">
            {rows.map((r) => (
              <Link
                key={r.location_code}
                href={`/public/location/${r.location_code}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">{r.location_code}</span>
                    <span className="text-sm font-medium text-white truncate">{r.name ?? '—'}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{titleCase(r.block)}, {titleCase(r.district)}</p>
                </div>
                <span className={`shrink-0 ml-3 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[r.status] ?? 'bg-slate-500/20 text-slate-300'}`}>
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
