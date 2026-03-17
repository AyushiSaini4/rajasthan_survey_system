import Link from 'next/link'
import { Plus, Building2 } from 'lucide-react'

export const metadata = {
  title: 'Vendors — Admin',
}

export default function VendorsPage() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Vendors</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Raw material and goods suppliers registered for payment processing
            </p>
          </div>
          <Link
            href="/admin/vendors/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Vendor
          </Link>
        </div>

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
            <Building2 className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-gray-900">No vendors yet</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs">
            Onboard your first raw materials or goods supplier to get started with payment contracts.
          </p>
          <Link
            href="/admin/vendors/new"
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Onboard First Vendor
          </Link>
        </div>

      </div>
    </div>
  )
}
