import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserWithRole } from '@/lib/supabase/auth'
import { getLocationForAgent } from '@/lib/supabase/agent'
import SurveyFormClient from '@/components/survey/SurveyFormClient'
import LocationStatusBadge from '@/components/shared/LocationStatusBadge'

export const dynamic = 'force-dynamic'

interface Props {
  params: { locationId: string }
}

export default async function SurveyPage({ params }: Props) {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  const { user, role } = await getUserWithRole()
  if (!user || role !== 'field_agent') redirect('/login')

  // ── Fetch location (RLS ensures it belongs to this agent) ──────────────────
  const location = await getLocationForAgent(params.locationId)
  if (!location) notFound()

  // ── Already surveyed guard ─────────────────────────────────────────────────
  if (location.status !== 'pending') {
    return (
      <div className="py-12 text-center">
        <div
          className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3"
          style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg
            className="w-6 h-6 text-green-600"
            width={24}
            height={24}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-semibold text-gray-800 mb-1">Already Surveyed</p>
        <p className="text-sm text-gray-500 mb-3">
          {location.location_code}
          {location.name ? ` — ${location.name}` : ''}
        </p>
        <LocationStatusBadge status={location.status} size="md" />
        <div className="mt-6">
          <Link
            href="/agent/dashboard"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            ← Back to My Locations
          </Link>
        </div>
      </div>
    )
  }

  // ── Render survey form ─────────────────────────────────────────────────────
  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
        <Link
          href="/agent/dashboard"
          className="hover:text-gray-800 transition-colors"
        >
          My Locations
        </Link>
        <svg
          className="w-3.5 h-3.5 flex-shrink-0"
          width={14}
          height={14}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-800 font-medium truncate">
          {location.location_code}
        </span>
      </nav>

      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Survey Form</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Complete all sections. GPS and photos are recommended for full audit trail.
        </p>
      </div>

      <SurveyFormClient location={location} />
    </div>
  )
}
