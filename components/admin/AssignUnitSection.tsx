'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignLocationToUnit, type AssignQuantities } from '@/app/admin/location/[id]/actions'
import type { ManufacturingUnit, CWSNSchool } from '@/types'

interface AssignUnitSectionProps {
  locationId: string
  activeUnits: ManufacturingUnit[]
  /** RCSE sanction record for this school, if one exists — used to pre-fill
   *  quantities below. Null for locations with no sanction match (e.g.
   *  Anganwadi Kendras), in which case the fields start blank for manual entry. */
  sanctionedSchool: CWSNSchool | null
}

interface QtyField {
  key: keyof AssignQuantities
  label: string
  unit: string
  fromSanction: number | null
}

export default function AssignUnitSection({ locationId, activeUnits, sanctionedSchool }: AssignUnitSectionProps) {
  const router = useRouter()
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const qtyFields: QtyField[] = [
    { key: 'qtyToiletUnits', label: 'Toilet Units', unit: 'units', fromSanction: sanctionedSchool?.cwsn_toilet_no ?? null },
    { key: 'qtyRampUnits', label: 'Ramp Units', unit: 'units', fromSanction: sanctionedSchool?.ramp_no ?? null },
    { key: 'qtyTiles', label: 'Tactile Tiles', unit: 'sq ft', fromSanction: sanctionedSchool?.tactile_tile_sqft ?? null },
    { key: 'qtyFittings', label: 'Grab Bars', unit: 'units', fromSanction: sanctionedSchool?.grab_bar_no ?? null },
  ]

  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(qtyFields.map((f) => [f.key, f.fromSanction != null ? String(f.fromSanction) : '']))
  )
  // Braille signage + layout plan don't have dedicated production_jobs columns —
  // captured as qty_other so the sanctioned figures aren't dropped on the floor.
  const [brailleSignage, setBrailleSignage] = useState(
    sanctionedSchool?.braille_signage_no != null ? String(sanctionedSchool.braille_signage_no) : ''
  )
  const [brailleLayout, setBrailleLayout] = useState(
    sanctionedSchool?.braille_layout_plan_no != null ? String(sanctionedSchool.braille_layout_plan_no) : ''
  )

  function setQty(key: string, value: string) {
    setQuantities((prev) => ({ ...prev, [key]: value }))
  }

  function toNumOrNull(v: string): number | null {
    const trimmed = v.trim()
    if (trimmed === '') return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }

  async function handleAssign() {
    if (!selectedUnitId) {
      setError('Please select a manufacturing unit.')
      return
    }

    setLoading(true)
    setError(null)

    const qtyOtherEntries: Record<string, number> = {}
    const brailleSignageNum = toNumOrNull(brailleSignage)
    const brailleLayoutNum = toNumOrNull(brailleLayout)
    if (brailleSignageNum !== null) qtyOtherEntries.braille_signage = brailleSignageNum
    if (brailleLayoutNum !== null) qtyOtherEntries.braille_layout_plan = brailleLayoutNum

    const payload: AssignQuantities = {
      qtyToiletUnits: toNumOrNull(quantities.qtyToiletUnits),
      qtyRampUnits: toNumOrNull(quantities.qtyRampUnits),
      qtyTiles: toNumOrNull(quantities.qtyTiles),
      qtyFittings: toNumOrNull(quantities.qtyFittings),
      qtyOther: Object.keys(qtyOtherEntries).length > 0 ? qtyOtherEntries : null,
    }

    const result = await assignLocationToUnit(locationId, selectedUnitId, payload)

    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Assignment failed. Please try again.')
      return
    }

    setSuccess(true)
    router.refresh()
  }

  if (success) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Location assigned successfully. Production job created.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {activeUnits.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No active manufacturing units found.</p>
      ) : (
        <>
          {sanctionedSchool ? (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              Quantities pre-filled from the RCSE sanction record (₹{sanctionedSchool.sanction_amount_lacs ?? '—'} lacs). Edit if needed before assigning.
            </p>
          ) : (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No sanctioned school record found for this location — enter quantities manually below.
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {qtyFields.map((f) => (
              <div key={f.key}>
                <label htmlFor={f.key} className="block text-xs font-medium text-gray-500 mb-1">
                  {f.label} <span className="text-gray-400">({f.unit})</span>
                </label>
                <input
                  id={f.key}
                  type="number"
                  min={0}
                  value={quantities[f.key]}
                  onChange={(e) => setQty(f.key, e.target.value)}
                  disabled={loading}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            ))}
            <div>
              <label htmlFor="braille-signage" className="block text-xs font-medium text-gray-500 mb-1">
                Braille Signage <span className="text-gray-400">(units)</span>
              </label>
              <input
                id="braille-signage"
                type="number"
                min={0}
                value={brailleSignage}
                onChange={(e) => setBrailleSignage(e.target.value)}
                disabled={loading}
                placeholder="0"
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div>
              <label htmlFor="braille-layout" className="block text-xs font-medium text-gray-500 mb-1">
                Braille Layout Plan <span className="text-gray-400">(units)</span>
              </label>
              <input
                id="braille-layout"
                type="number"
                min={0}
                value={brailleLayout}
                onChange={(e) => setBrailleLayout(e.target.value)}
                disabled={loading}
                placeholder="0"
                className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>

          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-48">
              <label htmlFor="unit-select" className="block text-sm font-medium text-gray-700 mb-1">
                Select Manufacturing Unit
              </label>
              <select
                id="unit-select"
                value={selectedUnitId}
                onChange={(e) => {
                  setSelectedUnitId(e.target.value)
                  setError(null)
                }}
                disabled={loading}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">— Choose a unit —</option>
                {activeUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                    {unit.district ? ` (${unit.district})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleAssign}
              disabled={loading || !selectedUnitId}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md
                         hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                         transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Assigning…
                </span>
              ) : (
                'Assign to Unit'
              )}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
              </svg>
              {error}
            </p>
          )}

          {selectedUnitId && !error && (
            <p className="text-xs text-gray-500">
              This will create a production job with the quantities above and change the location status to{' '}
              <strong>Assigned</strong>.
            </p>
          )}
        </>
      )}
    </div>
  )
}
