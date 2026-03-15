'use client'

import { useState, useRef, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'
import GPSCapture, { type GPSCoords } from '@/components/survey/GPSCapture'
import PhotoUploader from '@/components/survey/PhotoUploader'
import { submitInstallationReport } from '@/app/agent/install/[locationId]/actions'
import type { Location } from '@/types'
import type SignatureCanvasType from 'react-signature-canvas'

// Load signature pad only in browser (same pattern as QC form)
const SignaturePadWidget = dynamic(
  () => import('@/components/qc/SignaturePadWidget'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center text-sm text-gray-400" style={{ height: 140 }}>
        Loading signature pad…
      </div>
    ),
  }
)

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-gray-200 p-5 ${className}`}>{children}</div>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">{children}</h2>
}

function YesNoField({
  label, value, onChange, disabled,
}: { label: string; value: boolean | null; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <p className="text-sm font-medium text-gray-800 mb-2">{label}</p>
      <div className="flex gap-2">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            disabled={disabled}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all disabled:opacity-50 ${
              value === v
                ? v ? 'bg-green-600 border-green-600 text-white' : 'bg-red-600 border-red-600 text-white'
                : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
            }`}
          >
            {v ? '✓ Yes' : '✗ No'}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

interface Props {
  location: Location
}

export default function InstallationForm({ location: loc }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [gps, setGps] = useState<GPSCoords | null>(null)
  const [toiletInstalled, setToiletInstalled] = useState<boolean | null>(null)
  const [rampInstalled, setRampInstalled] = useState<boolean | null>(null)
  const [hardwareInstalled, setHardwareInstalled] = useState<boolean | null>(null)
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [signedByName, setSignedByName] = useState('')
  const [signedByDesignation, setSignedByDesignation] = useState('')

  const sigInstance = useRef<SignatureCanvasType | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const isSubmitting = isPending

  async function uploadPhotos(): Promise<string[]> {
    if (!photos.length) return []
    const supabase = createClient()
    const paths: string[] = []
    for (let i = 0; i < photos.length; i++) {
      const file = photos[i]
      setUploadProgress(`Compressing photo ${i + 1} of ${photos.length}…`)
      const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true })
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${loc.location_code}/install/${Date.now()}_${i}_${safeName}`
      setUploadProgress(`Uploading photo ${i + 1} of ${photos.length}…`)
      const { error } = await supabase.storage
        .from('installation-media')
        .upload(path, compressed, { contentType: compressed.type, upsert: false })
      if (error) throw new Error(`Photo upload failed: ${error.message}`)
      paths.push(path)
    }
    return paths
  }

  function validate(): string | null {
    if (toiletInstalled === null) return 'Please confirm whether toilet was installed'
    if (rampInstalled === null) return 'Please confirm whether ramp was installed'
    if (hardwareInstalled === null) return 'Please confirm whether hardware/fittings were installed'
    if (!signedByName.trim()) return 'Please enter the supervisor name'
    if (!sigInstance.current || sigInstance.current.isEmpty()) return 'Please obtain supervisor signature'
    return null
  }

  function handleSubmit() {
    const validationError = validate()
    if (validationError) { setSubmitError(validationError); return }
    setSubmitError(null)

    startTransition(async () => {
      try {
        setUploadProgress('Uploading photos…')
        const photoPaths = await uploadPhotos()

        setUploadProgress('Processing signature…')
        const signatureDataUrl = sigInstance.current?.toDataURL('image/png') ?? ''

        setUploadProgress('Submitting report…')
        const result = await submitInstallationReport({
          locationId: loc.id,
          locationCode: loc.location_code,
          gpsLat: gps?.lat ?? null,
          gpsLng: gps?.lng ?? null,
          toiletInstalled,
          rampInstalled,
          hardwareInstalled,
          installationNotes: notes,
          photoPaths,
          signatureDataUrl,
          signedByName: signedByName.trim(),
          signedByDesignation: signedByDesignation.trim(),
        })

        if (result.success) {
          setSuccess(true)
          setTimeout(() => router.push('/agent/dashboard'), 2500)
        } else {
          setSubmitError(result.error ?? 'Submission failed. Please try again.')
          setUploadProgress(null)
        }
      } catch (err) {
        console.error('[InstallationForm]', err)
        setSubmitError('An unexpected error occurred. Please try again.')
        setUploadProgress(null)
      }
    })
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4"
          style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg className="w-7 h-7 text-green-600" width={28} height={28} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Report Submitted!</h2>
        <p className="text-sm text-gray-500">Installation report saved. PDF is being generated. Redirecting…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-8">

      {/* Location header */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="text-xs font-mono text-green-400 mb-0.5">{loc.location_code}</div>
        <h1 className="text-lg font-bold text-green-900">{loc.name ?? loc.location_code}</h1>
        {(loc.district || loc.block) && (
          <p className="text-sm text-green-700">{[loc.block, loc.district].filter(Boolean).join(', ')}</p>
        )}
      </div>

      {/* GPS */}
      <GPSCapture onCapture={setGps} captured={gps} />

      {/* Installation checklist */}
      <Card>
        <SectionTitle>Installation Checklist</SectionTitle>
        <YesNoField label="Toilet installed?" value={toiletInstalled} onChange={setToiletInstalled} disabled={isSubmitting} />
        <YesNoField label="Ramp installed?" value={rampInstalled} onChange={setRampInstalled} disabled={isSubmitting} />
        <YesNoField label="Hardware / fittings installed?" value={hardwareInstalled} onChange={setHardwareInstalled} disabled={isSubmitting} />
      </Card>

      {/* Notes */}
      <Card>
        <SectionTitle>Installation Notes</SectionTitle>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isSubmitting}
          rows={3}
          placeholder="Any notes about the installation…"
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 resize-none"
        />
      </Card>

      {/* Photos */}
      <Card>
        <SectionTitle>Installation Photos</SectionTitle>
        <p className="text-xs text-gray-400 mb-3">Photograph the installed goods — up to 6 photos.</p>
        <PhotoUploader files={photos} onChange={setPhotos} disabled={isSubmitting} maxPhotos={6} />
      </Card>

      {/* Supervisor details */}
      <Card>
        <SectionTitle>Supervisor Details</SectionTitle>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Supervisor name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={signedByName}
              onChange={(e) => setSignedByName(e.target.value)}
              disabled={isSubmitting}
              placeholder="Full name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Designation</label>
            <input
              type="text"
              value={signedByDesignation}
              onChange={(e) => setSignedByDesignation(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. Headmaster, District Officer"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
            />
          </div>
        </div>
      </Card>

      {/* Signature */}
      <Card>
        <SectionTitle>Supervisor Signature</SectionTitle>
        <p className="text-xs text-gray-400 mb-3">Have the supervisor sign below with finger or mouse.</p>
        <div className="border-2 border-gray-300 rounded-xl overflow-hidden bg-white" style={{ touchAction: 'none' }}>
          <SignaturePadWidget
            onReady={(inst: SignatureCanvasType) => { sigInstance.current = inst }}
          />
        </div>
        <button
          type="button"
          onClick={() => sigInstance.current?.clear()}
          disabled={isSubmitting}
          className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline disabled:opacity-50"
        >
          Clear signature
        </button>
      </Card>

      {/* Progress */}
      {uploadProgress && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {uploadProgress}
        </div>
      )}

      {/* Error */}
      {submitError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full py-4 px-6 bg-green-600 text-white text-base font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        {isSubmitting ? 'Submitting…' : 'Submit Installation Report'}
      </button>

      <div className="text-center">
        <a href="/agent/dashboard" className="text-sm text-green-600 hover:text-green-700">
          ← Back to dashboard
        </a>
      </div>
    </div>
  )
}
