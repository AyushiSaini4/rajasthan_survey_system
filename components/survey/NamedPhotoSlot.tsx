'use client'

import { useRef } from 'react'

interface Props {
  label: string
  index: number
  file: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
}

/**
 * NamedPhotoSlot — a single mandatory, labeled photo capture used for
 * Section 15's fixed 10-angle shot list (Main Gate, School Board, etc.).
 * Unlike the generic PhotoUploader, each slot maps to exactly one required
 * field id, so the survey record can store `{ slotId: storagePath }`
 * instead of an unordered array.
 */
export default function NamedPhotoSlot({ label, index, file, onChange, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    onChange(selected)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />

      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="w-full aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5" width={20} height={20} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-[10px] font-medium text-center leading-tight px-1">{`${index}. ${label}`}</span>
        </button>
      ) : (
        <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-green-300">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={URL.createObjectURL(file)} alt={label} className="w-full h-full object-cover" />
          <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1 py-0.5 leading-tight text-center">
            {`${index}. ${label}`}
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label={`Remove ${label} photo`}
              className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center"
              style={{ width: 20, height: 20 }}
            >
              <svg className="w-3 h-3 text-white" width={12} height={12} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
