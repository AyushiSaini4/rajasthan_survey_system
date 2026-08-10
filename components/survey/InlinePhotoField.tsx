'use client'

import PhotoUploader from '@/components/survey/PhotoUploader'
import GPSCapture, { type GPSCoords } from '@/components/survey/GPSCapture'

interface Props {
  label: string
  files: File[]
  onChange: (files: File[]) => void
  maxPhotos?: number
  disabled?: boolean
  required?: boolean
  /** When set, renders a GPS auto-capture widget above the photo picker. */
  gps?: {
    captured: GPSCoords | null
    onCapture: (coords: GPSCoords) => void
  }
}

/**
 * InlinePhotoField — a questionnaire 'photo' field rendered inline, in the
 * middle of Section 2, rather than in the fixed end-of-form photo grid.
 *
 * QuestionnaireField.type === 'photo' fields never go through the generic
 * QuestionnaireFieldInput (their value isn't a string/boolean/number — it's
 * one or more File objects), so SurveyFormClient renders this directly
 * wherever a 'photo' field appears in the section's field list.
 */
export default function InlinePhotoField({
  label, files, onChange, maxPhotos = 1, disabled = false, required = false, gps,
}: Props) {
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <p className="text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </p>
      {gps && (
        <div className="mb-3">
          <GPSCapture onCapture={gps.onCapture} captured={gps.captured} />
        </div>
      )}
      <PhotoUploader files={files} onChange={onChange} disabled={disabled} maxPhotos={maxPhotos} />
    </div>
  )
}
