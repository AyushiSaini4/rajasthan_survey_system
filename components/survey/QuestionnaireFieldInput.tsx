'use client'

import type { QuestionnaireField, AnswerValue } from '@/lib/survey/questionnaire'

interface Props {
  field: QuestionnaireField
  value: AnswerValue
  onChange: (value: AnswerValue) => void
  disabled?: boolean
}

/**
 * QuestionnaireFieldInput — renders the correct control for a single
 * questionnaire field based on its `type`. Driven entirely by
 * lib/survey/questionnaire.ts so adding/editing questions never requires
 * touching this component.
 */
export default function QuestionnaireFieldInput({ field, value, onChange, disabled = false }: Props) {
  const labelNode = (
    <p className="text-sm font-medium text-gray-700 mb-1.5">
      {field.label}
      {field.required && <span className="text-red-500 ml-0.5">*</span>}
    </p>
  )

  if (field.type === 'yesno') {
    const boolVal = value === true ? true : value === false ? false : null
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(true)}
            className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
              boolVal === true
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
              boolVal === false
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

  if (field.type === 'dropdown') {
    return (
      <div>
        {labelNode}
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50"
        >
          <option value="">Select…</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (field.type === 'number') {
    return (
      <div>
        {labelNode}
        <input
          type="number"
          inputMode="decimal"
          value={typeof value === 'number' ? value : value === null ? '' : String(value ?? '')}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          disabled={disabled}
          placeholder={field.placeholder ?? '0'}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50"
        />
      </div>
    )
  }

  if (field.type === 'date') {
    return (
      <div>
        {labelNode}
        <input
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50"
        />
      </div>
    )
  }

  // 'text' — default
  return (
    <div>
      {labelNode}
      <input
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={field.placeholder}
        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50"
      />
    </div>
  )
}
