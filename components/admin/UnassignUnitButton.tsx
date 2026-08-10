'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { unassignUnitFromLocation } from '@/app/admin/location/[id]/actions'

export default function UnassignUnitButton({ locationId }: { locationId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUnassign() {
    if (!confirm('Unassign this manufacturing unit? This deletes the production job (only allowed while it\'s still Pending) and reverts the location to Surveyed status.')) return
    setLoading(true); setError(null)
    const result = await unassignUnitFromLocation(locationId)
    setLoading(false)
    if (!result.success) { setError(result.error ?? 'Unassign failed.'); return }
    router.refresh()
  }

  return (
    <div>
      <button
        onClick={handleUnassign}
        disabled={loading}
        className="px-3 py-1.5 bg-white border border-red-300 text-red-600 text-xs font-medium rounded-md
                   hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors print:hidden"
      >
        {loading ? 'Unassigning…' : 'Unassign Unit'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
