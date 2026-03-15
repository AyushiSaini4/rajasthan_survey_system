'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  approveInstallationReport,
  rejectInstallationReport,
} from '@/app/verifier/report/[reportId]/actions'

interface Props {
  reportId: string
  currentStatus: string
}

export default function VerificationForm({ reportId, currentStatus }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [verifierNotes, setVerifierNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [doneAction, setDoneAction] = useState<'approve' | 'reject' | null>(null)

  if (currentStatus === 'approved') {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium">
        ✓ This report has already been approved. Location is now closed.
      </div>
    )
  }

  if (currentStatus === 'rejected') {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
        ✗ This report was rejected. The field agent has been asked to resubmit.
      </div>
    )
  }

  if (done) {
    return (
      <div className={`rounded-xl px-4 py-4 text-sm font-medium text-center ${
        doneAction === 'approve'
          ? 'bg-green-50 border border-green-200 text-green-700'
          : 'bg-red-50 border border-red-200 text-red-700'
      }`}>
        {doneAction === 'approve'
          ? '✓ Report approved. Location is now closed and final payment tranche unlocked.'
          : '✗ Report rejected. Field agent will be asked to resubmit.'}
      </div>
    )
  }

  function handleAction() {
    if (!action) return
    if (action === 'reject' && !rejectionReason.trim()) {
      setError('Rejection reason is required')
      return
    }
    setError(null)

    startTransition(async () => {
      const result =
        action === 'approve'
          ? await approveInstallationReport(reportId, verifierNotes)
          : await rejectInstallationReport(reportId, rejectionReason, verifierNotes)

      if (result.success) {
        setDoneAction(action)
        setDone(true)
        setTimeout(() => router.push('/verifier/dashboard'), 3000)
      } else {
        setError(result.error ?? 'Operation failed. Please try again.')
      }
    })
  }

  return (
    <div className="space-y-4">

      {/* Verifier notes (applies to both approve and reject) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Verification notes <span className="text-gray-400 font-normal">(optional for approve, recommended for reject)</span>
        </label>
        <textarea
          value={verifierNotes}
          onChange={(e) => setVerifierNotes(e.target.value)}
          disabled={isPending}
          rows={3}
          placeholder="Observations, conditions found, any notes…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 resize-none"
        />
      </div>

      {/* Rejection reason — shown when reject is selected */}
      {action === 'reject' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Rejection reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            disabled={isPending}
            rows={2}
            placeholder="Specify what needs to be corrected before re-submission…"
            className="w-full rounded-lg border border-red-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 resize-none"
            autoFocus
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Buttons */}
      {!action ? (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setAction('approve')}
            className="flex-1 py-3 px-4 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors"
          >
            ✓ Approve
          </button>
          <button
            type="button"
            onClick={() => setAction('reject')}
            className="flex-1 py-3 px-4 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors"
          >
            ✗ Reject
          </button>
        </div>
      ) : (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleAction}
            disabled={isPending}
            className={`flex-1 py-3 px-4 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors ${
              action === 'approve'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isPending
              ? 'Processing…'
              : action === 'approve'
              ? 'Confirm Approval'
              : 'Confirm Rejection'}
          </button>
          <button
            type="button"
            onClick={() => { setAction(null); setRejectionReason(''); setError(null) }}
            disabled={isPending}
            className="px-4 py-3 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
