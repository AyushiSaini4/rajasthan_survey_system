import type { LocationStatus } from '@/types'

// ─── Phase definitions ────────────────────────────────────────────────────────
// Each phase maps to one or more status values.
// The timeline renders as a horizontal strip of steps.

interface Phase {
  label: string
  statuses: LocationStatus[]
}

const PHASES: Phase[] = [
  { label: 'Survey',      statuses: ['surveyed'] },
  { label: 'Assigned',    statuses: ['assigned'] },
  { label: 'Production',  statuses: ['in_production'] },
  { label: 'QC',          statuses: ['qc_passed', 'qc_failed'] },
  { label: 'Dispatched',  statuses: ['dispatched'] },
  { label: 'Delivered',   statuses: ['delivered'] },
  { label: 'Installed',   statuses: ['installed'] },
  { label: 'Verified',    statuses: ['verified', 'closed'] },
]

// A "completed" phase is any phase whose statuses come before the current status
// in the overall lifecycle order.
const STATUS_ORDER: LocationStatus[] = [
  'pending',
  'surveyed',
  'assigned',
  'in_production',
  'qc_failed',
  'qc_passed',
  'dispatched',
  'delivered',
  'installed',
  'verified',
  'closed',
]

function phaseState(
  phase: Phase,
  currentStatus: LocationStatus
): 'completed' | 'current' | 'failed' | 'pending' {
  if (phase.statuses.includes(currentStatus)) {
    return currentStatus === 'qc_failed' ? 'failed' : 'current'
  }

  const currentIdx = STATUS_ORDER.indexOf(currentStatus)
  // Check if every status in this phase comes before the current one
  const phaseMaxIdx = Math.max(...phase.statuses.map((s) => STATUS_ORDER.indexOf(s)))
  if (phaseMaxIdx < currentIdx) return 'completed'

  return 'pending'
}

// ─── Component ────────────────────────────────────────────────────────────────

interface LocationTimelineProps {
  currentStatus: LocationStatus
}

export default function LocationTimeline({ currentStatus }: LocationTimelineProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 overflow-x-auto">
      <div className="flex items-center min-w-max">
        {PHASES.map((phase, idx) => {
          const state = phaseState(phase, currentStatus)

          return (
            <div key={phase.label} className="flex items-center">
              {/* Step */}
              <div className="flex flex-col items-center gap-1">
                {/* Circle */}
                <div
                  className={[
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2',
                    state === 'completed'
                      ? 'bg-green-500 border-green-500 text-white'
                      : state === 'current'
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : state === 'failed'
                      ? 'bg-red-500 border-red-500 text-white'
                      : 'bg-white border-gray-300 text-gray-400',
                  ].join(' ')}
                >
                  {state === 'completed' ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : state === 'failed' ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                {/* Label */}
                <span
                  className={[
                    'text-xs font-medium whitespace-nowrap',
                    state === 'completed' ? 'text-green-700' :
                    state === 'current'   ? 'text-blue-700' :
                    state === 'failed'    ? 'text-red-600' :
                    'text-gray-400',
                  ].join(' ')}
                >
                  {phase.label}
                </span>
              </div>

              {/* Connector line (except after last) */}
              {idx < PHASES.length - 1 && (
                <div
                  className={[
                    'h-0.5 w-8 mx-1 mb-4',
                    phaseState(PHASES[idx + 1], currentStatus) === 'pending'
                      ? 'bg-gray-200'
                      : 'bg-green-400',
                  ].join(' ')}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Pending note */}
      {currentStatus === 'pending' && (
        <p className="text-xs text-gray-500 mt-2">
          Awaiting field agent survey to start the workflow.
        </p>
      )}
    </div>
  )
}
