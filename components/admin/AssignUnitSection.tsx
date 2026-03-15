'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignLocationToUnit } from '@/app/admin/location/[id]/actions'
import type { ManufacturingUnit } from '@/types'

interface AssignUnitSectionProps {
  locationId: string
  activeUnits: ManufacturingUnit[]
}

export default function AssignUnitSection({ locationId, activeUnits }: AssignUnitSectionProps) {
  const router = useRouter()
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleAssign() {
    if (!selectedUnitId) {
      setError('Please select a manufacturing unit.')
      return
    }

    setLoading(true)
    setError(null)

    const result = await assignLocationToUnit(locationId, selectedUnitId)

    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Assignment failed. Please try again.')
      return
    }

    setSuccess(true)
    // Refresh server component data without full page reload
    router.refresh()
  }

  if (success) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Location assigned successfully. Production job created.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activeUnits.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No active manufacturing units found.</p>
      ) : (
        <>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-48">
              <label htmlFor="unit-select" className="block text-sm font-medium text-gray-700 mb-1">
                Select Manufacturing Unit
              </label>
              <select
                id="unit-select"
                value={selectedUnitId}
                onChange={(e) => {
                  setSelectedUnitId(e.target.value)
                  setError(null)
                }}
                disabled={loading}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">— Choose a unit —</option>
                {activeUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                    {unit.district ? ` (${unit.district})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleAssign}
              disabled={loading || !selectedUnitId}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md
                         hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                         transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Assigning…
                </span>
              ) : (
                'Assign to Unit'
              )}
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

          {selectedUnitId && !error && (
            <p className="text-xs text-gray-500">
              This will create a production job and change the location status to{' '}
              <strong>Assigned</strong>.
            </p>
          )}
        </>
      )}
    </div>
  )
}
