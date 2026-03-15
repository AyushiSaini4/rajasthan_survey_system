'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import GPSCapture, { type GPSCoords } from '@/components/survey/GPSCapture'
import { confirmDelivery } from '@/app/agent/delivery/[locationId]/actions'
import type { Location } from '@/types'

interface Props {
  location: Location
}

export default function DeliveryForm({ location: loc }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [gps, setGps] = useState<GPSCoords | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await confirmDelivery({
        locationId: loc.id,
        gpsLat: gps?.lat ?? null,
        gpsLng: gps?.lng ?? null,
        gpsAccuracy: gps?.accuracy ?? null,
      })
      if (result.success) {
        setConfirmed(true)
        setTimeout(() => router.push('/agent/dashboard'), 2000)
      } else {
        setError(result.error ?? 'Confirmation failed. Please try again.')
      }
    })
  }

  if (confirmed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div
          className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4"
          style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg className="w-7 h-7 text-green-600" width={28} height={28} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Delivery Confirmed!</h2>
        <p className="text-sm text-gray-500">Goods received recorded. Redirecting to dashboard…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Location card */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="text-xs font-mono text-green-400 mb-0.5">{loc.location_code}</div>
        <h1 className="text-lg font-bold text-green-900">{loc.name ?? loc.location_code}</h1>
        {(loc.district || loc.block) && (
          <p className="text-sm text-green-700 mt-0.5">
            {[loc.block, loc.district].filter(Boolean).join(', ')}
          </p>
        )}
        {loc.address && <p className="text-xs text-green-600 mt-0.5">{loc.address}</p>}
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
          Delivery Confirmation
        </h2>
        <p className="text-sm text-gray-600">
          Confirm that the goods (toilet units, ramp units, tiles, fittings) have
          been physically received at this location. GPS proof is recorded automatically.
        </p>
      </div>

      {/* GPS */}
      <GPSCapture onCapture={setGps} captured={gps} />

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full py-4 px-6 bg-green-600 text-white text-base font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        {isPending ? 'Confirming…' : '✓  Confirm Goods Received'}
      </button>

      <div className="text-center">
        <a href="/agent/dashboard" className="text-sm text-green-600 hover:text-green-700">
          ← Back to dashboard
        </a>
      </div>
    </div>
  )
}
