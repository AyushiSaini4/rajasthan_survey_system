'use client'

/**
 * OfflineSyncBanner — shown on the agent dashboard.
 *
 * Responsibilities:
 * - On mount: read IndexedDB and count pending surveys.
 * - On window.online: automatically attempt to sync all pending surveys.
 * - "Sync Now" button: manually trigger sync.
 * - Shows green / amber / red status depending on state.
 *
 * This component never renders on the server (it's 'use client') and
 * returns null during SSR hydration to avoid mismatches.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { submitSurvey } from '@/app/agent/survey/actions'
import {
  getPendingSurveys,
  getPendingCount,
  removeSurvey,
  markSyncError,
  uploadPendingPhotos,
  type PendingSurvey,
} from '@/lib/offline/surveyQueue'

// ─── Status types ─────────────────────────────────────────────────────────────

type SyncState = 'idle' | 'syncing' | 'error'

// ─── Component ────────────────────────────────────────────────────────────────

export default function OfflineSyncBanner() {
  const [mounted,      setMounted]      = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncState,    setSyncState]    = useState<SyncState>('idle')
  const [lastError,    setLastError]    = useState<string | null>(null)
  const [syncedCount,  setSyncedCount]  = useState(0) // sessions success counter
  const syncingRef = useRef(false)      // prevent concurrent syncs

  // ── Refresh count from IDB ─────────────────────────────────────────────────
  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount()
      setPendingCount(count)
    } catch {
      // IDB unavailable (private browsing on some browsers) — ignore silently
    }
  }, [])

  // ── Core sync routine ──────────────────────────────────────────────────────
  const syncAll = useCallback(async () => {
    if (syncingRef.current) return
    syncingRef.current = true
    setSyncState('syncing')
    setLastError(null)

    const supabase = createClient()
    let surveys: PendingSurvey[]

    try {
      surveys = await getPendingSurveys()
    } catch {
      setSyncState('error')
      setLastError('Could not read offline queue')
      syncingRef.current = false
      return
    }

    if (surveys.length === 0) {
      setSyncState('idle')
      syncingRef.current = false
      return
    }

    let anyError = false
    let sessionSynced = 0

    for (const survey of surveys) {
      try {
        // 1. Upload photos
        const photoPaths = await uploadPendingPhotos(
          survey,
          (path, blob) =>
            supabase.storage
              .from('survey-media')
              .upload(path, blob, { cacheControl: '3600', upsert: false }),
        )

        // 2. Submit to server action
        const result = await submitSurvey({ ...survey.data, photoPaths })

        if (result.success) {
          await removeSurvey(survey.id)
          sessionSynced++
        } else {
          // Server rejected — store error; don't retry indefinitely if it's a
          // permanent error (e.g. "already surveyed"), but keep in queue so the
          // user can see it.
          await markSyncError(survey.id, result.error)
          anyError = true
        }
      } catch (err) {
        // Transient error (network down, upload failed) — mark and keep
        const msg = err instanceof Error ? err.message : 'Sync failed'
        await markSyncError(survey.id, msg)
        anyError = true
      }
    }

    setSyncedCount((prev) => prev + sessionSynced)

    if (anyError) {
      const remaining = await getPendingCount()
      setPendingCount(remaining)
      setSyncState('error')
      setLastError('Some surveys could not be synced. Tap "Retry" to try again.')
    } else {
      setPendingCount(0)
      setSyncState('idle')
    }

    syncingRef.current = false
  }, [])

  // ── Mount: read count + attach online listener ─────────────────────────────
  useEffect(() => {
    setMounted(true)
    refreshCount()

    const handleOnline = () => {
      // Small delay to let the connection stabilise
      setTimeout(() => syncAll(), 1500)
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [refreshCount, syncAll])

  // ── Don't render during SSR (avoids hydration mismatch with IDB) ───────────
  if (!mounted) return null

  // ── Nothing pending and no sync just happened — render nothing ─────────────
  if (pendingCount === 0 && syncState === 'idle' && syncedCount === 0) return null

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  // Just finished syncing all — brief success state
  if (pendingCount === 0 && syncState === 'idle' && syncedCount > 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3 mb-4">
        <span
          className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0"
          aria-hidden="true"
        />
        <p className="text-sm text-green-700 font-medium flex-1">
          ✓ {syncedCount} survey{syncedCount !== 1 ? 's' : ''} synced successfully.
        </p>
      </div>
    )
  }

  // Syncing in progress
  if (syncState === 'syncing') {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 mb-4">
        <svg
          className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-blue-700 font-medium flex-1">
          Syncing {pendingCount} offline survey{pendingCount !== 1 ? 's' : ''}…
        </p>
      </div>
    )
  }

  // Error state
  if (syncState === 'error') {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 mb-4">
        <div className="flex items-center gap-3">
          <span
            className="inline-block w-2 h-2 rounded-full bg-red-500 flex-shrink-0"
            aria-hidden="true"
          />
          <p className="text-sm text-red-700 font-medium flex-1">
            {pendingCount} survey{pendingCount !== 1 ? 's' : ''} pending sync
          </p>
          <button
            onClick={() => syncAll()}
            className="text-xs font-bold text-red-700 bg-white border border-red-300 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
          >
            Retry
          </button>
        </div>
        {lastError && (
          <p className="text-xs text-red-600 mt-1.5 ml-5">{lastError}</p>
        )}
      </div>
    )
  }

  // Pending surveys, idle (not yet attempted or page just loaded)
  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-4">
      <div className="flex items-center gap-3">
        <span
          className="inline-block w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"
          aria-hidden="true"
        />
        <p className="text-sm text-amber-800 font-medium flex-1">
          {pendingCount} survey{pendingCount !== 1 ? 's' : ''} pending sync
        </p>
        <button
          onClick={() => syncAll()}
          className="text-xs font-bold text-amber-800 bg-white border border-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors flex-shrink-0"
        >
          Sync Now
        </button>
      </div>
      <p className="text-xs text-amber-700 mt-1.5 ml-5">
        Will sync automatically when connected.
      </p>
    </div>
  )
}
