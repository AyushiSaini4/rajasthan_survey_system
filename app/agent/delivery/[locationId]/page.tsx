import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserWithRole } from '@/lib/supabase/auth'
import { getLocationForInstall, getInstallReportForLocation } from '@/lib/supabase/installation'
import DeliveryForm from '@/components/installation/DeliveryForm'

export const dynamic = 'force-dynamic'

interface Props {
  params: { locationId: string }
}

export default async function DeliveryConfirmationPage({ params }: Props) {
  let user: Awaited<ReturnType<typeof getUserWithRole>>['user'] = null
  let role: Awaited<ReturnType<typeof getUserWithRole>>['role'] = null

  try {
    ;({ user, role } = await getUserWithRole())
  } catch {
    redirect('/login')
  }

  if (!user || role !== 'field_agent') redirect('/login')

  const location = await getLocationForInstall(params.locationId)
  if (!location) notFound()

  const existingReport = await getInstallReportForLocation(params.locationId)
  const alreadyConfirmed = existingReport?.delivery_confirmed === true

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/agent/dashboard" className="hover:text-gray-700">Dashboard</Link>
          <span>›</span>
          <span className="text-gray-900 font-medium">Delivery Confirmation</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Confirm Goods Received</h1>
        <p className="text-sm font-mono text-blue-600 mt-0.5">
          {location.location_code}
          {location.name ? ` — ${location.name}` : ''}
        </p>
        {location.address && (
          <p className="text-xs text-gray-500 mt-0.5">{location.address}</p>
        )}
      </div>

      {alreadyConfirmed ? (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-4 text-sm text-green-700">
          <p className="font-bold">✓ Delivery already confirmed</p>
          {existingReport?.goods_received_at && (
            <p className="mt-1 text-green-600">
              Confirmed on{' '}
              {new Date(existingReport.goods_received_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          )}
          <div className="mt-3">
            <Link
              href={`/agent/install/${location.id}`}
              className="inline-flex items-center px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              Go to Installation Report →
            </Link>
          </div>
        </div>
      ) : (
        <>
          {location.status !== 'dispatched' && location.status !== 'delivered' && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              <strong>Note:</strong> This location is currently{' '}
              <span className="font-mono font-semibold">{location.status}</span>. Delivery
              confirmation is expected after goods are dispatched from the manufacturing unit.
            </div>
          )}
          <DeliveryForm location={location} />
        </>
      )}
    </div>
  )
}
