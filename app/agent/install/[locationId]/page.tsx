import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserWithRole } from '@/lib/supabase/auth'
import { getLocationForInstall, getInstallReportForLocation } from '@/lib/supabase/installation'
import InstallationForm from '@/components/installation/InstallationForm'

export const dynamic = 'force-dynamic'

interface Props {
  params: { locationId: string }
}

export default async function InstallationReportPage({ params }: Props) {
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

  // Must confirm delivery first
  const deliveryConfirmed = existingReport?.delivery_confirmed === true
  if (!deliveryConfirmed) {
    return (
      <div className="space-y-5">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/agent/dashboard" className="hover:text-gray-700">Dashboard</Link>
            <span>›</span>
            <span className="text-gray-900 font-medium">Installation Report</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Installation Report</h1>
          <p className="text-sm font-mono text-blue-600 mt-0.5">
            {location.location_code}
            {location.name ? ` — ${location.name}` : ''}
          </p>
        </div>

        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-4 text-sm text-amber-700">
          <p className="font-bold">Delivery not yet confirmed</p>
          <p className="mt-1">
            You must confirm that goods were received at this location before submitting
            the installation report.
          </p>
          <div className="mt-3">
            <Link
              href={`/agent/delivery/${location.id}`}
              className="inline-flex items-center px-3 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition-colors"
            >
              Confirm Delivery First →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Check if installation already submitted
  const alreadySubmitted =
    existingReport?.toilet_installed !== null &&
    existingReport?.toilet_installed !== undefined

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/agent/dashboard" className="hover:text-gray-700">Dashboard</Link>
          <span>›</span>
          <span className="text-gray-900 font-medium">Installation Report</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Installation Report</h1>
        <p className="text-sm font-mono text-blue-600 mt-0.5">
          {location.location_code}
          {location.name ? ` — ${location.name}` : ''}
        </p>
        {location.address && (
          <p className="text-xs text-gray-500 mt-0.5">{location.address}</p>
        )}
      </div>

      {alreadySubmitted ? (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-4 text-sm text-green-700">
          <p className="font-bold">✓ Installation report already submitted</p>
          <p className="mt-1 text-green-600">
            This report is pending verifier review. You will be notified if it is rejected
            and resubmission is required.
          </p>
          {existingReport?.pdf_url && (
            <div className="mt-3">
              <a
                href={existingReport.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
              >
                View PDF Report ↗
              </a>
            </div>
          )}
        </div>
      ) : (
        <InstallationForm location={location} />
      )}
    </div>
  )
}
