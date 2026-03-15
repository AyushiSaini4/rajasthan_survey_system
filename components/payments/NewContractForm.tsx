'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createPaymentContract } from '@/app/admin/payments/new/actions'
import type { Location } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(v: number): string {
  if (!v || isNaN(v)) return '₹0'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v)
}

// ─── Default tranche split ─────────────────────────────────────────────────────

const DEFAULT_TRANCHES = [
  { name: 'Advance' as const, trigger: 'manual' as const, pct: 25 },
  { name: 'On QC Pass' as const, trigger: 'qc_passed' as const, pct: 35 },
  { name: 'On Delivery' as const, trigger: 'delivered' as const, pct: 20 },
  { name: 'On Verification' as const, trigger: 'verified' as const, pct: 20 },
]

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual (admin releases)',
  qc_passed: 'Auto — when QC passes',
  delivered: 'Auto — when goods delivered',
  verified: 'Auto — when installation verified',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  locations: Pick<Location, 'id' | 'location_code' | 'name'>[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewContractForm({ locations }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [supplierName, setSupplierName] = useState('')
  const [totalValue, setTotalValue] = useState('')
  const [locationId, setLocationId] = useState('')
  const [notes, setNotes] = useState('')
  const [tranches, setTranches] = useState(DEFAULT_TRANCHES.map((t) => ({ ...t })))
  const [error, setError] = useState<string | null>(null)

  const totalValueNum = parseFloat(totalValue) || 0
  const trancheTotal = tranches.reduce((sum, t) => sum + t.pct, 0)
  const trancheTotalOk = Math.abs(trancheTotal - 100) < 0.01

  function updatePct(idx: number, val: string) {
    const num = Math.max(0, Math.min(100, parseFloat(val) || 0))
    setTranches((prev) => prev.map((t, i) => (i === idx ? { ...t, pct: num } : t)))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!supplierName.trim()) { setError('Supplier name is required'); return }
    if (!totalValueNum || totalValueNum <= 0) { setError('Total contract value must be greater than 0'); return }
    if (!trancheTotalOk) { setError(`Tranche percentages must add up to 100% (currently ${trancheTotal.toFixed(1)}%)`); return }

    startTransition(async () => {
      const result = await createPaymentContract({
        supplierName,
        totalValue: totalValueNum,
        locationId: locationId || null,
        notes,
        tranches: tranches.map((t) => ({
          name: t.name,
          trigger: t.trigger,
          percentage: t.pct,
        })),
      })

      if (result.success && result.contractId) {
        router.push(`/admin/payments/${result.contractId}?created=1`)
      } else {
        setError(result.error ?? 'Something went wrong. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Contract details ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Contract Details</h2>

        {/* Supplier name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Supplier name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            disabled={isPending}
            placeholder="e.g. XYZ Raw Materials Pvt Ltd"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        {/* Total contract value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Total contract value (₹) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
            <input
              type="number"
              value={totalValue}
              onChange={(e) => setTotalValue(e.target.value)}
              disabled={isPending}
              placeholder="0"
              min="1"
              step="1"
              className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
          {totalValueNum > 0 && (
            <p className="mt-1 text-xs text-gray-400">{fmtINR(totalValueNum)}</p>
          )}
        </div>

        {/* Location (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Location <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            disabled={isPending}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 bg-white"
          >
            <option value="">— Not linked to a specific location —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.location_code}{l.name ? ` — ${l.name}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isPending}
            rows={3}
            placeholder="Any additional notes about this contract…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
          />
        </div>
      </div>

      {/* ── Tranche percentages ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Payment Tranches</h2>
          <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${
            trancheTotalOk
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}>
            Total: {trancheTotal.toFixed(1)}%
          </span>
        </div>

        <div className="space-y-4">
          {tranches.map((t, idx) => {
            const amount = totalValueNum > 0 ? (totalValueNum * t.pct) / 100 : 0
            return (
              <div key={t.name} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{TRIGGER_LABELS[t.trigger]}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="relative w-24">
                    <input
                      type="number"
                      value={t.pct}
                      onChange={(e) => updatePct(idx, e.target.value)}
                      disabled={isPending}
                      min="0"
                      max="100"
                      step="0.5"
                      className="w-full pr-5 pl-2 py-2 rounded-lg border border-gray-300 text-sm text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                  {amount > 0 && (
                    <span className="text-xs text-gray-500 w-24 text-right">{fmtINR(amount)}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {!trancheTotalOk && trancheTotal > 0 && (
          <p className="mt-3 text-xs text-red-600">
            Percentages add up to {trancheTotal.toFixed(1)}% — adjust them to reach exactly 100%.
          </p>
        )}
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Creating…' : 'Create Contract'}
        </button>
        <a
          href="/admin/payments"
          className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </a>
      </div>
    </form>
  )
}
