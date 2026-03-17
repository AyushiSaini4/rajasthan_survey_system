import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import VendorOnboardingForm from '@/components/admin/VendorOnboardingForm'

export const metadata = {
  title: 'Onboard New Vendor — Admin',
}

export default function NewVendorPage() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">

        {/* ── Page header ───────────────────────────────────────────────────── */}
        <div className="mb-8">
          <Link
            href="/admin/vendors"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Vendors
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Onboard New Vendor
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Register a raw materials or goods supplier for payment processing.
                Fields marked <span className="text-destructive">*</span> are required.
              </p>
            </div>
          </div>
        </div>

        {/* ── Form ──────────────────────────────────────────────────────────── */}
        <VendorOnboardingForm />

      </div>
    </div>
  )
}
