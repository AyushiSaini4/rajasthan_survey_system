import { getAllLocations } from '@/lib/supabase/locations'
import AdminDashboardClient from '@/components/admin/AdminDashboardClient'
import type { Location } from '@/types'

export const dynamic = 'force-dynamic'   // always fetch fresh data, never cache

export default async function AdminDashboardPage() {
  let locations: Location[] = []
  let fetchError: string | null = null

  try {
    locations = await getAllLocations()
  } catch {
    fetchError = 'Could not load locations. Please refresh the page.'
  }

  if (fetchError) {
    return (
      <div className="max-w-2xl mx-auto mt-12 px-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex gap-4 items-start">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-red-800">Failed to load data</h3>
            <p className="text-sm text-red-600 mt-1">{fetchError}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Locations Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          All locations across Rajasthan — RJ-0001 to RJ-1250
        </p>
      </div>

      {/* ── Interactive dashboard (Client Component) ────────────────────── */}
      <AdminDashboardClient locations={locations} />
    </>
  )
}
