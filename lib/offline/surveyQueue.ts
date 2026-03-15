/**
 * Offline survey queue — IndexedDB via the `idb` library.
 *
 * Design principles:
 * - Data is written to IndexedDB FIRST on every submission, regardless of
 *   connectivity.  Supabase sync is attempted immediately after.
 * - If sync succeeds, the entry is removed from IndexedDB.
 * - If sync fails (offline, network error, server error), the entry stays
 *   in IndexedDB and is retried on the next `window.online` event or when
 *   the user taps "Sync Now".
 * - Photos are stored as ArrayBuffers (File / Blob objects are not
 *   serialisable by the structured-clone algorithm IndexedDB uses).
 * - NEVER loses a submission — data survives the phone being powered off.
 *
 * This file is only ever imported by 'use client' components, so it is
 * never executed in a Node / SSR context.
 */

import { openDB, type IDBPDatabase } from 'idb'
import type { SurveySubmission } from '@/app/agent/survey/actions'

// ─── Constants ────────────────────────────────────────────────────────────────

const DB_NAME    = 'rajasthan-pwa'
const DB_VERSION = 1
const STORE      = 'pending_submissions'

// ─── Stored shape ─────────────────────────────────────────────────────────────

export interface PendingSurvey {
  /** UUID generated client-side — used as the IDB record key */
  id: string
  type: 'survey'
  queuedAt: string         // ISO timestamp, for display
  locationCode: string     // e.g. "RJ-0031" — used to build storage paths on sync
  /** Full form payload; photoPaths is always [] here (filled in during sync) */
  data: SurveySubmission
  /** Compressed photo bytes — ArrayBuffer is structured-clone–safe */
  photoBuffers: ArrayBuffer[]
  /** Original file names — used to build the storage path on sync */
  photoFileNames: string[]
  /** Set to the last sync error message if sync has been attempted and failed */
  syncError?: string
}

// ─── DB singleton ─────────────────────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' })
        }
      },
      blocked() {
        console.warn('[surveyQueue] IndexedDB upgrade blocked — close other tabs')
      },
      blocking() {
        console.warn('[surveyQueue] This tab is blocking an IndexedDB upgrade')
      },
    })
  }
  return dbPromise
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Save a survey submission to IndexedDB.
 *
 * `compressedPhotos` should already be compressed (max 1 MB each) before
 * being passed here.  We convert them to ArrayBuffers so they survive
 * browser restarts (File/Blob objects are session-scoped).
 *
 * Returns the generated entry `id`.
 */
export async function enqueueSurvey(
  data: Omit<SurveySubmission, 'photoPaths'>,
  compressedPhotos: File[],
  locationCode: string,
): Promise<string> {
  const db = await getDB()
  const id = crypto.randomUUID()

  // File → ArrayBuffer  (structured-clone safe, survives page refreshes)
  const photoBuffers   = await Promise.all(compressedPhotos.map((f) => f.arrayBuffer()))
  const photoFileNames = compressedPhotos.map((f) => f.name)

  const entry: PendingSurvey = {
    id,
    type: 'survey',
    queuedAt: new Date().toISOString(),
    locationCode,
    data: { ...data, photoPaths: [] },
    photoBuffers,
    photoFileNames,
  }

  await db.put(STORE, entry)
  return id
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/** Return all pending survey entries, oldest first. */
export async function getPendingSurveys(): Promise<PendingSurvey[]> {
  const db  = await getDB()
  const all = await db.getAll(STORE)
  return (all as PendingSurvey[])
    .filter((e) => e.type === 'survey')
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
}

/** Return the number of surveys waiting to sync. */
export async function getPendingCount(): Promise<number> {
  const surveys = await getPendingSurveys()
  return surveys.length
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/** Remove a successfully synced entry. */
export async function removeSurvey(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE, id)
}

// ─── Update sync error ────────────────────────────────────────────────────────

/** Persist the last sync error message so the UI can surface it. */
export async function markSyncError(id: string, error: string): Promise<void> {
  const db    = await getDB()
  const entry = (await db.get(STORE, id)) as PendingSurvey | undefined
  if (entry) {
    await db.put(STORE, { ...entry, syncError: error })
  }
}

// ─── Sync helpers ─────────────────────────────────────────────────────────────

/**
 * Upload all buffered photos for a pending survey to Supabase Storage.
 *
 * Uses the browser Supabase client (relies on the user's auth cookie).
 * Returns the storage paths on success, throws on the first upload error.
 */
export async function uploadPendingPhotos(
  entry: PendingSurvey,
  supabaseStorageUpload: (
    path: string,
    blob: Blob,
  ) => Promise<{ error: { message: string } | null }>,
): Promise<string[]> {
  const paths: string[] = []

  for (let i = 0; i < entry.photoBuffers.length; i++) {
    const buffer    = entry.photoBuffers[i]
    const fileName  = entry.photoFileNames[i] ?? `photo_${i}.jpg`
    const safeName  = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const timestamp = new Date(entry.queuedAt).getTime()
    const path      = `${entry.locationCode}/survey/${timestamp}_${i}_${safeName}`

    const blob   = new Blob([buffer])
    const result = await supabaseStorageUpload(path, blob)
    if (result.error) {
      throw new Error(`Photo ${i + 1} upload failed: ${result.error.message}`)
    }
    paths.push(path)
  }

  return paths
}
