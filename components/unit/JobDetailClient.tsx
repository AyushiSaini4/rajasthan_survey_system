'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ProductionJobWithLocation } from '@/lib/supabase/unit'
import {
  saveJobProgress,
  startProduction,
  markProductionComplete,
  markDispatched,
} from '@/app/unit/job/actions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(status: string): string {
  switch (status) {
    case 'pending':       return 'Pending'
    case 'in_production': return 'In Production'
    case 'complete':      return 'Complete — Awaiting QC'
    case 'qc_passed':     return 'QC Passed — Ready to Dispatch'
    case 'qc_failed':     return 'QC Failed — Rework Required'
    case 'dispatched':    return 'Dispatched'
    default:              return status
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'pending':       return 'bg-gray-100 text-gray-700 border-gray-300'
    case 'in_production': return 'bg-blue-100 text-blue-700 border-blue-300'
    case 'complete':      return 'bg-yellow-100 text-yellow-700 border-yellow-300'
    case 'qc_passed':     return 'bg-green-100 text-green-700 border-green-300'
    case 'qc_failed':     return 'bg-red-100 text-red-700 border-red-300'
    case 'dispatched':    return 'bg-purple-100 text-purple-700 border-purple-300'
    default:              return 'bg-gray-100 text-gray-700 border-gray-300'
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-5 ${className}`}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
      {children}
    </h2>
  )
}

function QuantityRow({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900">
        {value.toLocaleString()} {unit}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  job: ProductionJobWithLocation
}

export default function JobDetailClient({ job }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Local state mirrors server values until a save succeeds
  const [progress, setProgress] = useState<number>(job.progress_pct ?? 0)
  const [notes, setNotes] = useState<string>(job.production_notes ?? '')

  // Feedback state
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Defensive: location can be null if the locations row is missing
  const loc = job.location
  const isTerminal = ['qc_passed', 'qc_failed', 'dispatched'].includes(job.status)

  // ── Save progress ──────────────────────────────────────────────────────────
  function handleSaveProgress() {
    setSaveMsg(null)
    startTransition(async () => {
      const result = await saveJobProgress(job.id, progress, notes)
      if (result.success) {
        setSaveMsg({ type: 'success', text: 'Progress saved.' })
        router.refresh()
      } else {
        setSaveMsg({ type: 'error', text: result.error ?? 'Save failed.' })
      }
    })
  }

  // ── Start production ───────────────────────────────────────────────────────
  function handleStartProduction() {
    setActionMsg(null)
    startTransition(async () => {
      const result = await startProduction(job.id)
      if (result.success) {
        setActionMsg({ type: 'success', text: 'Production started.' })
        router.refresh()
      } else {
        setActionMsg({ type: 'error', text: result.error ?? 'Action failed.' })
      }
    })
  }

  // ── Mark complete ──────────────────────────────────────────────────────────
  function handleMarkComplete() {
    setActionMsg(null)
    startTransition(async () => {
      const result = await markProductionComplete(job.id)
      if (result.success) {
        setActionMsg({ type: 'success', text: 'Marked as complete. QC inspector will be notified.' })
        router.refresh()
      } else {
        setActionMsg({ type: 'error', text: result.error ?? 'Action failed.' })
      }
    })
  }

  // ── Mark dispatched ────────────────────────────────────────────────────────
  function handleMarkDispatched() {
    setActionMsg(null)
    startTransition(async () => {
      const result = await markDispatched(job.id)
      if (result.success) {
        setActionMsg({ type: 'success', text: 'Goods marked as dispatched.' })
        router.refresh()
      } else {
        setActionMsg({ type: 'error', text: result.error ?? 'Action failed.' })
      }
    })
  }

  return (
    <div className="space-y-4">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-mono text-gray-400 mb-0.5">
            {loc?.location_code ?? 'Unknown location'}
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {loc?.name ?? loc?.location_code ?? 'Location unavailable'}
          </h1>
          {loc && (loc.district || loc.block || loc.village) && (
            <p className="text-sm text-gray-500 mt-0.5">
              {[loc.village, loc.block, loc.district].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border flex-shrink-0 mt-1 ${statusBadgeClass(job.status)}`}
        >
          {statusLabel(job.status)}
        </span>
      </div>

      {/* ── Quantities to produce ─────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Quantities to Produce</SectionTitle>
        <div>
          <QuantityRow label="Tiles" value={job.qty_tiles} unit="sq ft" />
          <QuantityRow label="Toilet units" value={job.qty_toilet_units} unit="units" />
          <QuantityRow label="Ramp units" value={job.qty_ramp_units} unit="units" />
          <QuantityRow label="Fitting sets" value={job.qty_fittings} unit="sets" />
          {job.qty_other && Object.entries(job.qty_other).map(([key, val]) => (
            <QuantityRow key={key} label={key} value={val} unit="units" />
          ))}
          {!job.qty_tiles && !job.qty_toilet_units && !job.qty_ramp_units && !job.qty_fittings && (
            <p className="text-sm text-gray-400 py-2">No quantities recorded for this job.</p>
          )}
        </div>

        {/* Assigned date */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Assigned on{' '}
            {new Date(job.assigned_at).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </p>
          {job.completed_at && (
            <p className="text-xs text-gray-400 mt-0.5">
              Completed on{' '}
              {new Date(job.completed_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
          )}
          {job.dispatched_at && (
            <p className="text-xs text-gray-400 mt-0.5">
              Dispatched on{' '}
              {new Date(job.dispatched_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
          )}
        </div>
      </Card>

      {/* ── Progress + notes ──────────────────────────────────────────────── */}
      {!isTerminal && job.status !== 'complete' && (
        <Card>
          <SectionTitle>Production Progress</SectionTitle>

          {/* Progress bar visual */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-gray-600">Current progress</span>
              <span className="text-sm font-bold text-gray-900">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-orange-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Slider — 10% increments */}
          <div className="mb-4">
            <label htmlFor="progress-slider" className="block text-sm text-gray-600 mb-2">
              Update progress (drag or tap)
            </label>
            <input
              id="progress-slider"
              type="range"
              min={0}
              max={100}
              step={10}
              value={progress}
              onChange={(e) => {
                setProgress(Number(e.target.value))
                setSaveMsg(null)
              }}
              disabled={isPending}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {/* Tick marks */}
            <div className="flex justify-between mt-1">
              {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => (
                <span
                  key={v}
                  className={`text-xs ${v === progress ? 'text-orange-600 font-semibold' : 'text-gray-400'}`}
                  style={{ width: '9%', textAlign: 'center' }}
                >
                  {v === 0 || v === 50 || v === 100 ? v : ''}
                </span>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label htmlFor="production-notes" className="block text-sm text-gray-600 mb-1.5">
              Production notes (optional)
            </label>
            <textarea
              id="production-notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value)
                setSaveMsg(null)
              }}
              disabled={isPending}
              rows={3}
              placeholder="Any notes about materials, delays, issues..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50 resize-none"
            />
          </div>

          {/* Save feedback */}
          {saveMsg && (
            <div
              className={`mb-3 px-3 py-2 rounded-md text-sm ${
                saveMsg.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {saveMsg.text}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSaveProgress}
            disabled={isPending}
            className="w-full py-2.5 px-4 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Saving…' : 'Save Progress'}
          </button>
        </Card>
      )}

      {/* ── Read-only notes (for terminal/complete states) ─────────────────── */}
      {(isTerminal || job.status === 'complete') && job.production_notes && (
        <Card>
          <SectionTitle>Production Notes</SectionTitle>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.production_notes}</p>
        </Card>
      )}

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      <Card>
        <SectionTitle>Actions</SectionTitle>

        {/* Action feedback */}
        {actionMsg && (
          <div
            className={`mb-3 px-3 py-2 rounded-md text-sm ${
              actionMsg.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {actionMsg.text}
          </div>
        )}

        <div className="space-y-2">

          {/* Start Production — only when pending */}
          {job.status === 'pending' && (
            <button
              onClick={handleStartProduction}
              disabled={isPending}
              className="w-full py-3 px-4 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Starting…' : '▶ Start Production'}
            </button>
          )}

          {/* Mark Complete — only when in_production */}
          {job.status === 'in_production' && (
            <button
              onClick={handleMarkComplete}
              disabled={isPending}
              className="w-full py-3 px-4 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Marking complete…' : '✓ Mark Production Complete'}
            </button>
          )}

          {/* Mark Dispatched — only when qc_passed */}
          {job.status === 'qc_passed' && (
            <button
              onClick={handleMarkDispatched}
              disabled={isPending}
              className="w-full py-3 px-4 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Marking dispatched…' : '🚚 Mark as Dispatched'}
            </button>
          )}

          {/* Terminal states — read only info */}
          {job.status === 'complete' && (
            <div className="text-center py-3 px-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-semibold text-yellow-800">Awaiting QC Inspection</p>
              <p className="text-xs text-yellow-600 mt-0.5">
                A QC inspector will review the goods and mark pass or fail.
              </p>
            </div>
          )}

          {job.status === 'qc_failed' && (
            <div className="text-center py-3 px-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-semibold text-red-800">QC Failed — Rework Required</p>
              <p className="text-xs text-red-600 mt-0.5">
                Fix the issues noted in the QC report, then contact your QC inspector for re-inspection.
              </p>
            </div>
          )}

          {job.status === 'dispatched' && (
            <div className="text-center py-3 px-4 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm font-semibold text-purple-800">Goods Dispatched</p>
              <p className="text-xs text-purple-600 mt-0.5">
                Goods have been dispatched to the site. Awaiting field agent delivery confirmation.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* ── Back link ─────────────────────────────────────────────────────── */}
      <div className="pb-4">
        <a
          href="/unit/dashboard"
          className="text-sm text-orange-600 hover:text-orange-700 font-medium"
        >
          ← Back to production queue
        </a>
      </div>
    </div>
  )
}
