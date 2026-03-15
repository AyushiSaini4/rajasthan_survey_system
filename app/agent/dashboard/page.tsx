import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserWithRole } from '@/lib/supabase/auth'
import { getAgentLocations } from '@/lib/supabase/agent'
import LocationStatusBadge from '@/components/shared/LocationStatusBadge'
import OfflineSyncBanner from '@/components/agent/OfflineSyncBanner'
import type { Location } from '@/types'

export const dynamic = 'force-dynamic'

// ─── Location card ─────────────────────────────────────────────────────────────

function LocationCard({ location }: { location: Location }) {
  const isPending = location.status === 'pending'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-mono text-sm font-bold text-gray-900">
              {location.location_code}
            </span>
            <LocationStatusBadge status={location.status} size="sm" />
          </div>

          {location.name && (
            <p className="text-sm font-medium text-gray-700 truncate">{location.name}</p>
          )}

          {(location.district || location.block || location.village) && (
            <p className="text-xs text-gray-500 mt-0.5">
              {[location.district, location.block, location.village]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}

          {location.address && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{location.address}</p>
          )}
        </div>

        {/* Action */}
        <div className="flex-shrink-0 self-center">
          {isPending ? (
            <Link
              href={`/agent/survey/${location.id}`}
              className="inline-flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Survey
              <svg
                className="w-3.5 h-3.5"
                width={14}
                height={14}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
              <svg
                className="w-4 h-4"
                width={16}
                height={16}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Submitted
            </span>
          )}
        </div>

      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function AgentDashboardPage() {
  // ── Auth guard — wrapped in try/catch so a transient Supabase network error
  // doesn't bubble up as a hard 500; we redirect to login instead.
  let user: Awaited<ReturnType<typeof getUserWithRole>>['user'] = null
  let role: Awaited<ReturnType<typeof getUserWithRole>>['role'] = null

  try {
    ;({ user, role } = await getUserWithRole())
  } catch {
    redirect('/login')
  }

  if (!user || role !== 'field_agent') redirect('/login')

  let locations: Location[] = []
  let fetchError: string | null = null

  try {
    locations = await getAgentLocations()
  } catch {
    fetchError = 'Could not load your locations. Please refresh the page.'
  }

  const pending = locations.filter((l) => l.status === 'pending')
  const done    = locations.filter((l) => l.status !== 'pending')

  return (
    <div>
      {/* ── Offline sync banner — client component, reads IndexedDB ──────── */}
      <OfflineSyncBanner />

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">My Locations</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {fetchError
            ? 'Error loading data'
            : locations.length === 0
            ? 'No locations assigned yet'
            : `${pending.length} pending · ${done.length} completed`}
        </p>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {fetchError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {fetchError}
        </div>
      )}

      {/* ── Empty ─────────────────────────────────────────────────────────── */}
      {!fetchError && locations.length === 0 && (
        <div className="text-center py-16">
          <div
            className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg
              className="w-6 h-6 text-gray-400"
              width={24}
              height={24}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-600">No locations assigned</p>
          <p className="text-xs text-gray-400 mt-1">
            Contact your admin to assign survey locations to your account.
          </p>
        </div>
      )}

      {/* ── Pending ───────────────────────────────────────────────────────── */}
      {pending.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Pending Survey — {pending.length}
          </h2>
          <div className="space-y-3">
            {pending.map((loc) => (
              <LocationCard key={loc.id} location={loc} />
            ))}
          </div>
        </section>
      )}

      {/* ── Completed ─────────────────────────────────────────────────────── */}
      {done.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Completed — {done.length}
          </h2>
          <div className="space-y-3">
            {done.map((loc) => (
              <LocationCard key={loc.id} location={loc} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
