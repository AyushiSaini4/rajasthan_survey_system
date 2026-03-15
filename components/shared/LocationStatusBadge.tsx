import type { LocationStatus } from '@/types'

// ─── Status display config ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  LocationStatus,
  { label: string; className: string; dotColor: string }
> = {
  pending:       { label: 'Pending',       className: 'bg-gray-100 text-gray-700 border-gray-200',       dotColor: 'bg-gray-400' },
  surveyed:      { label: 'Surveyed',      className: 'bg-blue-100 text-blue-700 border-blue-200',       dotColor: 'bg-blue-500' },
  assigned:      { label: 'Assigned',      className: 'bg-indigo-100 text-indigo-700 border-indigo-200', dotColor: 'bg-indigo-500' },
  in_production: { label: 'In Production', className: 'bg-amber-100 text-amber-700 border-amber-200',   dotColor: 'bg-amber-500' },
  qc_failed:     { label: 'QC Failed',     className: 'bg-red-100 text-red-700 border-red-200',         dotColor: 'bg-red-500' },
  qc_passed:     { label: 'QC Passed',     className: 'bg-green-100 text-green-700 border-green-200',   dotColor: 'bg-green-500' },
  dispatched:    { label: 'Dispatched',    className: 'bg-teal-100 text-teal-700 border-teal-200',      dotColor: 'bg-teal-500' },
  delivered:     { label: 'Delivered',     className: 'bg-sky-100 text-sky-700 border-sky-200',         dotColor: 'bg-sky-500' },
  installed:     { label: 'Installed',     className: 'bg-violet-100 text-violet-700 border-violet-200',dotColor: 'bg-violet-500' },
  verified:      { label: 'Verified',      className: 'bg-emerald-100 text-emerald-700 border-emerald-200', dotColor: 'bg-emerald-500' },
  closed:        { label: 'Closed',        className: 'bg-slate-100 text-slate-600 border-slate-200',   dotColor: 'bg-slate-400' },
}

interface Props {
  status: LocationStatus
  showDot?: boolean
  size?: 'sm' | 'md'
}

export default function LocationStatusBadge({
  status,
  showDot = true,
  size = 'sm',
}: Props) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-600 border-gray-200',
    dotColor: 'bg-gray-400',
  }

  const sizeClasses = size === 'md'
    ? 'px-3 py-1 text-sm'
    : 'px-2.5 py-0.5 text-xs'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${sizeClasses} ${config.className}`}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dotColor}`} />
      )}
      {config.label}
    </span>
  )
}
