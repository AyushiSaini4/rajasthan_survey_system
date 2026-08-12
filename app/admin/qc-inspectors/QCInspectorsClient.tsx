'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createQCInspector, setQCInspectorBanned, deleteQCInspector, type QCInspector } from './actions'

export default function QCInspectorsClient({ initialInspectors }: { initialInspectors: QCInspector[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)

  async function handleAdd() {
    setSaving(true); setError(null)
    const result = await createQCInspector(form)
    setSaving(false)
    if (!result.success) { setError(result.error ?? 'Failed to create inspector.'); return }
    setForm({ email: '', password: '' })
    setShowForm(false)
    router.refresh()
  }

  async function handleToggleBan(inspector: QCInspector) {
    setTogglingId(inspector.id)
    await setQCInspectorBanned(inspector.id, !inspector.isBanned)
    setTogglingId(null)
    router.refresh()
  }

  async function handleDelete(inspector: QCInspector) {
    if (!confirm(`Delete "${inspector.email}"? This permanently removes the login account and cannot be undone.`)) return
    setDeletingId(inspector.id); setRowError(null)
    const result = await deleteQCInspector(inspector.id)
    setDeletingId(null)
    if (!result.success) { setRowError({ id: inspector.id, message: result.error ?? 'Delete failed.' }); return }
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">QC Inspectors</h1>
            <p className="text-sm text-gray-500 mt-1">
              {initialInspectors.length} inspector{initialInspectors.length === 1 ? '' : 's'} — see every job once it reaches &quot;Complete — Awaiting QC&quot;
            </p>
          </div>
          <button onClick={() => { setShowForm(true); setError(null) }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition">
            + Add Inspector
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-800 mb-1">New QC Inspector</h2>
            <p className="text-xs text-gray-500 mb-4">
              QC inspectors aren&apos;t tied to a specific unit or district — they see all jobs awaiting inspection project-wide.
            </p>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Login Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="inspector@snis.local" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="min. 6 characters" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">Share these with the inspector directly — they aren&apos;t emailed automatically.</p>
            <div className="flex gap-3 mt-4">
              <button onClick={handleAdd} disabled={saving}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition">
                {saving ? 'Creating…' : 'Create Inspector'}
              </button>
              <button onClick={() => { setShowForm(false); setError(null); setForm({ email: '', password: '' }) }}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition">
                Cancel
              </button>
            </div>
          </div>
        )}

        {initialInspectors.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-base font-semibold text-gray-700">No QC inspectors yet</h3>
            <p className="text-sm text-gray-500 mt-1">Jobs won&apos;t be inspectable until at least one exists.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Email', 'Created', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {initialInspectors.map((inspector) => (
                  <tr key={inspector.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{inspector.email}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(inspector.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inspector.isBanned ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                        {inspector.isBanned ? '● Suspended' : '● Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToggleBan(inspector)}
                          disabled={togglingId === inspector.id || deletingId === inspector.id}
                          className="text-xs text-indigo-600 hover:underline font-medium disabled:opacity-50"
                        >
                          {togglingId === inspector.id ? 'Updating…' : inspector.isBanned ? 'Restore access' : 'Suspend access'}
                        </button>
                        <button
                          onClick={() => handleDelete(inspector)}
                          disabled={togglingId === inspector.id || deletingId === inspector.id}
                          className="text-xs text-red-600 hover:underline font-medium disabled:opacity-50"
                        >
                          {deletingId === inspector.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                      {rowError?.id === inspector.id && (
                        <p className="text-xs text-red-600 mt-1 max-w-xs">{rowError.message}</p>
                      )}
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
