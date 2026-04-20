'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Stats = {
  total: number; pending: number; surveyed: number; in_production: number
  qc_passed: number; qc_failed: number; installed: number; closed: number
}
type DistrictStat = { district: string; total: number; pending: number; completed: number }

export default function ReportsOverview() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [districts, setDistricts] = useState<DistrictStat[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetch() {
      const { data: locations } = await supabase.from('locations').select('status,district')
      if (!locations) return
      setStats({
        total: locations.length,
        pending: locations.filter(l => l.status==='pending').length,
        surveyed: locations.filter(l => l.status==='surveyed').length,
        in_production: locations.filter(l => l.status==='in_production').length,
        qc_passed: locations.filter(l => l.status==='qc_passed').length,
        qc_failed: locations.filter(l => l.status==='qc_failed').length,
        installed: locations.filter(l => l.status==='installed').length,
        closed: locations.filter(l => l.status==='closed').length,
      })
      const map: Record<string, DistrictStat> = {}
      for (const loc of locations) {
        const d = loc.district ?? 'Unknown'
        if (!map[d]) map[d] = { district: d, total: 0, pending: 0, completed: 0 }
        map[d].total++
        if (loc.status==='pending') map[d].pending++
        if (loc.status==='closed'||loc.status==='installed') map[d].completed++
      }
      setDistricts(Object.values(map).sort((a,b) => b.total-a.total))
      setLoading(false)
    }
    fetch()
  }, [])

  const completionPct = stats && stats.total > 0 ? Math.round(((stats.installed+stats.closed)/stats.total)*100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Project-wide progress — Rajasthan SNIS Survey</p>
        </div>
        {loading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
          <>
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-800">Overall Completion</h2>
                <span className="text-2xl font-bold text-blue-600">{completionPct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div className="bg-blue-600 h-3 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-2">{(stats?.installed??0)+(stats?.closed??0)} of {stats?.total??0} locations completed</p>
            </div>
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                ['Total Locations',stats?.total,'text-gray-900','bg-gray-400'],
                ['Pending Survey',stats?.pending,'text-orange-600','bg-orange-400'],
                ['Surveyed',stats?.surveyed,'text-blue-600','bg-blue-400'],
                ['In Production',stats?.in_production,'text-purple-600','bg-purple-400'],
                ['QC Passed',stats?.qc_passed,'text-green-600','bg-green-400'],
                ['QC Failed',stats?.qc_failed,'text-red-600','bg-red-400'],
                ['Installed',stats?.installed,'text-teal-600','bg-teal-400'],
                ['Closed',stats?.closed,'text-gray-600','bg-gray-600'],
              ].map(([l,v,c,dot]) => (
                <div key={l as string} className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${dot}`} />
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{l}</p>
                  </div>
                  <p className={`text-3xl font-bold ${c}`}>{v}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-800">District-wise Breakdown</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{['District','Total','Pending','Completed','Progress'].map(h => (
                    <th key={h} className="text-left px-6 py-3 font-semibold text-gray-600">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {districts.map(d => {
                    const pct = d.total > 0 ? Math.round((d.completed/d.total)*100) : 0
                    return (
                      <tr key={d.district} className="hover:bg-gray-50">
                        <td className="px-6 py-3 font-medium text-gray-900">{d.district}</td>
                        <td className="px-6 py-3 text-gray-600">{d.total}</td>
                        <td className="px-6 py-3 text-orange-600">{d.pending}</td>
                        <td className="px-6 py-3 text-green-600">{d.completed}</td>
                        <td className="px-6 py-3 w-48">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-8">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
