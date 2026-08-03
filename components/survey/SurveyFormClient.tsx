'use client'

import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import imageCompression from 'browser-image-compression'
import type SignatureCanvasInstance from 'react-signature-canvas'
import { createClient } from '@/lib/supabase/client'
import GPSCapture, { type GPSCoords } from '@/components/survey/GPSCapture'
import PhotoUploader from '@/components/survey/PhotoUploader'
import NamedPhotoSlot from '@/components/survey/NamedPhotoSlot'
import QuestionnaireFieldInput from '@/components/survey/QuestionnaireFieldInput'
import { submitSurvey, type PhotoMeta } from '@/app/agent/survey/actions'
import { enqueueSurvey, removeSurvey } from '@/lib/offline/surveyQueue'
import {
  QUESTIONNAIRE,
  MANDATORY_PHOTO_SLOTS,
  validateAnswers,
  type Answers,
} from '@/lib/survey/questionnaire'
import type { Location } from '@/types'

const SignaturePadWidget = dynamic(
  () => import('@/components/qc/SignaturePadWidget'),
  { ssr: false },
)

// ─── Reusable layout sub-components ────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-gray-800 mb-4">{children}</h2>
}

/** Converts a data-URL (from signature_pad's toDataURL) into a File for upload. */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], filename, { type: mime })
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  location: Location
}

