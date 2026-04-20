'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type QCInspection = {
  id: string
  inspected_at: string
  result: 'passed' | 'failed' | null
  inspection_number: number
  overall_notes: string | null
  locations: { location_code: string; name: string; district: string } | null
  production_jobs: { manufacturing_units: { name: string } | null } | null
}

export default function AdminQC() {
  const [inspections, setInspections] = useState<QCInspection[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all'|'passed'|'failed'|'pending'>('all')
  const supabase = createClient()

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('qc_inspections')
        .select('id,inspected_at,result,inspection_number,overall_notes,locations(location_code,name,district),production_jobs(manufacturing_units(name))')
        .order('inspected_at', { ascending: false })
      setInspections((data as any) ?? [])
      setLoading(false)
    }
    fetch()
  }, [])

  const filtered = inspections.filter(i => {
    if (filter === 'all') return true
    if (filter === 'pending') return !i.result
    return i.result === filter
  })

  const passed = inspections.filter(i => i.result === 'passed').length
  const failed = inspections.filter(i => i.result === 'failed').length
  const pending = inspections.filter(i => !i.result).length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">QC Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Quality control inspections across all locations</p>
        </div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[['Total',inspections.length,'text-gray-900'],['Passed',passed,'text-green-600'],['Failed',failed,'text-red-600'],['Pending',pending,'text-yellow-600']].map(([l,v,c]) => (
            <div key={l} className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{l}</p>
              <p className={`text-3xl font-bold mt-1 ${c}`}>{v}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mb-4">
          {(['all','passed','failed','pending'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'}`}>
              {f}
            </button>
          ))}
        </div>
        {loading ? <div className="text-center py-12 text-gray-400">Loading…</div>
        : filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-base font-semibold text-gray-700">No inspections found</h3>
            <p className="text-sm text-gray-400 mt-1">Inspections appear here once QC inspectors submit reports.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Location','District','Unit','Insp #','Date','Result','Notes'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(i => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-500">{i.locations?.location_code}</span>
                      <p className="font-medium text-gray-900 truncate max-w-[160px]">{i.locations?.name ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{i.locations?.district ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{i.production_jobs?.manufacturing_units?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">#{i.inspection_number}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(i.inspected_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
                    <td className="px-4 py-3">
                      {i.result ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${i.result==='passed'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>
                          {i.result==='passed'?'✓ Passed':'✗ Failed'}
                        </span>
                      ) : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Pending</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">{i.overall_notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
