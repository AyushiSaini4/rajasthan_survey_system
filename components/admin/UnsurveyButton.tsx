'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { unsurveyLocation } from '@/app/admin/location/[id]/actions'

export default function UnsurveyButton({ locationId }: { locationId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUnsurvey() {
    if (!confirm('Unsurvey this location? This permanently deletes the submitted survey and reverts the location to Pending, so the field agent can redo it from scratch.')) return
    setLoading(true); setError(null)
    const result = await unsurveyLocation(locationId)
    setLoading(false)
    if (!result.success) { setError(result.error ?? 'Unsurvey failed.'); return }
    router.refresh()
  }

  return (
    <div>
      <button
        onClick={handleUnsurvey}
        disabled={loading}
        className="px-3 py-1.5 bg-white border border-red-300 text-red-600 text-xs font-medium rounded-md
                   hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors print:hidden"
      >
        {loading ? 'Unsurveying…' : 'Unsurvey'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