export default function SurveyFormClient({ location }: Props) {
  const router = useRouter()

  // ── GPS: toilet location + ramp start/end (Section 3) ──────────────────────
  const [gps, setGps]         = useState<GPSCoords | null>(null)
  const [rampGps, setRampGps] = useState<GPSCoords | null>(null)
  const [gpsAccuracyScreenshot, setGpsAccuracyScreenshot] = useState<File | null>(null)

  // ── Sections 1–2, 4–14, 16 — all dynamic questionnaire answers ─────────────
  const [answers, setAnswers] = useState<Answers>({})
  function setAnswer(fieldId: string, value: Answers[string]) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }))
  }

  // ── Section 15 — 10 mandatory named photos ──────────────────────────────────
  const [mandatoryPhotos, setMandatoryPhotos] = useState<Record<string, File | null>>({})

  // ── Extra Section 15 shots (proposed toilet location, ramp alignment, etc.) ─
  const [additionalPhotos, setAdditionalPhotos] = useState<File[]>([])

  // ── Section 11 — Braille layout map attachments ─────────────────────────────
  const [layoutMapPhotos, setLayoutMapPhotos] = useState<File[]>([])

  // ── Section 17 — Declaration ─────────────────────────────────────────────────
  const [teamName, setTeamName]                     = useState('')
  const [authorityName, setAuthorityName]           = useState('')
  const [authorityDesignation, setAuthorityDesignation] = useState('')
  const [declarationDate, setDeclarationDate]       = useState(() => new Date().toISOString().slice(0, 10))
  const teamSigRef      = useRef<SignatureCanvasInstance | null>(null)
  const authoritySigRef = useRef<SignatureCanvasInstance | null>(null)
  const [teamSigError, setTeamSigError]           = useState<string | null>(null)
  const [authoritySigError, setAuthoritySigError] = useState<string | null>(null)

  // ── Submission state ───────────────────────────────────────────────────────
  const [submitting,     setSubmitting]     = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [submitError,    setSubmitError]    = useState<string | null>(null)
  const [offlineSaved,   setOfflineSaved]   = useState(false)

  // ── Photo compression helper ────────────────────────────────────────────────
  async function compressFiles(files: File[], label: string): Promise<File[]> {
    if (files.length === 0) return []
    const result: File[] = []
    for (let i = 0; i < files.length; i++) {
      setUploadProgress(`Compressing ${label} ${i + 1} of ${files.length}…`)
      const compressed = await imageCompression(files[i], {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      })
      result.push(new File([compressed], files[i].name, { type: compressed.type || 'image/jpeg' }))
    }
    setUploadProgress(null)
    return result
  }

  async function uploadCompressedFiles(compressedFiles: File[], subfolder: string): Promise<string[]> {
    if (compressedFiles.length === 0) return []
    const supabase = createClient()
    const paths: string[] = []
    const timestamp = Date.now()

    for (let i = 0; i < compressedFiles.length; i++) {
      const file = compressedFiles[i]
      setUploadProgress(`Uploading ${subfolder} ${i + 1} of ${compressedFiles.length}…`)
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${location.location_code}/survey/${subfolder}/${timestamp}_${i}_${safeName}`

      const { error } = await supabase.storage
        .from('survey-media')
        .upload(path, file, { cacheControl: '3600', upsert: false })

      if (error) throw new Error(`${subfolder} upload ${i + 1} failed: ${error.message}`)
      paths.push(path)
    }
    setUploadProgress(null)
    return paths
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate(): string | null {
    const questionnaireError = validateAnswers(answers)
    if (questionnaireError) return questionnaireError

    const missingSlots = MANDATORY_PHOTO_SLOTS.filter((s) => !mandatoryPhotos[s.id])
    if (missingSlots.length > 0) {
      return `Please add all 10 mandatory photos — missing: ${missingSlots.map((s) => s.label).join(', ')}.`
    }

    if (!teamName.trim()) return 'Please enter the Survey Team name (Section 17 — Declaration).'
    if (!authorityName.trim()) return 'Please enter the School Authority name (Section 17 — Declaration).'
    if (!teamSigRef.current || teamSigRef.current.isEmpty())
      return 'Please capture the Survey Team signature (Section 17).'
    if (!authoritySigRef.current || authoritySigRef.current.isEmpty())
      return 'Please capture the School Authority signature (Section 17).'

    return null
  }

  // ── Submit — offline-first ─────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setTeamSigError(null)
    setAuthoritySigError(null)

    const validationError = validate()
    if (validationError) {
      setSubmitError(validationError)
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      return
    }

    setSubmitting(true)
    try {
      // ── Step 1: Build one ordered file list + parallel metadata ────────────
      // Order: mandatory (10, fixed order) → additional → layout map →
      // gps accuracy screenshot → signatures (team, authority)
      const orderedFiles: File[] = []
      const photoMeta: PhotoMeta[] = []

      for (const slot of MANDATORY_PHOTO_SLOTS) {
        const f = mandatoryPhotos[slot.id]
        if (f) {
          orderedFiles.push(f)
          photoMeta.push({ kind: 'mandatory', slotId: slot.id })
        }
      }
      additionalPhotos.forEach((f) => {
        orderedFiles.push(f)
        photoMeta.push({ kind: 'additional' })
      })
      layoutMapPhotos.forEach((f) => {
        orderedFiles.push(f)
        photoMeta.push({ kind: 'layoutmap' })
      })
      if (gpsAccuracyScreenshot) {
        orderedFiles.push(gpsAccuracyScreenshot)
        photoMeta.push({ kind: 'gpsaccuracy' })
      }

      const teamSigFile = dataUrlToFile(
        teamSigRef.current!.getTrimmedCanvas().toDataURL('image/png'),
        'team_signature.png',
      )
      const authoritySigFile = dataUrlToFile(
        authoritySigRef.current!.getTrimmedCanvas().toDataURL('image/png'),
        'authority_signature.png',
      )
      orderedFiles.push(teamSigFile)
      photoMeta.push({ kind: 'signature', slotId: 'team' })
      orderedFiles.push(authoritySigFile)
      photoMeta.push({ kind: 'signature', slotId: 'authority' })

      // ── Step 2: Compress everything (signatures are tiny — negligible cost) ─
      const compressedFiles = await compressFiles(orderedFiles, 'file')

      const surveyPayload = {
        locationId: location.id,
        gpsLat: gps?.lat ?? null,
        gpsLng: gps?.lng ?? null,
        gpsAccuracy: gps?.accuracy ?? null,
        rampGpsLat: rampGps?.lat ?? null,
        rampGpsLng: rampGps?.lng ?? null,
        rampGpsAccuracy: rampGps?.accuracy ?? null,
        answers,
        photoMeta,
        teamName,
        authorityName,
        authorityDesignation,
        declarationDate,
      }

      // ── Step 3: Save to IndexedDB (always, regardless of connectivity) ─────
      const queueId = await enqueueSurvey(surveyPayload, compressedFiles, location.location_code)

      // ── Step 4: Attempt immediate online sync ───────────────────────────────
      if (!navigator.onLine) {
        setOfflineSaved(true)
        return
      }

      try {
        setUploadProgress('Uploading photos…')
        const photoPaths = await uploadCompressedFiles(compressedFiles, 'media')

        setUploadProgress('Saving survey…')
        const result = await submitSurvey({ ...surveyPayload, photoPaths })

        if (!result.success) {
          setSubmitError(result.error)
          return
        }

        await removeSurvey(queueId)
        router.push('/agent/dashboard')
        router.refresh()
      } catch {
        setOfflineSaved(true)
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.')
    } finally {
      setSubmitting(false)
      setUploadProgress(null)
    }
  }

  // ── Render: offline-saved confirmation ──────────────────────────────────────
  if (offlineSaved) {
    return (
      <div className="space-y-4 pb-6">
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-5 text-center">
          <div
            className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg className="w-6 h-6 text-amber-600" width={24} height={24} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-amber-800 mb-1">Saved offline</h2>
          <p className="text-sm text-amber-700">Your survey has been saved to this device.</p>
          <p className="text-sm text-amber-700 mt-0.5">It will sync to the server automatically when you reconnect.</p>
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
          <span className="font-mono text-sm font-bold text-gray-900">{location.location_code}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium">
            Survey in progress
          </span>
        </div>
        {location.name && <p className="text-sm font-medium text-gray-700 mt-1">{location.name}</p>}
        {(location.district || location.block) && (
          <p className="text-xs text-gray-500 mt-0.5">
            {[location.district, location.block, location.village].filter(Boolean).join(' · ')}
          </p>
        )}
        <p className="text-xs text-gray-400 mt-2">
          CWSN Infrastructure Survey Questionnaire — Rajasthan Government School Education
        </p>
      </Card>

      {/* ── Sections 1–2: dynamic ────────────────────────────────────────── */}
      {QUESTIONNAIRE.slice(0, 2).map((section) => (
        <Card key={section.id} className="space-y-4">
          <SectionTitle>{section.title}</SectionTitle>
          {section.fields
            .filter((f) => !f.showIf || answers[f.showIf.fieldId] === f.showIf.equals)
            .map((field) => (
              <QuestionnaireFieldInput
                key={field.id}
                field={field}
                value={answers[field.id] ?? null}
                onChange={(v) => setAnswer(field.id, v)}
                disabled={submitting}
              />
            ))}
        </Card>
      ))}

      {/* ── Section 3: GPS & Site Location ──────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Section 3 — GPS &amp; Site Location Details
        </p>
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1.5">Toilet Location</p>
          <GPSCapture onCapture={setGps} captured={gps} />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1.5">Ramp Start / End</p>
          <GPSCapture onCapture={setRampGps} captured={rampGps} />
        </div>
        <Card>
          <p className="text-sm font-medium text-gray-700 mb-2">GPS Accuracy Screenshot</p>
          <PhotoUploader
            files={gpsAccuracyScreenshot ? [gpsAccuracyScreenshot] : []}
            onChange={(files) => setGpsAccuracyScreenshot(files[0] ?? null)}
            disabled={submitting}
            maxPhotos={1}
          />
        </Card>
        {(!gps || !rampGps) && (
          <p className="text-xs text-amber-600">
            GPS not fully captured — the form can still be submitted, but location proof is recommended.
          </p>
        )}
      </section>

      {/* ── Sections 4–14, 16: dynamic ──────────────────────────────────── */}
      {QUESTIONNAIRE.slice(2).map((section) => (
        <Card key={section.id} className="space-y-4">
          <SectionTitle>{section.title}</SectionTitle>
          {section.fields
            .filter((f) => !f.showIf || answers[f.showIf.fieldId] === f.showIf.equals)
            .map((field) => (
              <QuestionnaireFieldInput
                key={field.id}
                field={field}
                value={answers[field.id] ?? null}
                onChange={(v) => setAnswer(field.id, v)}
                disabled={submitting}
              />
            ))}
        </Card>
      ))}

      {/* ── Section 11 attachment: Braille layout map ───────────────────── */}
      <Card>
        <SectionTitle>Section 11 — Attach Layout Map</SectionTitle>
        <p className="text-xs text-gray-500 mb-2">Hand-drawn / printed map, and digital layout if available.</p>
        <PhotoUploader files={layoutMapPhotos} onChange={setLayoutMapPhotos} disabled={submitting} maxPhotos={3} />
      </Card>

      {/* ── Section 15: mandatory photo documentation ───────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-1">
          <SectionTitle>Section 15 — Photo Documentation</SectionTitle>
          <span className="text-xs text-gray-400 -mt-3">
            {Object.values(mandatoryPhotos).filter(Boolean).length}/10
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-3">All 10 angles are mandatory.</p>
        <div className="grid grid-cols-3 gap-2">
          {MANDATORY_PHOTO_SLOTS.map((slot, i) => (
            <NamedPhotoSlot
              key={slot.id}
              index={i + 1}
              label={slot.label}
              file={mandatoryPhotos[slot.id] ?? null}
              onChange={(file) => setMandatoryPhotos((prev) => ({ ...prev, [slot.id]: file }))}
              disabled={submitting}
            />
          ))}
        </div>

        <div className="border-t border-gray-100 mt-4 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Additional Photos <span className="text-gray-400 font-normal">(obstacles, proposed toilet location, ramp alignment, tactile route, etc.)</span>
          </p>
          <PhotoUploader files={additionalPhotos} onChange={setAdditionalPhotos} disabled={submitting} maxPhotos={10} />
        </div>
      </Card>

      {/* ── Section 17: Declaration ──────────────────────────────────────── */}
      <Card className="space-y-5">
        <SectionTitle>Section 17 — Declaration</SectionTitle>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">By Survey Team</p>
          <p className="text-xs text-gray-500 mb-3">
            We hereby confirm that the above survey has been conducted thoroughly and all site conditions,
            constraints, and execution risks have been recorded accurately.
          </p>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 mb-3"
          />
          <label className="block text-xs font-medium text-gray-600 mb-1">Signature</label>
          <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
            <SignaturePadWidget onReady={(instance) => { teamSigRef.current = instance }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            {teamSigError && <span className="text-xs text-red-600">{teamSigError}</span>}
            <button
              type="button"
              onClick={() => { teamSigRef.current?.clear(); setTeamSigError(null) }}
              disabled={submitting}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 ml-auto"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">By School Authority</p>
          <p className="text-xs text-gray-500 mb-3">
            Certified that the above details are verified and approved for execution.
          </p>
          <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
          <input
            type="text"
            value={authorityName}
            onChange={(e) => setAuthorityName(e.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 mb-3"
          />
          <label className="block text-xs font-medium text-gray-600 mb-1">Designation</label>
          <input
            type="text"
            value={authorityDesignation}
            onChange={(e) => setAuthorityDesignation(e.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 mb-3"
          />
          <label className="block text-xs font-medium text-gray-600 mb-1">Signature &amp; Stamp</label>
          <div className="border border-gray-300 rounded-lg bg-white overflow-hidden">
            <SignaturePadWidget onReady={(instance) => { authoritySigRef.current = instance }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            {authoritySigError && <span className="text-xs text-red-600">{authoritySigError}</span>}
            <button
              type="button"
              onClick={() => { authoritySigRef.current?.clear(); setAuthoritySigError(null) }}
              disabled={submitting}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 ml-auto"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
          <input
            type="date"
            value={declarationDate}
            onChange={(e) => setDeclarationDate(e.target.value)}
            disabled={submitting}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>
      </Card>

      {/* ── Upload progress ───────────────────────────────────────────────── */}
      {uploadProgress && (
        <div className="flex items-center gap-2.5 text-sm text-blue-700 bg-blue-50 rounded-xl px-4 py-3 border border-blue-200">
          <svg className="w-4 h-4 animate-spin flex-shrink-0" width={16} height={16} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {uploadProgress}
        </div>
      )}

      {/* ── Validation / submit error ─────────────────────────────────────── */}
      {submitError && (
        <div className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3 border border-red-200">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
