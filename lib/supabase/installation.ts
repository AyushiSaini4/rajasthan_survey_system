import { createAdminClient } from './admin'
import { createClient } from './server'
import type { Location, InstallationReport } from '@/types'

// ─── Extended types ───────────────────────────────────────────────────────────

export interface InstallationReportFull extends InstallationReport {
  location: Pick<Location, 'id' | 'location_code' | 'name' | 'district' | 'block' | 'village' | 'address'>
}

// ─── Agent queries ────────────────────────────────────────────────────────────

/** Get a single location for an agent — RLS enforces ownership. */
export async function getLocationForInstall(locationId: string): Promise<Location | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', locationId)
    .single()
  if (error) {
    if (error.code !== 'PGRST116') console.error('[getLocationForInstall]', error.message)
    return null
  }
  return data as unknown as Location
}

/** Get the latest installation_report for a location (if any). */
export async function getInstallReportForLocation(
  locationId: string
): Promise<InstallationReport | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('installation_reports')
    .select('*')
    .eq('location_id', locationId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[getInstallReportForLocation]', error.message)
    return null
  }
  return data as unknown as InstallationReport | null
}

// ─── Verifier queries ─────────────────────────────────────────────────────────

/**
 * Returns installation reports where:
 *  - status = 'pending'
 *  - installation data is filled (toilet_installed IS NOT NULL)
 *  - joined location has status = 'installed'
 * Ordered newest first.
 */
export async function getPendingInstallationReports(): Promise<InstallationReportFull[]> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('installation_reports')
    .select(`
      *,
      location:locations(id, location_code, name, district, block, village, address)
    `)
    .eq('status', 'pending')
    .not('toilet_installed', 'is', null)
    .order('submitted_at', { ascending: false })

  if (error) {
    console.error('[getPendingInstallationReports]', error.message)
    throw new Error('Failed to load installation reports')
  }

  return (data ?? []) as unknown as InstallationReportFull[]
}

/** Get a single installation report by ID with joined location. */
export async function getInstallationReportById(
  reportId: string
): Promise<InstallationReportFull | null> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('installation_reports')
    .select(`
      *,
      location:locations(id, location_code, name, district, block, village, address)
    `)
    .eq('id', reportId)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') console.error('[getInstallationReportById]', error.message)
    return null
  }

  return data as unknown as InstallationReportFull
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getPublicStorageUrl(bucket: string, path: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`
}
