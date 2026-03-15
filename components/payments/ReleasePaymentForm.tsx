'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { releaseTranche } from '@/app/admin/payments/[contractId]/actions'
import type { PaymentTranche } from '@/types'

interface Props {
  tranche: PaymentTranche
}

function fmtINR(v: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v)
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual',
  qc_passed: 'On QC Pass',
  delivered: 'On Delivery',
  verified: 'On Verification',
}

const STATUS_STYLES: Record<string, string> = {
  locked: 'bg-gray-100 text-gray-500',
  unlocked: 'bg-amber-100 text-amber-700',
  released: 'bg-green-100 text-green-700',
}

export default function ReleasePaymentForm({ tranche }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isManual = tranche.trigger_milestone === 'manual'
  const canRelease =
    tranche.status === 'unlocked' || (isManual && tranche.status === 'locked')

  function handleRelease() {
    if (!reference.trim()) { setError('Payment reference is required'); return }
    setError(null)

    startTransition(async () => {
      const result = await releaseTranche(tranche.id, reference)
      if (result.success) {
        setShowForm(false)
        setReference('')
        router.refresh()
      } else {
        setError(result.error ?? 'Release failed')
      }
    })
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      {/* Left — tranche info */}
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1">
        <div>
          <p className="text-xs text-gray-400">Tranche</p>
          <p className="text-sm font-semibold text-gray-900">{tranche.tranche_name}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Trigger</p>
          <p className="text-sm text-gray-700">{TRIGGER_LABELS[tranche.trigger_milestone] ?? tranche.trigger_milestone}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Amount</p>
          <p className="text-sm font-semibold text-gray-900">
            {fmtINR(tranche.amount)}
            <span className="text-gray-400 font-normal ml-1">({tranche.percentage}%)</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Status</p>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[tranche.status]}`}>
            {tranche.status}
          </span>
        </div>
      </div>

      {/* Right — action */}
      <div className="flex-shrink-0">
        {tranche.status === 'released' ? (
          /* Released — show reference + date */
          <div className="text-right">
            <p className="text-xs font-mono text-gray-500">{tranche.payment_reference}</p>
            {tranche.released_at && (
              <p className="text-xs text-gray-400 mt-0.5">Released {fmtDate(tranche.released_at)}</p>
            )}
          </div>
        ) : canRelease ? (
          /* Unlocked or manual-advance — show release form */
          <div className="w-full sm:w-72">
            {!showForm ? (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className={`w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  tranche.status === 'unlocked'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}
              >
                {isManual && tranche.status === 'locked' ? 'Release Advance' : 'Release Payment'}
              </button>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-700">Enter payment reference</p>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  disabled={isPending}
                  placeholder="e.g. NEFT/2025/00412"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  autoFocus
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRelease}
                    disabled={isPending}
                    className="flex-1 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {isPending ? 'Releasing…' : 'Confirm Release'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setReference(''); setError(null) }}
                    disabled={isPending}
                    className="px-3 py-2 bg-white border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Locked — waiting for milestone */
          <p className="text-xs text-gray-400 italic">
            {tranche.status === 'locked' ? 'Locked — awaiting milestone' : ''}
          </p>
        )}
      </div>
    </div>
  )
}
