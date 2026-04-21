'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignAgentToLocation } from '@/app/admin/location/[id]/actions'

interface Agent {
  id: string
  email: string
}

interface AssignAgentSectionProps {
  locationId: string
  agents: Agent[]
  currentAgentId?: string | null
}

export default function AssignAgentSection({ locationId, agents, currentAgentId }: AssignAgentSectionProps) {
  const router = useRouter()
  const [selectedAgentId, setSelectedAgentId] = useState(currentAgentId ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleAssign() {
    if (!selectedAgentId) { setError('Please select a field agent.'); return }
    setLoading(true); setError(null)
    const result = await assignAgentToLocation(locationId, selectedAgentId)
    setLoading(false)
    if (!result.success) { setError(result.error ?? 'Assignment failed.'); return }
    setSuccess(true)
    router.refresh()
  }

  if (success) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Field agent assigned successfully.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {agents.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No field agents found. Ask agents to sign up first.</p>
      ) : (
        <>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-48">
              <label htmlFor="agent-select" className="block text-sm font-medium text-gray-700 mb-1">
                Select Field Agent
              </label>
              <select
                id="agent-select"
                value={selectedAgentId}
                onChange={(e) => { setSelectedAgentId(e.target.value); setError(null) }}
                disabled={loading}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">— Choose a field agent —</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.email}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAssign}
              disabled={loading || !selectedAgentId}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md
                         hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Assigning…
                </span>
              ) : 'Assign Agent'}
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
              </svg>
              {error}
            </p>
          )}
          {selectedAgentId && !error && (
            <p className="text-xs text-gray-500">
              The selected agent will see this location in their dashboard and can submit a survey.
            </p>
          )}
        </>
      )}
    </div>
  )
}
