'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Unit = {
  id: string; name: string; district: string | null
  contact_name: string | null; contact_phone: string | null
  is_active: boolean; user_id: string | null
}

export default function UnitsManagement() {
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', district: '', contact_name: '', contact_phone: '' })
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function fetchUnits() {
    const { data } = await supabase.from('manufacturing_units').select('*').order('name')
    setUnits(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchUnits() }, [])

  async function handleAdd() {
    if (!form.name.trim()) { setError('Unit name is required.'); return }
    setSaving(true); setError(null)
    const { error: err } = await supabase.from('manufacturing_units').insert({
      name: form.name.trim(), district: form.district.trim() || null,
      contact_name: form.contact_name.trim() || null,
      contact_phone: form.contact_phone.trim() || null, is_active: true,
    })
    if (err) { setError(err.message); setSaving(false); return }
    setForm({ name: '', district: '', contact_name: '', contact_phone: '' })
    setShowForm(false); setSaving(false); fetchUnits()
  }

  async function toggleActive(unit: Unit) {
    await supabase.from('manufacturing_units').update({ is_active: !unit.is_active }).eq('id', unit.id)
    fetchUnits()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manufacturing Units</h1>
            <p className="text-sm text-gray-500 mt-1">{units.length} units registered</p>
          </div>
          <button onClick={() => { setShowForm(true); setError(null) }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
            + Add Unit
          </button>
        </div>
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">New Manufacturing Unit</h2>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
              {[['Unit Name *','name','e.g. Unit A — Jaipur'],['District','district','e.g. Jaipur'],['Contact Name','contact_name','Manager name'],['Contact Phone','contact_phone','98XXXXXXXX']].map(([label,key,ph]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={ph} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleAdd} disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition">
                {saving ? 'Saving…' : 'Save Unit'}
              </button>
              <button onClick={() => { setShowForm(false); setError(null) }}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition">
                Cancel
              </button>
            </div>
          </div>
        )}
        {loading ? <div className="text-center py-12 text-gray-400">Loading…</div>
        : units.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">🏭</div>
            <h3 className="text-base font-semibold text-gray-700">No units registered yet</h3>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Unit Name','District','Contact','Phone','Status','Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {units.map(unit => (
                  <tr key={unit.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{unit.name}</td>
                    <td className="px-4 py-3 text-gray-600">{unit.district ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{unit.contact_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{unit.contact_phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${unit.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {unit.is_active ? '● Active' : '● Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(unit)} className="text-xs text-blue-600 hover:underline font-medium">
                        {unit.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
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
