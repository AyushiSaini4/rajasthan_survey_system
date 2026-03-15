'use client'

import { useEffect, useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GPSCoords {
  lat: number
  lng: number
  accuracy: number
}

interface Props {
  /** Called when GPS coordinates are successfully acquired. */
  onCapture: (coords: GPSCoords) => void
  /** Currently captured coords (controlled from parent). */
  captured: GPSCoords | null
}

type AcquireStatus = 'idle' | 'acquiring' | 'success' | 'error'

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * GPSCapture — auto-triggers geolocation on mount.
 *
 * Per CLAUDE.md: "GPS is auto-captured when the form opens — agent cannot edit it."
 * The agent sees the coordinates and accuracy but cannot manually enter them.
 * A Retry button is shown on error or after a successful capture so the agent
 * can refresh if they moved to a better signal area.
 */
export default function GPSCapture({ onCapture, captured }: Props) {
  const [status, setStatus]   = useState<AcquireStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const acquire = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('error')
      setErrorMsg('Geolocation is not supported by this browser or device.')
      return
    }

    setStatus('acquiring')
    setErrorMsg(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: GPSCoords = {
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }
        onCapture(coords)
        setStatus('success')
      },
      (err) => {
        setStatus('error')
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setErrorMsg(
              'Location permission denied. Please allow location access in your browser settings and retry.'
            )
            break
          case err.POSITION_UNAVAILABLE:
            setErrorMsg(
              'Location unavailable. Move to an open area with clear sky and retry.'
            )
            break
          case err.TIMEOUT:
            setErrorMsg('Location request timed out. Please retry.')
            break
          default:
            setErrorMsg('Could not get location. Please retry.')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }, [onCapture])

  // Auto-acquire on mount
  useEffect(() => {
    acquire()
  }, [acquire])

  // ── Icon variants ──────────────────────────────────────────────────────────

  const iconWrap = 'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5'

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start gap-3">

        {/* Status icon */}
        <div style={{ width: 36, height: 36, flexShrink: 0 }}>
          {status === 'acquiring' && (
            <div className={`${iconWrap} bg-amber-100`} style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg className="w-4 h-4 text-amber-600 animate-spin" width={16} height={16} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
          {status === 'success' && (
            <div className={`${iconWrap} bg-green-100`} style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg className="w-4 h-4 text-green-600" width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {(status === 'error' || status === 'idle') && (
            <div className={`${iconWrap} bg-gray-200`} style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg className="w-4 h-4 text-gray-500" width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">GPS Location</p>

          {status === 'acquiring' && (
            <p className="text-xs text-amber-600 mt-0.5">Acquiring your location…</p>
          )}

          {status === 'success' && captured && (
            <>
              <p className="text-xs text-green-700 font-medium mt-0.5">Captured</p>
              <p className="text-xs text-gray-600 font-mono mt-1 tabular-nums">
                {captured.lat.toFixed(6)}, {captured.lng.toFixed(6)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Accuracy: ±{Math.round(captured.accuracy)} m
              </p>
            </>
          )}

          {status === 'error' && (
            <p className="text-xs text-red-600 mt-0.5 leading-relaxed">{errorMsg}</p>
          )}

          {status === 'idle' && (
            <p className="text-xs text-gray-500 mt-0.5">Waiting to acquire…</p>
          )}
        </div>

        {/* Retry / Refresh button — shown on error or after success */}
        {(status === 'error' || status === 'success') && (
          <button
            type="button"
            onClick={acquire}
            className="flex-shrink-0 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors py-1 px-2 rounded hover:bg-blue-50"
          >
            {status === 'error' ? 'Retry' : 'Refresh'}
          </button>
        )}

      </div>
    </div>
  )
}
