'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateProductionJobQuantities, type AssignQuantities } from '@/app/admin/location/[id]/actions'
import type { ProductionJob } from '@/types'

interface EditProductionQuantitiesProps {
  job: ProductionJob
}

// Canonical material list — matches the GeM Project Completion & Quality
// Certification's item list exactly (minus Plumbing/Electrical Connection,
// which aren't manufactured items — those are on-site installation tasks
// captured on the field agent's installation report instead).
const MATERIAL_ITEMS: Array<{
  key: 'qtyToiletUnits' | 'qtyRampUnits' | 'qtyFittings' | 'qtyTiles' | 'brailleSignage' | 'brailleLayout'
  label: string
  unit: string
}> = [
  { key: 'qtyToiletUnits', label: 'CWSN Accessible Unit', unit: 'units' },
  { key: 'qtyRampUnits', label: 'Ramp', unit: 'units' },
  { key: 'qtyFittings', label: 'Grab Bars', unit: 'units' },
  { key: 'qtyTiles', label: 'Tactile Tiles', unit: 'sq ft' },
  { key: 'brailleSignage', label: 'Braille Signage', unit: 'units' },
  { key: 'brailleLayout', label: 'Braille Layout Map', unit: 'units' },
]

function toNumOrNull(v: string): number | null {
  const trimmed = v.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

export default function EditProductionQuantities({ job }: EditProductionQuantitiesProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const qtyOther = (job.qty_other ?? {}) as Record<string, number>

  const [values, setValues] = useState<Record<string, string>>({
    qtyToiletUnits: job.qty_toilet_units != null ? String(job.qty_toilet_units) : '',
    qtyRampUnits: job.qty_ramp_units != null ? String(job.qty_ramp_units) : '',
    qtyFittings: job.qty_fittings != null ? String(job.qty_fittings) : '',
    qtyTiles: job.qty_tiles != null ? String(job.qty_tiles) : '',
    brailleSignage: qtyOther.braille_signage != null ? String(qtyOther.braille_signage) : '',
    brailleLayout: qtyOther.braille_layout_plan != null ? String(qtyOther.braille_layout_plan) : '',
  })

  function setVal(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  async function handleSave() {
    setLoading(true)
    setError(null)

    const otherEntries: Record<string, number> = {}
    const signageNum = toNumOrNull(values.brailleSignage)
    const layoutNum = toNumOrNull(values.brailleLayout)
    if (signageNum !== null) otherEntries.braille_signage = signageNum
    if (layoutNum !== null) otherEntries.braille_layout_plan = layoutNum

    const payload: AssignQuantities = {
      qtyToiletUnits: toNumOrNull(values.qtyToiletUnits),
      qtyRampUnits: toNumOrNull(values.qtyRampUnits),
      qtyFittings: toNumOrNull(values.qtyFittings),
      qtyTiles: toNumOrNull(values.qtyTiles),
      qtyOther: Object.keys(otherEntries).length > 0 ? otherEntries : null,
    }

    const result = await updateProductionJobQuantities(job.id, payload)
    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Failed to save. Please try again.')
      return
    }

    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Materials to Produce</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          {MATERIAL_ITEMS.map((item) => (
            <div key={item.key}>
              <label htmlFor={`qty-${item.key}`} className="block text-xs font-medium text-gray-500 mb-1">
                {item.label} <span className="text-gray-400">({item.unit})</span>
              </label>
              <input
                id={`qty-${item.key}`}
                type="number"
                min={0}
                value={values[item.key]}
                onChange={(e) => setVal(item.key, e.target.value)}
                disabled={loading}
                placeholder="0"
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          ))}
        </div>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save Quantities'}
          </button>
          <button
            onClick={() => { setEditing(false); setError(null) }}
            disabled={loading}
            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Materials to Produce</h3>
        <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:text-blue-800 font-medium print:hidden">
          Edit
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {MATERIAL_ITEMS.map((item) => {
          let value: number | null = null
          if (item.key === 'qtyToiletUnits') value = job.qty_toilet_units
          else if (item.key === 'qtyRampUnits') value = job.qty_ramp_units
          else if (item.key === 'qtyFittings') value = job.qty_fittings
          else if (item.key === 'qtyTiles') value = job.qty_tiles
          else if (item.key === 'brailleSignage') value = qtyOther.braille_signage ?? null
          else if (item.key === 'brailleLayout') value = qtyOther.braille_layout_plan ?? null

          const needed = value != null && value > 0
          return (
            <div
              key={item.key}
              className={`rounded-lg p-3 text-center border ${needed ? 'bg-gray-50 border-gray-200' : 'bg-gray-50/50 border-gray-100'}`}
            >
              <p className={`text-2xl font-bold ${needed ? 'text-gray-900' : 'text-gray-300'}`}>{value ?? '—'}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
              <p className={`text-[10px] mt-1 font-medium ${needed ? 'text-green-600' : 'text-gray-400'}`}>
                {needed ? 'Needed' : 'Not needed'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
