'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'
import GPSCapture, { type GPSCoords } from '@/components/survey/GPSCapture'
import PhotoUploader from '@/components/survey/PhotoUploader'
import { submitSurvey } from '@/app/agent/survey/actions'
import { enqueueSurvey, removeSurvey } from '@/lib/offline/surveyQueue'
import type { Location } from '@/types'

// ─── Sub-types ────────────────────────────────────────────────────────────────

type Condition = 'good' | 'damaged' | 'missing'

// ─── Reusable sub-components ─────────────────────────────────────────────────

/** Yes / No toggle button pair */
function YesNoField({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
}: {
  label: string
  value: boolean | null
  onChange: (v: boolean) => void
  required?: boolean
  disabled?: boolean
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(true)}
          className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
            value === true
              ? 'bg-green-600 border-green-600 text-white shadow-sm'
              : 'bg-white border-gray-300 text-gray-700 hover:border-green-400 hover:bg-green-50'
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(false)}
          className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
            value === false
              ? 'bg-red-500 border-red-500 text-white shadow-sm'
              : 'bg-white border-gray-300 text-gray-700 hover:border-red-400 hover:bg-red-50'
          }`}
        >
          No
        </button>
      </div>
    </div>
  )
}

/** Good / Damaged / Missing condition selector */
function ConditionField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string
  value: Condition | null
  onChange: (v: Condition) => void
  disabled?: boolean
}) {
  const OPTIONS: {
    value: Condition
    label: string
    active: string
    hover: string
  }[] = [
    { value: 'good',    label: 'Good',    active: 'bg-green-600 border-green-600 text-white',  hover: 'hover:border-green-400 hover:bg-green-50' },
    { value: 'damaged', label: 'Damaged', active: 'bg-amber-500 border-amber-500 text-white',  hover: 'hover:border-amber-400 hover:bg-amber-50' },
    { value: 'missing', label: 'Missing', active: 'bg-red-600 border-red-600 text-white',      hover: 'hover:border-red-400 hover:bg-red-50' },
  ]

  return (
    <div>
      <p className="text-sm font-medium text-gray-600 mb-2">
        {label} <span className="text-red-500">*</span>
      </p>
      <div className="flex gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
              value === opt.value
                ? opt.active + ' shadow-sm'
                : `bg-white border-gray-300 text-gray-700 ${opt.hover}`
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Section wrapper card */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

/** Section heading */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-gray-800 mb-4">{children}</h2>
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  location: Location
}

export default function SurveyFormClient({ location }: Props) {
  const router = useRouter()

  // ── GPS ────────────────────────────────────────────────────────────────────
  const [gps, setGps] = useState<GPSCoords | null>(null)

  // ── Checklist ──────────────────────────────────────────────────────────────
  const [toiletPresent,    setToiletPresent]    = useState<boolean | null>(null)
  const [toiletCondition,  setToiletCondition]  = useState<Condition | null>(null)
  const [rampPresent,      setRampPresent]      = useState<boolean | null>(null)
  const [rampCondition,    setRampCondition]    = useState<Condition | null>(null)
  const [hardwareCondition, setHardwareCondition] = useState<Condition | null>(null)

  // ── Quantities ─────────────────────────────────────────────────────────────
  const [qtyTiles,        setQtyTiles]        = useState('')
  const [qtyToiletUnits,  setQtyToiletUnits]  = useState('')
  const [qtyRampUnits,    setQtyRampUnits]    = useState('')
  const [qtyFittings,     setQtyFittings]     = useState('')

  // ── Notes + photos ─────────────────────────────────────────────────────────
  const [notes,  setNotes]  = useState('')
  const [photos, setPhotos] = useState<File[]>([])

  // ── Submission state ───────────────────────────────────────────────────────
  const [submitting,      setSubmitting]      = useState(false)
  const [uploadProgress,  setUploadProgress]  = useState<string | null>(null)
  const [submitError,     setSubmitError]     = useState<string | null>(null)
  /** True when the form was saved to IndexedDB but not yet synced to Supabase */
  const [offlineSaved,    setOfflineSaved]    = useState(false)

  // ── Photo compression ──────────────────────────────────────────────────────
  // Returns compressed File[] without uploading — upload happens separately.

  async function compressPhotos(): Promise<File[]> {
    if (photos.length === 0) return []
    const result: File[] = []
    for (let i = 0; i < photos.length; i++) {
      setUploadProgress(`Compressing photo ${i + 1} of ${photos.length}…`)
      const compressed = await imageCompression(photos[i], {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      })
      // imageCompression may return a Blob — ensure we have a File with a name
      const file = new File([compressed], photos[i].name, { type: compressed.type || 'image/jpeg' })
      result.push(file)
    }
    setUploadProgress(null)
    return result
  }

  // ── Photo upload (online only) ─────────────────────────────────────────────
  // Uploads already-compressed files to Supabase Storage.

  async function uploadCompressedPhotos(compressedFiles: File[]): Promise<string[]> {
    if (compressedFiles.length === 0) return []
    const supabase = createClient()
    const paths: string[] = []
    const timestamp = Date.now()

    for (let i = 0; i < compressedFiles.length; i++) {
      const file     = compressedFiles[i]
      setUploadProgress(`Uploading photo ${i + 1} of ${compressedFiles.length}…`)
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path     = `${location.location_code}/survey/${timestamp}_${i}_${safeName}`

      const { error } = await supabase.storage
        .from('survey-media')
        .upload(path, file, { cacheControl: '3600', upsert: false })

      if (error) throw new Error(`Photo ${i + 1} upload failed: ${error.message}`)
      paths.push(path)
    }
    setUploadProgress(null)
    return paths
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate(): string | null {
    if (toiletPresent === null)
      return 'Please answer: Is there an existing toilet?'
    if (toiletPresent && toiletCondition === null)
      return 'Please select the toilet condition.'
    if (rampPresent === null)
      return 'Please answer: Is there a ramp / accessible entry?'
    if (rampPresent && rampCondition === null)
      return 'Please select the ramp condition.'
    if (hardwareCondition === null)
      return 'Please select the hardware / fittings condition.'
    return null
  }

  // ── Submit — offline-first ─────────────────────────────────────────────────
  //
  // Flow:
  //  1. Validate form fields
  //  2. Compress photos (no network needed)
  //  3. Write to IndexedDB (always — survives power loss)
  //  4. If online: upload photos → call server action → remove from IDB → navigate
  //  5. If offline (or network fails): show "Saved offline" message, don't navigate

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    const validationError = validate()
    if (validationError) {
      setSubmitError(validationError)
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      return
    }

    setSubmitting(true)
    try {
      // ── Step 1: Compress photos ──────────────────────────────────────────
      const compressedFiles = await compressPhotos()

      // Build the form payload (no photo paths yet)
      const surveyPayload = {
        locationId:        location.id,
        gpsLat:            gps?.lat         ?? null,
        gpsLng:            gps?.lng         ?? null,
        gpsAccuracy:       gps?.accuracy    ?? null,
        toiletPresent:     toiletPresent!,
        toiletCondition:   toiletPresent    ? toiletCondition  : null,
        rampPresent:       rampPresent!,
        rampCondition:     rampPresent      ? rampCondition    : null,
        hardwareCondition: hardwareCondition!,
        notes,
        qtyTiles:         parseInt(qtyTiles)       || 0,
        qtyToiletUnits:   parseInt(qtyToiletUnits) || 0,
        qtyRampUnits:     parseInt(qtyRampUnits)   || 0,
        qtyFittings:      parseInt(qtyFittings)    || 0,
      }

      // ── Step 2: Save to IndexedDB (always, regardless of connectivity) ───
      const queueId = await enqueueSurvey(
        surveyPayload,
        compressedFiles,
        location.location_code,
      )

      // ── Step 3: Attempt immediate online sync ────────────────────────────
      if (!navigator.onLine) {
        // Definitely offline — show saved message
        setOfflineSaved(true)
        return
      }

      try {
        setUploadProgress('Uploading photos…')
        const photoPaths = await uploadCompressedPhotos(compressedFiles)

        setUploadProgress('Saving survey…')
        const result = await submitSurvey({ ...surveyPayload, photoPaths })

        if (!result.success) {
          // Server error (e.g. already surveyed) — keep in IDB for visibility,
          // show error so the user knows what happened.
          setSubmitError(result.error)
          return
        }

        // ── Success: remove from IDB and navigate ────────────────────────
        await removeSurvey(queueId)
        router.push('/agent/dashboard')
        router.refresh()
      } catch {
        // Network failed mid-flight even though navigator.onLine was true.
        // Data is already in IDB — the sync banner will retry automatically.
        setOfflineSaved(true)
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.'
      )
    } finally {
      setSubmitting(false)
      setUploadProgress(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // Offline saved — show clear message before the rest of the form
  if (offlineSaved) {
    return (
      <div className="space-y-4 pb-6">
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-5 text-center">
          <div
            className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg
              className="w-6 h-6 text-amber-600"
              width={24} height={24}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-amber-800 mb-1">Saved offline</h2>
          <p className="text-sm text-amber-700">
            Your survey has been saved to this device.
          </p>
          <p className="text-sm text-amber-700 mt-0.5">
            It will sync to the server automatically when you reconnect.
          </p>
        </div>

        <a
          href="/agent/dashboard"
          className="block w-full py-3 text-center bg-gray-900 text-white font-semibold rounded-xl text-sm transition-colors hover:bg-gray-800"
        >
          Back to My Locations
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-6">

      {/* ── Location info banner ─────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-bold text-gray-900">
            {location.location_code}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium">
            Survey in progress
          </span>
        </div>
        {location.name && (
          <p className="text-sm font-medium text-gray-700 mt-1">{location.name}</p>
        )}
        {(location.district || location.block) && (
          <p className="text-xs text-gray-500 mt-0.5">
            {[location.district, location.block, location.village]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </Card>

      {/* ── GPS ──────────────────────────────────────────────────────────── */}
      <section>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          GPS Location
        </p>
        <GPSCapture onCapture={setGps} captured={gps} />
        {!gps && (
          <p className="text-xs text-amber-600 mt-1.5">
            GPS not captured — the form can still be submitted, but location proof is recommended.
          </p>
        )}
      </section>

      {/* ── Infrastructure checklist ─────────────────────────────────────── */}
      <Card className="space-y-5">
        <SectionTitle>Infrastructure Checklist</SectionTitle>

        <YesNoField
          label="Is there an existing toilet?"
          value={toiletPresent}
          onChange={(v) => { setToiletPresent(v); if (!v) setToiletCondition(null) }}
          required
          disabled={submitting}
        />

        {toiletPresent === true && (
          <ConditionField
            label="Toilet condition"
            value={toiletCondition}
            onChange={setToiletCondition}
            disabled={submitting}
          />
        )}

        <div className="border-t border-gray-100 pt-4">
          <YesNoField
            label="Is there a ramp / accessible entry?"
            value={rampPresent}
            onChange={(v) => { setRampPresent(v); if (!v) setRampCondition(null) }}
            required
            disabled={submitting}
          />
        </div>

        {rampPresent === true && (
          <ConditionField
            label="Ramp condition"
            value={rampCondition}
            onChange={setRampCondition}
            disabled={submitting}
          />
        )}

        <div className="border-t border-gray-100 pt-4">
          <ConditionField
            label="Hardware / fittings condition"
            value={hardwareCondition}
            onChange={setHardwareCondition}
            disabled={submitting}
          />
        </div>
      </Card>

      {/* ── Material quantities ───────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Materials Needed</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { id: 'qty_tiles',        label: 'Tiles (sq ft)',  value: qtyTiles,       set: setQtyTiles },
              { id: 'qty_toilet_units', label: 'Toilet Units',   value: qtyToiletUnits, set: setQtyToiletUnits },
              { id: 'qty_ramp_units',   label: 'Ramp Units',     value: qtyRampUnits,   set: setQtyRampUnits },
              { id: 'qty_fittings',     label: 'Fitting Sets',   value: qtyFittings,    set: setQtyFittings },
            ] as const
          ).map(({ id, label, value, set }) => (
            <div key={id}>
              <label htmlFor={id} className="block text-xs font-medium text-gray-600 mb-1">
                {label}
              </label>
              <input
                id={id}
                type="number"
                inputMode="numeric"
                min="0"
                value={value}
                onChange={(e) => set(e.target.value)}
                disabled={submitting}
                placeholder="0"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* ── Notes ────────────────────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Notes</SectionTitle>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={submitting}
          placeholder="Any additional observations about the site…"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50"
        />
      </Card>

      {/* ── Photos ───────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Photos</SectionTitle>
          <span className="text-xs text-gray-400 -mt-1">
            {photos.length}/10 · compressed to max 1 MB each
          </span>
        </div>
        <PhotoUploader
          files={photos}
          onChange={setPhotos}
          disabled={submitting}
          maxPhotos={10}
        />
      </Card>

      {/* ── Upload progress ───────────────────────────────────────────────── */}
      {uploadProgress && (
        <div className="flex items-center gap-2.5 text-sm text-blue-700 bg-blue-50 rounded-xl px-4 py-3 border border-blue-200">
          <svg
            className="w-4 h-4 animate-spin flex-shrink-0"
            width={16}
            height={16}
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {uploadProgress}
        </div>
      )}

      {/* ── Validation / submit error ─────────────────────────────────────── */}
      {submitError && (
        <div className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3 border border-red-200">
          <svg
            className="w-4 h-4 flex-shrink-0 mt-0.5"
            width={16}
            height={16}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>{submitError}</span>
        </div>
      )}

      {/* ── Submit button ─────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3.5 bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
      >
        {submitting ? 'Submitting…' : 'Submit Survey'}
      </button>

      <p className="text-xs text-center text-gray-400">
        Submitting will mark this location as surveyed. This cannot be undone.
      </p>

    </form>
  )
}
