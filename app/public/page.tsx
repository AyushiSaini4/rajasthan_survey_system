'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type DistrictStat = { district: string; total: number; pending: number; surveyed: number; in_production: number; completed: number }
type Stats = { total: number; pending: number; surveyed: number; in_production: number; qc_passed: number; installed: number; closed: number }

export default function PublicDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [districts, setDistricts] = useState<DistrictStat[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      const { data: locations } = await supabase.from('locations').select('status,district')
      if (!locations) return
      setStats({
        total: locations.length,
        pending: locations.filter(l => l.status === 'pending').length,
        surveyed: locations.filter(l => l.status === 'surveyed').length,
        in_production: locations.filter(l => l.status === 'in_production').length,
        qc_passed: locations.filter(l => l.status === 'qc_passed').length,
        installed: locations.filter(l => l.status === 'installed').length,
        closed: locations.filter(l => l.status === 'closed').length,
      })
      const map: Record<string, DistrictStat> = {}
      for (const loc of locations) {
        const d = loc.district ?? 'Unknown'
        if (!map[d]) map[d] = { district: d, total: 0, pending: 0, surveyed: 0, in_production: 0, completed: 0 }
        map[d].total++
        if (loc.status === 'pending') map[d].pending++
        if (loc.status === 'surveyed') map[d].surveyed++
        if (loc.status === 'in_production') map[d].in_production++
        if (loc.status === 'closed' || loc.status === 'installed') map[d].completed++
      }
      setDistricts(Object.values(map).sort((a, b) => b.total - a.total))
      setLastUpdated(new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
      setLoading(false)
    }
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

  const completed = (stats?.installed ?? 0) + (stats?.closed ?? 0)
  const completionPct = stats && stats.total > 0 ? Math.round((completed / stats.total) * 100) : 0
  const inProgress = (stats?.surveyed ?? 0) + (stats?.in_production ?? 0) + (stats?.qc_passed ?? 0)

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="fixed inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
      <nav className="relative border-b border-white/10 bg-white/5 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-tight">SNIS Rajasthan</h1>
              <p className="text-slate-400 text-xs">Public Progress Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />Live
            </span>
            <Link href="/login" className="text-xs text-slate-300 hover:text-white transition font-medium border border-white/20 rounded-lg px-3 py-1.5 hover:bg-white/10">Staff Login →</Link>
          </div>
        </div>
      </nav>
      <div className="relative max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-400/30 rounded-full px-4 py-1.5 text-orange-300 text-xs font-semibold mb-4">
            <span>🏛️</span> Government of Rajasthan — Public Transparency Portal
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Infrastructure Survey Progress</h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">Live tracking of accessibility infrastructure at Special Needs Schools & Anganwadi Centres across Rajasthan</p>
          {lastUpdated && <p className="text-slate-600 text-xs mt-2">Last updated: {lastUpdated}</p>}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <svg className="w-8 h-8 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              <p className="text-slate-400 text-sm">Loading live data…</p>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-gradient-to-br from-blue-600/30 to-blue-800/20 border border-blue-500/20 rounded-3xl p-6 mb-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                <div>
                  <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-1">Overall Project Completion</p>
                  <p className="text-5xl font-black text-white">{completionPct}<span className="text-2xl text-blue-300">%</span></p>
                  <p className="text-slate-400 text-sm mt-1">{completed} of {stats?.total} locations completed</p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  {[['Pending', stats?.pending, 'text-orange-400'], ['In Progress', inProgress, 'text-blue-400'], ['Completed', completed, 'text-emerald-400']].map(([l, v, c]) => (
                    <div key={l as string} className="bg-white/10 rounded-2xl p-4">
                      <p className={`text-2xl font-black ${c}`}>{v}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{l}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-full bg-white/10 rounded-full h-4 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-1000" style={{ width: `${completionPct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1.5"><span>0%</span><span>50%</span><span>100%</span></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                ['Total Locations', stats?.total, 'text-white', 'bg-slate-400', 'RJ-0001 to RJ-1250'],
                ['Survey Pending', stats?.pending, 'text-orange-400', 'bg-orange-400', 'Awaiting field visit'],
                ['Surveyed', stats?.surveyed, 'text-blue-400', 'bg-blue-400', 'Survey submitted'],
                ['In Production', stats?.in_production, 'text-purple-400', 'bg-purple-400', 'Being manufactured'],
                ['QC Passed', stats?.qc_passed, 'text-teal-400', 'bg-teal-400', 'Quality approved'],
                ['Installed', stats?.installed, 'text-emerald-400', 'bg-emerald-400', 'Infrastructure ready'],
                ['Closed', stats?.closed, 'text-green-400', 'bg-green-400', 'Project complete'],
                ['Completion Rate', `${completionPct}%`, 'text-yellow-400', 'bg-yellow-400', 'Overall progress'],
              ].map(([l, v, c, dot, desc]) => (
                <div key={l as string} className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm hover:bg-white/10 transition">
                  <div className="flex items-center gap-2 mb-2"><span className={`w-2 h-2 rounded-full ${dot}`} /><p className="text-xs text-slate-400 uppercase tracking-wide">{l}</p></div>
                  <p className={`text-2xl font-black ${c}`}>{v}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-sm">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-white font-bold">District-wise Progress</h3>
                <span className="text-xs text-slate-400">{districts.length} districts</span>
              </div>
              <div className="divide-y divide-white/5">
                {districts.map((d, i) => {
                  const pct = d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0
                  const surveyedPct = d.total > 0 ? Math.round(((d.surveyed + d.in_production + d.completed) / d.total) * 100) : 0
                  return (
                    <div key={d.district} className="px-6 py-4 hover:bg-white/5 transition">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-600 text-xs w-5 text-right">{i + 1}</span>
                          <span className="text-white font-semibold text-sm">{d.district}</span>
                          <span className="text-xs text-slate-500">{d.total} locations</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-orange-400">{d.pending} pending</span>
                          <span className="text-emerald-400 font-bold">{pct}% done</span>
                        </div>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                        <div className="h-full flex">
                          <div className="bg-emerald-500 h-full transition-all duration-700" style={{ width: `${pct}%` }} />
                          <div className="bg-blue-500 h-full transition-all duration-700" style={{ width: `${Math.max(0, surveyedPct - pct)}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center justify-center gap-6 mt-6 flex-wrap">
              {[['bg-emerald-500','Completed'],['bg-blue-500','In Progress'],['bg-white/10','Pending']].map(([c,l]) => (
                <div key={l} className="flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${c}`} /><span className="text-xs text-slate-400">{l}</span></div>
              ))}
            </div>
            <div className="text-center mt-8 pb-4">
              <p className="text-slate-600 text-xs">Data refreshes every minute · Government of Rajasthan · SNIS Infrastructure Survey</p>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
