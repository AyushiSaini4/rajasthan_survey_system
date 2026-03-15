'use client'

import { useRef } from 'react'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Currently selected File objects (controlled by parent). */
  files: File[]
  /** Called when the file list changes (add or remove). */
  onChange: (files: File[]) => void
  /** Disables all interactions — used during form submission. */
  disabled?: boolean
  /** Maximum number of photos allowed. Default: 10. */
  maxPhotos?: number
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * PhotoUploader — multi-photo selector with thumbnail preview.
 *
 * Does NOT upload to storage itself. The parent (SurveyFormClient) handles
 * compression via browser-image-compression and uploads during form submission,
 * so photos are never sent unless the user explicitly submits.
 *
 * Accepts any image format the browser supports (JPEG, PNG, HEIC on iOS, etc).
 * On Android/iOS the system camera and gallery both appear in the file picker.
 */
export default function PhotoUploader({
  files,
  onChange,
  disabled = false,
  maxPhotos = 10,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return

    // Deduplicate by name + size to avoid adding the same file twice
    const existing = new Set(files.map((f) => `${f.name}-${f.size}`))
    const newFiles  = selected.filter((f) => !existing.has(`${f.name}-${f.size}`))
    const combined  = [...files, ...newFiles].slice(0, maxPhotos)

    onChange(combined)

    // Reset the input so selecting the same file again triggers onChange
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeFile(index: number) {
    onChange(files.filter((_, i) => i !== index))
  }

  const canAddMore = files.length < maxPhotos && !disabled

  return (
    <div>
      {/* ── Thumbnail grid ─────────────────────────────────────────────── */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${file.size}-${i}`}
              className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(file)}
                alt={`Photo ${i + 1}`}
                className="w-full h-full object-cover"
              />

              {/* Remove button */}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                  style={{ width: 20, height: 20 }}
                >
                  <svg
                    className="w-3 h-3 text-white"
                    width={12}
                    height={12}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}

              {/* Index badge */}
              <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs rounded px-1 leading-tight">
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Add photos button ──────────────────────────────────────────── */}
      {canAddMore && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 active:bg-blue-100 transition-colors"
          >
            <svg
              className="w-5 h-5"
              width={20}
              height={20}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {files.length === 0
              ? 'Add Photos'
              : `Add More (${files.length} / ${maxPhotos})`}
          </button>
        </>
      )}

      {/* At limit */}
      {!canAddMore && !disabled && (
        <p className="text-xs text-gray-400 text-center py-1">
          Maximum {maxPhotos} photos reached
        </p>
      )}

      {/* Disabled with no photos */}
      {disabled && files.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-2">No photos added</p>
      )}
    </div>
  )
}
