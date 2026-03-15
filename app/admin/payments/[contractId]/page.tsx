import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserWithRole } from '@/lib/supabase/auth'
import { getContractWithTranches } from '@/lib/supabase/payments'
import ReleasePaymentForm from '@/components/payments/ReleasePaymentForm'
import type { PaymentTranche } from '@/types'

export const dynamic = 'force-dynamic'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(v: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(v)
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Summary bar ──────────────────────────────────────────────────────────────

function SummaryBar({ tranches, total }: { tranches: PaymentTranche[]; total: number }) {
  const released = tranches.filter((t) => t.status === 'released').reduce((s, t) => s + t.amount, 0)
  const unlocked = tranches.filter((t) => t.status === 'unlocked').reduce((s, t) => s + t.amount, 0)
  const locked   = tranches.filter((t) => t.status === 'locked').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Payment Summary</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {[
          { label: 'Total', value: total, color: 'text-gray-900' },
          { label: 'Released', value: released, color: 'text-green-700' },
          { label: 'Unlocked', value: unlocked, color: 'text-amber-700' },
          { label: 'Locked', value: locked, color: 'text-gray-500' },
        ].map((s) => (
          <div key={s.label}>
            <p className={`text-lg font-bold ${s.color}`}>{fmtINR(s.value)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      {/* Progress bar */}
      {total > 0 && (
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
          <div className="h-full bg-green-500" style={{ width: `${(released / total) * 100}%` }} />
          <div className="h-full bg-amber-400" style={{ width: `${(unlocked / total) * 100}%` }} />
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props {
  params: { contractId: string }
  searchParams: Record<string, string>
}

export default async function ContractDetailPage({ params, searchParams }: Props) {
  let user: Awaited<ReturnType<typeof getUserWithRole>>['user'] = null
  let role: Awaited<ReturnType<typeof getUserWithRole>>['role'] = null

  try {
    ;({ user, role } = await getUserWithRole())
  } catch {
    redirect('/login')
  }

  if (!user || role !== 'admin') redirect('/login')

  let contract = null
  try {
    contract = await getContractWithTranches(params.contractId)
  } catch {
    // fall through to notFound
  }

  if (!contract) notFound()

  const justCreated = searchParams.created === '1'

  // Sort tranches in logical order
  const TRANCHE_ORDER = ['Advance', 'On QC Pass', 'On Delivery', 'On Verification']
  const sortedTranches = [...contract.tranches].sort(
    (a, b) => TRANCHE_ORDER.indexOf(a.tranche_name) - TRANCHE_ORDER.indexOf(b.tranche_name)
  )

  return (
    <div className="max-w-3xl space-y-6">

      {/* ── Breadcrumb + header ───────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/admin/payments" className="hover:text-gray-700">Payments</Link>
          <span>›</span>
          <span className="text-gray-900 font-medium truncate">{contract.supplier_name}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{contract.supplier_name}</h1>
        {contract.location && (
          <p className="text-sm font-mono text-blue-600 mt-0.5">
            {contract.location.location_code}
            {contract.location.name ? ` — ${contract.location.name}` : ''}
          </p>
        )}
      </div>

      {/* ── Success toast ─────────────────────────────────────────────────── */}
      {justCreated && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium">
          ✓ Contract created. Release the Advance tranche to get started.
        </div>
      )}

      {/* ── Contract info ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Contract Details</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <dt className="text-xs text-gray-400">Supplier</dt>
            <dd className="text-sm font-semibold text-gray-900 mt-0.5">{contract.supplier_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Total Value</dt>
            <dd className="text-sm font-bold text-gray-900 mt-0.5">{fmtINR(contract.total_contract_value)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Location</dt>
            <dd className="text-sm text-gray-700 mt-0.5">
              {contract.location
                ? `${contract.location.location_code}${contract.location.name ? ` — ${contract.location.name}` : ''}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400">Created</dt>
            <dd className="text-sm text-gray-700 mt-0.5">{fmtDate(contract.created_at)}</dd>
          </div>
          {contract.notes && (
            <div className="col-span-2">
              <dt className="text-xs text-gray-400">Notes</dt>
              <dd className="text-sm text-gray-700 mt-0.5">{contract.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* ── Summary bar ───────────────────────────────────────────────────── */}
      <SummaryBar tranches={sortedTranches} total={contract.total_contract_value} />

      {/* ── Tranches ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Payment Tranches</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            System auto-unlocks tranches when milestones are hit. You manually confirm each release after entering a payment reference.
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {sortedTranches.map((tranche) => (
            <div key={tranche.id} className="p-5">
              <ReleasePaymentForm tranche={tranche} />
            </div>
          ))}

          {sortedTranches.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              No tranches found for this contract.
            </div>
          )}
        </div>
      </div>

      {/* ── Audit note ────────────────────────────────────────────────────── */}
      <p className="text-xs text-gray-400 text-center pb-4">
        All payment releases are permanently logged with the releasing admin&apos;s ID, timestamp, and payment reference.
      </p>
    </div>
  )
}
