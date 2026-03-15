import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserWithRole } from '@/lib/supabase/auth'
import { getAllContracts, type ContractWithLocation } from '@/lib/supabase/payments'
import type { PaymentTranche } from '@/types'

export const dynamic = 'force-dynamic'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(v: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(v)
}

function contractSummary(tranches: PaymentTranche[]) {
  const released = tranches.filter((t) => t.status === 'released').reduce((s, t) => s + t.amount, 0)
  const unlocked = tranches.filter((t) => t.status === 'unlocked').reduce((s, t) => s + t.amount, 0)
  const locked   = tranches.filter((t) => t.status === 'locked').reduce((s, t) => s + t.amount, 0)
  return { released, unlocked, locked }
}

function OverallBadge({ tranches }: { tranches: PaymentTranche[] }) {
  const allReleased = tranches.length > 0 && tranches.every((t) => t.status === 'released')
  const anyUnlocked = tranches.some((t) => t.status === 'unlocked')
  if (allReleased)  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Fully Released</span>
  if (anyUnlocked)  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Action Required</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">In Progress</span>
}

// ─── Contract card ────────────────────────────────────────────────────────────

function ContractCard({ contract }: { contract: ContractWithLocation }) {
  const { released, unlocked, locked } = contractSummary(contract.tranches)
  const total = contract.total_contract_value

  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h3 className="text-base font-bold text-gray-900">{contract.supplier_name}</h3>
              <OverallBadge tranches={contract.tranches} />
            </div>
            {contract.location && (
              <p className="text-xs font-mono text-blue-600">
                {contract.location.location_code}
                {contract.location.name ? ` — ${contract.location.name}` : ''}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              Created {new Date(contract.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-gray-900">{fmtINR(total)}</p>
            <p className="text-xs text-gray-400">Total value</p>
          </div>
        </div>

        {/* Progress bar — released / unlocked / locked */}
        {total > 0 && (
          <div className="mb-3">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${(released / total) * 100}%` }} />
              <div className="h-full bg-amber-400 transition-all" style={{ width: `${(unlocked / total) * 100}%` }} />
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
              {released > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Released {fmtINR(released)}</span>}
              {unlocked > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Unlocked {fmtINR(unlocked)}</span>}
              {locked   > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />Locked {fmtINR(locked)}</span>}
            </div>
          </div>
        )}

        {/* Tranche count pills */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400">{contract.tranches.length} tranches:</span>
          {contract.tranches.filter((t) => t.status === 'released').length > 0 && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
              {contract.tranches.filter((t) => t.status === 'released').length} released
            </span>
          )}
          {contract.tranches.filter((t) => t.status === 'unlocked').length > 0 && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
              {contract.tranches.filter((t) => t.status === 'unlocked').length} unlocked
            </span>
          )}
          {contract.tranches.filter((t) => t.status === 'locked').length > 0 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">
              {contract.tranches.filter((t) => t.status === 'locked').length} locked
            </span>
          )}
        </div>
      </div>

      {/* Footer link */}
      <div className="border-t border-gray-100 px-5 py-3">
        <Link
          href={`/admin/payments/${contract.id}`}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View contract & manage tranches →
        </Link>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PaymentsDashboardPage() {
  let user: Awaited<ReturnType<typeof getUserWithRole>>['user'] = null
  let role: Awaited<ReturnType<typeof getUserWithRole>>['role'] = null

  try {
    ;({ user, role } = await getUserWithRole())
  } catch {
    redirect('/login')
  }

  if (!user || role !== 'admin') redirect('/login')

  let contracts: ContractWithLocation[] = []
  let fetchError: string | null = null

  try {
    contracts = await getAllContracts()
  } catch {
    fetchError = 'Could not load payment contracts. Please refresh.'
  }

  const totalLocked = contracts.reduce((s, c) =>
    s + c.tranches.filter((t) => t.status === 'locked').reduce((ts, t) => ts + t.amount, 0), 0)
  const totalUnlocked = contracts.reduce((s, c) =>
    s + c.tranches.filter((t) => t.status === 'unlocked').reduce((ts, t) => ts + t.amount, 0), 0)
  const totalReleased = contracts.reduce((s, c) =>
    s + c.tranches.filter((t) => t.status === 'released').reduce((ts, t) => ts + t.amount, 0), 0)

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Contracts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {contracts.length} contract{contracts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/admin/payments/new"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Contract
        </Link>
      </div>

      {/* ── Summary bar ───────────────────────────────────────────────────── */}
      {contracts.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Released', value: totalReleased, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
            { label: 'Unlocked (pending release)', value: totalUnlocked, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Locked', value: totalLocked, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
              <p className={`text-xl font-bold ${s.color}`}>{fmtINR(s.value)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {fetchError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{fetchError}</div>
      )}

      {/* ── Empty ─────────────────────────────────────────────────────────── */}
      {!fetchError && contracts.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <p className="text-gray-500 font-medium mb-1">No payment contracts yet</p>
          <p className="text-sm text-gray-400 mb-5">Create the first contract to start tracking supplier payments.</p>
          <Link href="/admin/payments/new" className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            + Add First Contract
          </Link>
        </div>
      )}

      {/* ── Contract list ─────────────────────────────────────────────────── */}
      {contracts.length > 0 && (
        <div className="space-y-4">
          {contracts.map((c) => <ContractCard key={c.id} contract={c} />)}
        </div>
      )}
    </div>
  )
}
