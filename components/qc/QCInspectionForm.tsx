'use client'

import { useState, useRef, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'
import { submitQCInspection } from '@/app/qc/inspect/actions'
import type { ProductionJobForQC } from '@/lib/supabase/qc'
import type SignatureCanvasType from 'react-signature-canvas'

// Load the signature pad only in the browser — react-signature-canvas / signature_pad
// use browser globals (pointer events, HTMLCanvasElement) so they must never run
// on the server.  next/dynamic with ssr:false guarantees this.
// `loading` prop shows a placeholder while the JS chunk is being fetched.
const SignaturePadWidget = dynamic(
  () => import('./SignaturePadWidget'),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center text-sm text-gray-400"
        style={{ height: 140 }}
      >
        Loading signature pad…
      </div>
    ),
  }
)

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 ${className}`}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
      {children}
    </h2>
  )
}

// Pass / Fail toggle — used for each checklist item
function PassFailToggle({
  value,
  onChange,
  passLabel = 'Pass',
  failLabel = 'Fail',
  disabled,
}: {
  value: boolean | null
  onChange: (v: boolean) => void
  passLabel?: string
  failLabel?: string
  disabled?: boolean
}) {
  return (
    <div className="flex gap-2 mt-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        disabled={disabled}
        className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all disabled:opacity-50 ${
          value === true
            ? 'bg-green-600 border-green-600 text-white'
            : 'bg-white border-gray-300 text-gray-600 hover:border-green-400'
        }`}
      >
        ✓ {passLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        disabled={disabled}
        className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all disabled:opacity-50 ${
          value === false
            ? 'bg-red-600 border-red-600 text-white'
            : 'bg-white border-gray-300 text-gray-600 hover:border-red-400'
        }`}
      >
        ✗ {failLabel}
      </button>
    </div>
  )
}

function Notes({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  disabled?: boolean
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={2}
      placeholder={placeholder}
      className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50 resize-none"
    />
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

interface Props {
  job: ProductionJobForQC
}

export default function QCInspectionForm({ job }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Checklist state ──────────────────────────────────────────────────────
  const [qtyCorrect, setQtyCorrect] = useState<boolean | null>(null)
  const [qtyNotes, setQtyNotes] = useState('')
  const [dimensionsCorrect, setDimensionsCorrect] = useState<boolean | null>(null)
  const [dimensionsNotes, setDimensionsNotes] = useState('')
  const [finishQualityPass, setFinishQualityPass] = useState<boolean | null>(null)
  const [finishNotes, setFinishNotes] = useState('')
  const [defectsPresent, setDefectsPresent] = useState<boolean | null>(null)
  const [defectsDescription, setDefectsDescription] = useState('')
  const [overallNotes, setOverallNotes] = useState('')

  // ── Inspector details ────────────────────────────────────────────────────
  const [inspectorName, setInspectorName] = useState('')

  // ── Photos ──────────────────────────────────────────────────────────────
  const [photos, setPhotos] = useState<File[]>([])
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Rework deadline (only if fail) ───────────────────────────────────────
  const [reworkDeadline, setReworkDeadline] = useState('')

  // ── Signature ────────────────────────────────────────────────────────────
  // sigInstance: holds the live SignatureCanvas instance passed up via onReady.
  // SignaturePadWidget (loaded with ssr:false) calls onReady once after mount.
  const sigInstance = useRef<SignatureCanvasType | null>(null)
  const [sigError, setSigError] = useState<string | null>(null)

  // ── Submission state ─────────────────────────────────────────────────────
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)

  const loc = job.location
  const unit = job.unit
  const isSubmitting = isPending

  // ── Photo handlers ───────────────────────────────────────────────────────
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (photos.length + files.length > 10) {
      setPhotoError('Maximum 10 photos allowed')
      return
    }
    setPhotoError(null)
    setPhotos((prev) => [...prev, ...files])
    // Reset input so same file can be re-selected after removal
    e.target.value = ''
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx))
  }

  // ── Upload photos to Supabase Storage ────────────────────────────────────
  async function uploadPhotos(): Promise<string[]> {
    if (photos.length === 0) return []

    const supabase = createClient()
    const paths: string[] = []

    for (let i = 0; i < photos.length; i++) {
      const file = photos[i]
      setUploadProgress(`Compressing photo ${i + 1} of ${photos.length}…`)

      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      })

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${loc.location_code}/qc/${Date.now()}_${i}_${safeName}`

      setUploadProgress(`Uploading photo ${i + 1} of ${photos.length}…`)

      const { error } = await supabase.storage
        .from('qc-inspections')
        .upload(path, compressed, { contentType: compressed.type, upsert: false })

      if (error) {
        console.error('[uploadPhotos]', error.message)
        throw new Error(`Failed to upload photo ${i + 1}: ${error.message}`)
      }

      paths.push(path)
    }

    return paths
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(result: 'passed' | 'failed'): string | null {
    if (qtyCorrect === null) return 'Please mark quantities as Pass or Fail'
    if (dimensionsCorrect === null) return 'Please mark dimensions as Pass or Fail'
    if (finishQualityPass === null) return 'Please mark finish quality as Pass or Fail'
    if (defectsPresent === null) return 'Please indicate whether defects are present'
    if (!inspectorName.trim()) return 'Please enter your name'
    if (!sigInstance.current || sigInstance.current.isEmpty()) return 'Please sign the form before submitting'
    if (result === 'failed' && !reworkDeadline) return 'Please set a rework deadline for failed inspections'
    return null
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function handleSubmit(result: 'passed' | 'failed') {
    const validationError = validate(result)
    if (validationError) {
      setSubmitError(validationError)
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      return
    }

    setSubmitError(null)
    setSigError(null)

    startTransition(async () => {
      try {
        // 1. Upload photos
        setUploadProgress('Uploading photos…')
        const photoPaths = await uploadPhotos()

        // 2. Capture signature as base64 PNG
        setUploadProgress('Processing signature…')
        const signatureDataUrl = sigInstance.current?.toDataURL('image/png') ?? ''

        // 3. Call server action
        setUploadProgress('Submitting inspection…')
        const result_ = await submitQCInspection({
          jobId: job.id,
          locationId: job.location_id,
          locationCode: loc.location_code,
          qtyCorrect,
          qtyNotes,
          dimensionsCorrect,
          dimensionsNotes,
          finishQualityPass,
          finishNotes,
          defectsPresent,
          defectsDescription,
          overallNotes,
          photoPaths,
          signatureDataUrl,
          inspectorName: inspectorName.trim(),
          result,
          reworkDeadline,
        })

        if (result_.success) {
          router.push('/qc/dashboard?submitted=1')
        } else {
          setSubmitError(result_.error ?? 'Submission failed. Please try again.')
          setUploadProgress(null)
        }
      } catch (err) {
        console.error('[QCInspectionForm submit]', err)
        setSubmitError('An unexpected error occurred. Please try again.')
        setUploadProgress(null)
      }
    })
  }

  return (
    <div className="space-y-5 pb-8">

      {/* ── Job header ────────────────────────────────────────────────────── */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <div className="text-xs font-mono text-indigo-400 mb-0.5">{loc.location_code}</div>
        <h1 className="text-lg font-bold text-indigo-900">{loc.name ?? loc.location_code}</h1>
        {(loc.district || loc.block) && (
          <p className="text-sm text-indigo-600">{[loc.block, loc.district].filter(Boolean).join(', ')}</p>
        )}
        <p className="text-xs text-indigo-500 mt-1">Unit: {unit.name}</p>
        {job.completed_at && (
          <p className="text-xs text-indigo-400 mt-0.5">
            Production completed: {new Date(job.completed_at).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </p>
        )}
      </div>

      {/* ── Quantities to inspect ─────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Quantities to Inspect</SectionTitle>
        <div className="space-y-1 text-sm text-gray-700">
          {(job.qty_tiles ?? 0) > 0 && <div className="flex justify-between"><span>Tiles</span><span className="font-semibold">{job.qty_tiles} sq ft</span></div>}
          {(job.qty_toilet_units ?? 0) > 0 && <div className="flex justify-between"><span>Toilet units</span><span className="font-semibold">{job.qty_toilet_units}</span></div>}
          {(job.qty_ramp_units ?? 0) > 0 && <div className="flex justify-between"><span>Ramp units</span><span className="font-semibold">{job.qty_ramp_units}</span></div>}
          {(job.qty_fittings ?? 0) > 0 && <div className="flex justify-between"><span>Fitting sets</span><span className="font-semibold">{job.qty_fittings}</span></div>}
        </div>
      </Card>

      {/* ── Checklist ─────────────────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Inspection Checklist</SectionTitle>

        {/* Quantities */}
        <div className="mb-5">
          <p className="text-sm font-medium text-gray-800">1. Quantities correct?</p>
          <PassFailToggle value={qtyCorrect} onChange={setQtyCorrect} disabled={isSubmitting} />
          <Notes value={qtyNotes} onChange={setQtyNotes} placeholder="Notes on quantities (optional)" disabled={isSubmitting} />
        </div>

        {/* Dimensions */}
        <div className="mb-5">
          <p className="text-sm font-medium text-gray-800">2. Dimensions correct?</p>
          <PassFailToggle value={dimensionsCorrect} onChange={setDimensionsCorrect} disabled={isSubmitting} />
          <Notes value={dimensionsNotes} onChange={setDimensionsNotes} placeholder="Notes on dimensions (optional)" disabled={isSubmitting} />
        </div>

        {/* Finish quality */}
        <div className="mb-5">
          <p className="text-sm font-medium text-gray-800">3. Finish quality acceptable?</p>
          <PassFailToggle value={finishQualityPass} onChange={setFinishQualityPass} disabled={isSubmitting} />
          <Notes value={finishNotes} onChange={setFinishNotes} placeholder="Notes on finish quality (optional)" disabled={isSubmitting} />
        </div>

        {/* Defects */}
        <div>
          <p className="text-sm font-medium text-gray-800">4. Defects present?</p>
          <PassFailToggle
            value={defectsPresent === null ? null : !defectsPresent}
            onChange={(v) => setDefectsPresent(!v)}
            passLabel="No defects"
            failLabel="Defects found"
            disabled={isSubmitting}
          />
          {defectsPresent === true && (
            <Notes
              value={defectsDescription}
              onChange={setDefectsDescription}
              placeholder="Describe the defects found…"
              disabled={isSubmitting}
            />
          )}
        </div>
      </Card>

      {/* ── Overall notes ─────────────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Overall Notes</SectionTitle>
        <textarea
          value={overallNotes}
          onChange={(e) => setOverallNotes(e.target.value)}
          disabled={isSubmitting}
          rows={3}
          placeholder="Any additional observations about the goods…"
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50 resize-none"
        />
      </Card>

      {/* ── Photo upload ──────────────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Inspection Photos</SectionTitle>
        <p className="text-xs text-gray-500 mb-3">
          Photograph the goods as evidence — up to 10 photos. Compressed automatically.
        </p>

        {/* Thumbnails */}
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {photos.map((file, idx) => {
              const url = URL.createObjectURL(file)
              return (
                <div key={idx} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Photo ${idx + 1}`}
                    className="w-full aspect-square object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    disabled={isSubmitting}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                    style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <span className="text-white text-xs leading-none">✕</span>
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {photoError && (
          <p className="text-xs text-red-600 mb-2">{photoError}</p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={handlePhotoSelect}
          disabled={isSubmitting}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSubmitting || photos.length >= 10}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          + Add Photos ({photos.length}/10)
        </button>
      </Card>

      {/* ── Inspector details ─────────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Inspector Details</SectionTitle>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Your name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={inspectorName}
          onChange={(e) => setInspectorName(e.target.value)}
          disabled={isSubmitting}
          placeholder="Full name of QC inspector"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
        />
      </Card>

      {/* ── Signature ─────────────────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Inspector Signature</SectionTitle>
        <p className="text-xs text-gray-500 mb-3">Sign with your finger or mouse in the box below.</p>

        <div className="border-2 border-gray-300 rounded-xl overflow-hidden bg-white" style={{ touchAction: 'none' }}>
          <SignaturePadWidget
            onReady={(instance) => { sigInstance.current = instance }}
          />
        </div>

        {sigError && (
          <p className="text-xs text-red-600 mt-1">{sigError}</p>
        )}

        <button
          type="button"
          onClick={() => { sigInstance.current?.clear(); setSigError(null) }}
          disabled={isSubmitting}
          className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline disabled:opacity-50"
        >
          Clear signature
        </button>
      </Card>

      {/* ── Rework deadline (only shown when about to fail) ───────────────── */}
      <Card>
        <SectionTitle>Rework Deadline (if failing)</SectionTitle>
        <p className="text-xs text-gray-500 mb-2">
          Required if you submit as FAIL. Set the date by which rework must be completed.
        </p>
        <input
          type="date"
          value={reworkDeadline}
          onChange={(e) => setReworkDeadline(e.target.value)}
          disabled={isSubmitting}
          min={new Date().toISOString().split('T')[0]}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        />
      </Card>

      {/* ── Upload / submit progress ──────────────────────────────────────── */}
      {uploadProgress && (
        <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm text-indigo-700">
          {uploadProgress}
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {submitError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      {/* ── Submit buttons ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => handleSubmit('passed')}
          disabled={isSubmitting}
          className="w-full py-4 px-6 bg-green-600 text-white text-base font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {isSubmitting ? 'Submitting…' : '✓  Submit as PASSED'}
        </button>
        <button
          type="button"
          onClick={() => handleSubmit('failed')}
          disabled={isSubmitting}
          className="w-full py-4 px-6 bg-red-600 text-white text-base font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {isSubmitting ? 'Submitting…' : '✗  Submit as FAILED'}
        </button>
      </div>

      {/* ── Back link ─────────────────────────────────────────────────────── */}
      <div className="text-center">
        <a href="/qc/dashboard" className="text-sm text-indigo-600 hover:text-indigo-700">
          ← Back to QC queue
        </a>
      </div>
    </div>
  )
}
