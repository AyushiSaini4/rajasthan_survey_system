'use client'

import { useState, useRef, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'
import PhotoUploader from '@/components/survey/PhotoUploader'
import GPSCapture, { type GPSCoords } from '@/components/survey/GPSCapture'
import { submitInstallationReport } from '@/app/agent/install/[locationId]/actions'
import { INSTALL_PHOTO_SLOTS, type InstallPhotoSlotId, type Location } from '@/types'
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

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{children}</h2>
      {hint && <p className="text-xs text-gray-400 mt-1 normal-case tracking-normal">{hint}</p>}
    </div>
  )
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

// One signature block: name (+ optional designation) + pad. Used 3x (Principal / Dept Rep / Contractor).
function SignatureBlock({
  title, hint, name, onNameChange, designation, onDesignationChange, onReady, onClear, disabled,
}: {
  title: string
  hint?: string
  name: string
  onNameChange: (v: string) => void
  designation?: string
  onDesignationChange?: (v: string) => void
  onReady: (inst: SignatureCanvasType) => void
  onClear: () => void
  disabled?: boolean
}) {
  return (
    <Card>
      <SectionTitle hint={hint}>{title}</SectionTitle>
      <div className="space-y-3 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={disabled}
            placeholder="Full name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          />
        </div>
        {onDesignationChange && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Designation</label>
            <input
              type="text"
              value={designation}
              onChange={(e) => onDesignationChange(e.target.value)}
              disabled={disabled}
              placeholder="e.g. Principal, Headmaster"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
            />
          </div>
        )}
      </div>
      <div className="border-2 border-gray-300 rounded-xl overflow-hidden bg-white" style={{ touchAction: 'none' }}>
        <SignaturePadWidget onReady={onReady} />
      </div>
      <button
        type="button"
        onClick={onClear}
        disabled={disabled}
        className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline disabled:opacity-50"
      >
        Clear signature
      </button>
    </Card>
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
  const [installationDate, setInstallationDate] = useState('')

  // ── Installation checklist (matches GeM completion certificate items) ────
  const [cwsnUnitInstalled, setCwsnUnitInstalled] = useState<boolean | null>(null)
  const [rampInstalled, setRampInstalled] = useState<boolean | null>(null)
  const [grabBarsInstalled, setGrabBarsInstalled] = useState<boolean | null>(null)
  const [brailleSignageInstalled, setBrailleSignageInstalled] = useState<boolean | null>(null)
  const [brailleLayoutInstalled, setBrailleLayoutInstalled] = useState<boolean | null>(null)
  const [tactileTilesInstalled, setTactileTilesInstalled] = useState<boolean | null>(null)
  const [plumbingConnected, setPlumbingConnected] = useState<boolean | null>(null)
  const [electricalConnected, setElectricalConnected] = useState<boolean | null>(null)
  const [functionalTestingPassed, setFunctionalTestingPassed] = useState<boolean | null>(null)

  const [notes, setNotes] = useState('')

  // ── Categorized photos — one slot per checklist item + overall ───────────
  const [namedPhotos, setNamedPhotos] = useState<Record<InstallPhotoSlotId, File[]>>({
    cwsn_unit: [], ramp: [], braille_signage: [], braille_layout: [], tactile_tiles: [], overall: [],
  })

  // ── Joint signatures: Principal (required), Dept Rep (optional), Contractor (required) ──
  const [principalName, setPrincipalName] = useState('')
  const [principalDesignation, setPrincipalDesignation] = useState('')
  const principalSig = useRef<SignatureCanvasType | null>(null)

  const [deptRepApplicable, setDeptRepApplicable] = useState(true)
  const [deptRepName, setDeptRepName] = useState('')
  const [deptRepDesignation, setDeptRepDesignation] = useState('')
  const deptRepSig = useRef<SignatureCanvasType | null>(null)

  const [contractorName, setContractorName] = useState('')
  const contractorSig = useRef<SignatureCanvasType | null>(null)

  const [schoolSealAffixed, setSchoolSealAffixed] = useState<boolean | null>(null)

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const isSubmitting = isPending

  function setPhotosFor(slot: InstallPhotoSlotId, files: File[]) {
    setNamedPhotos((prev) => ({ ...prev, [slot]: files }))
  }

  async function uploadNamedPhotos(): Promise<Record<string, string>> {
    const supabase = createClient()
    const result: Record<string, string> = {}

    for (const { id, label } of INSTALL_PHOTO_SLOTS) {
      const file = namedPhotos[id][0]
      if (!file) continue
      setUploadProgress(`Uploading photo: ${label}…`)
      const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true })
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${loc.location_code}/install/${Date.now()}_${id}_${safeName}`
      const { error } = await supabase.storage
        .from('installation-media')
        .upload(path, compressed, { contentType: compressed.type, upsert: false })
      if (error) throw new Error(`Photo upload failed (${label}): ${error.message}`)
      result[id] = path
    }
    return result
  }

  function validate(): string | null {
    if (!installationDate) return 'Please enter the date of installation'
    const checklist: Array<[string, boolean | null]> = [
      ['CWSN Accessible Unit installed', cwsnUnitInstalled],
      ['Ramp installed', rampInstalled],
      ['Grab bars installed', grabBarsInstalled],
      ['Braille signage installed', brailleSignageInstalled],
      ['Braille layout map installed', brailleLayoutInstalled],
      ['Tactile tiles installed', tactileTilesInstalled],
      ['Plumbing connection completed', plumbingConnected],
      ['Electrical connection completed', electricalConnected],
      ['Functional testing passed', functionalTestingPassed],
    ]
    for (const [label, val] of checklist) {
      if (val === null) return `Please confirm: ${label}`
    }
    if (!namedPhotos.overall[0]) return 'Please add the overall completion photograph'
    if (!principalName.trim()) return 'Principal / Head of Institution name is required'
    if (!principalSig.current || principalSig.current.isEmpty()) return 'Principal / Head of Institution signature is required'
    if (deptRepApplicable && !deptRepName.trim()) return 'Department Representative name is required, or mark as not applicable'
    if (!contractorName.trim()) return "Contractor's authorized representative name is required"
    if (!contractorSig.current || contractorSig.current.isEmpty()) return "Contractor's authorized representative signature is required"
    if (schoolSealAffixed === null) return 'Please confirm whether the school seal was affixed'
    return null
  }

  function handleSubmit() {
    const validationError = validate()
    if (validationError) { setSubmitError(validationError); return }
    setSubmitError(null)

    startTransition(async () => {
      try {
        setUploadProgress('Uploading photos…')
        const photoPaths = await uploadNamedPhotos()

        setUploadProgress('Processing signatures…')
        const principalSignatureDataUrl = principalSig.current?.toDataURL('image/png') ?? ''
        const deptRepSignatureDataUrl = deptRepApplicable
          ? (deptRepSig.current && !deptRepSig.current.isEmpty() ? deptRepSig.current.toDataURL('image/png') : '')
          : ''
        const contractorSignatureDataUrl = contractorSig.current?.toDataURL('image/png') ?? ''

        setUploadProgress('Submitting report…')
        const result = await submitInstallationReport({
          locationId: loc.id,
          locationCode: loc.location_code,
          gpsLat: gps?.lat ?? null,
          gpsLng: gps?.lng ?? null,
          installationDate,

          cwsnUnitInstalled,
          rampInstalled,
          grabBarsInstalled,
          brailleSignageInstalled,
          brailleLayoutInstalled,
          tactileTilesInstalled,
          plumbingConnected,
          electricalConnected,
          functionalTestingPassed,
          installationNotes: notes,

          namedPhotoPaths: photoPaths,

          principalSignatureDataUrl,
          principalName: principalName.trim(),
          principalDesignation: principalDesignation.trim(),

          deptRepApplicable,
          deptRepName: deptRepApplicable ? deptRepName.trim() : '',
          deptRepDesignation: deptRepApplicable ? deptRepDesignation.trim() : '',
          deptRepSignatureDataUrl,

          contractorName: contractorName.trim(),
          contractorSignatureDataUrl,

          schoolSealAffixed,
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
        setSubmitError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.')
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

      {/* Date of installation */}
      <Card>
        <SectionTitle>Date of Installation</SectionTitle>
        <input
          type="date"
          value={installationDate}
          onChange={(e) => setInstallationDate(e.target.value)}
          disabled={isSubmitting}
          max={new Date().toISOString().split('T')[0]}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
        />
      </Card>

      {/* Installation checklist */}
      <Card>
        <SectionTitle hint="Matches the GeM Project Completion & Quality Certification">Installation Checklist</SectionTitle>
        <YesNoField label="CWSN Accessible Unit installed?" value={cwsnUnitInstalled} onChange={setCwsnUnitInstalled} disabled={isSubmitting} />
        <YesNoField label="Ramp installed?" value={rampInstalled} onChange={setRampInstalled} disabled={isSubmitting} />
        <YesNoField label="Grab bars installed?" value={grabBarsInstalled} onChange={setGrabBarsInstalled} disabled={isSubmitting} />
        <YesNoField label="Braille signage installed?" value={brailleSignageInstalled} onChange={setBrailleSignageInstalled} disabled={isSubmitting} />
        <YesNoField label="Braille layout map installed?" value={brailleLayoutInstalled} onChange={setBrailleLayoutInstalled} disabled={isSubmitting} />
        <YesNoField label="Tactile tiles installed?" value={tactileTilesInstalled} onChange={setTactileTilesInstalled} disabled={isSubmitting} />
        <YesNoField label="Plumbing connection completed?" value={plumbingConnected} onChange={setPlumbingConnected} disabled={isSubmitting} />
        <YesNoField label="Electrical connection completed?" value={electricalConnected} onChange={setElectricalConnected} disabled={isSubmitting} />
        <YesNoField label="Functional testing passed?" value={functionalTestingPassed} onChange={setFunctionalTestingPassed} disabled={isSubmitting} />
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

      {/* Photo record */}
      <Card>
        <SectionTitle hint="One photo per item — the overall completion shot is required">Photo Record</SectionTitle>
        <div className="space-y-5">
          {INSTALL_PHOTO_SLOTS.map(({ id, label }) => (
            <div key={id}>
              <p className="text-sm font-medium text-gray-800 mb-2">
                {label} {id === 'overall' && <span className="text-red-500">*</span>}
              </p>
              <PhotoUploader
                files={namedPhotos[id]}
                onChange={(files) => setPhotosFor(id, files.slice(-1))}
                disabled={isSubmitting}
                maxPhotos={1}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Joint signatures */}
      <SignatureBlock
        title="Principal / Head of Institution"
        name={principalName}
        onNameChange={setPrincipalName}
        designation={principalDesignation}
        onDesignationChange={setPrincipalDesignation}
        onReady={(inst) => { principalSig.current = inst }}
        onClear={() => principalSig.current?.clear()}
        disabled={isSubmitting}
      />

      <Card>
        <SectionTitle hint="Mark not applicable if no department representative was present">Department Representative</SectionTitle>
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setDeptRepApplicable(true)}
            disabled={isSubmitting}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all disabled:opacity-50 ${
              deptRepApplicable ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-300 text-gray-600'
            }`}
          >
            Applicable
          </button>
          <button
            type="button"
            onClick={() => setDeptRepApplicable(false)}
            disabled={isSubmitting}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all disabled:opacity-50 ${
              !deptRepApplicable ? 'bg-gray-600 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-600'
            }`}
          >
            Not Applicable
          </button>
        </div>
        {deptRepApplicable && (
          <>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={deptRepName}
                  onChange={(e) => setDeptRepName(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Full name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Designation</label>
                <input
                  type="text"
                  value={deptRepDesignation}
                  onChange={(e) => setDeptRepDesignation(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="e.g. District Education Officer"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                />
              </div>
            </div>
            <div className="border-2 border-gray-300 rounded-xl overflow-hidden bg-white" style={{ touchAction: 'none' }}>
              <SignaturePadWidget onReady={(inst) => { deptRepSig.current = inst }} />
            </div>
            <button
              type="button"
              onClick={() => deptRepSig.current?.clear()}
              disabled={isSubmitting}
              className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline disabled:opacity-50"
            >
              Clear signature
            </button>
          </>
        )}
      </Card>

      <SignatureBlock
        title="Authorized Representative of Contractor"
        name={contractorName}
        onNameChange={setContractorName}
        onReady={(inst) => { contractorSig.current = inst }}
        onClear={() => contractorSig.current?.clear()}
        disabled={isSubmitting}
      />

      {/* School seal */}
      <Card>
        <SectionTitle>School Seal</SectionTitle>
        <YesNoField label="School seal affixed on the certificate?" value={schoolSealAffixed} onChange={setSchoolSealAffixed} disabled={isSubmitting} />
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
