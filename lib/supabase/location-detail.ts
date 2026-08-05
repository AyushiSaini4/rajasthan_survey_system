import { createClient } from './server'
import { createAdminClient } from './admin'
import { getSanctionedSchoolForLocation } from './schools'
import type {
  Location,
  Survey,
  ManufacturingUnit,
  ProductionJob,
  QCInspection,
  CWSNSchool,
} from '@/types'

// ─── Signed-URL helper ────────────────────────────────────────────────────────
// Photos are stored as Storage paths (not full URLs). We generate short-lived
// signed URLs so the browser can display them without exposing the bucket publicly.

async function signPhotoPaths(paths: string[], bucket: string): Promise<string[]> {
  if (!paths || paths.length === 0) return []
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrls(paths, 60 * 60) // 1 hour
  if (error || !data) return []
  return data.map((item) => item.signedUrl ?? '').filter(Boolean)
}

// ─── Return type ──────────────────────────────────────────────────────────────

export interface LocationDetailData {
  location: Location
  survey: Survey | null
  surveyPhotoUrls: string[]
  /** Section 15 mandatory photos, keyed by slot id → signed URL */
  namedPhotoUrls: Record<string, string>
  layoutMapPhotoUrls: string[]
  gpsAccuracyScreenshotUrl: string | null
  teamSignatureUrl: string | null
  authoritySignatureUrl: string | null
  activeUnits: ManufacturingUnit[]
  productionJob: ProductionJob | null
  assignedUnit: ManufacturingUnit | null
  qcInspections: QCInspection[]
  /** RCSE sanction record for this school, if it was part of the 1,236-row
   *  cwsn_schools import — used to pre-fill production-job quantities.
   *  Null for locations with no sanction match (e.g. Anganwadi Kendras). */
  sanctionedSchool: CWSNSchool | null
}

// ─── Main fetcher ─────────────────────────────────────────────────────────────
// Runs all independent queries in parallel for performance.

export async function getLocationDetailData(id: string): Promise<LocationDetailData | null> {
  const supabase = createClient()

  // ── 1. Location (required — abort if missing) ─────────────────────────────
  const { data: locationData, error: locationError } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .single()

  if (locationError || !locationData) {
    console.error('[getLocationDetailData] location fetch error:', locationError?.message)
    return null
  }

  const location = locationData as unknown as Location

  // ── 2. Parallel queries — survey, active units, production job, sanction ──
  const [surveyResult, unitsResult, jobResult, sanctionedSchool] = await Promise.all([
    supabase
      .from('surveys')
      .select('*')
      .eq('location_id', id)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('manufacturing_units')
      .select('id, name, district, contact_name, contact_phone, user_id, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true }),

    supabase
      .from('production_jobs')
      .select('*')
      .eq('location_id', id)
      .order('assigned_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    getSanctionedSchoolForLocation(id),
  ])

  const survey = surveyResult.data ? (surveyResult.data as unknown as Survey) : null
  const activeUnits = (unitsResult.data ?? []) as unknown as ManufacturingUnit[]
  const productionJob = jobResult.data ? (jobResult.data as unknown as ProductionJob) : null

  // ── 3. QC inspections (only if a production job exists) ───────────────────
  let qcInspections: QCInspection[] = []
  if (productionJob) {
    const { data: qcData } = await supabase
      .from('qc_inspections')
      .select('*')
      .eq('production_job_id', productionJob.id)
      .order('inspection_number', { ascending: true })

    qcInspections = (qcData ?? []) as unknown as QCInspection[]
  }

  // ── 4. Assigned unit details (if location has one) ────────────────────────
  let assignedUnit: ManufacturingUnit | null = null
  if (location.assigned_unit_id) {
    const { data: unitData } = await supabase
      .from('manufacturing_units')
      .select('id, name, district, contact_name, contact_phone, user_id, is_active')
      .eq('id', location.assigned_unit_id)
      .single()

    assignedUnit = unitData ? (unitData as unknown as ManufacturingUnit) : null
  }

  // ── 5. Signed photo URLs for survey media ──────────────────────────────────
  const surveyPhotoUrls = survey?.photos?.length
    ? await signPhotoPaths(survey.photos, 'survey-media')
    : []

  const layoutMapPhotoUrls = survey?.layout_map_photos?.length
    ? await signPhotoPaths(survey.layout_map_photos, 'survey-media')
    : []

  const namedPhotoUrls: Record<string, string> = {}
  if (survey?.named_photos && Object.keys(survey.named_photos).length > 0) {
    const slotIds = Object.keys(survey.named_photos)
    const paths = slotIds.map((id) => survey.named_photos[id])
    const urls = await signPhotoPaths(paths, 'survey-media')
    slotIds.forEach((id, i) => {
      if (urls[i]) namedPhotoUrls[id] = urls[i]
    })
  }

  const singleFileUrls = await signPhotoPaths(
    [survey?.gps_accuracy_screenshot, survey?.team_signature, survey?.authority_signature].filter(
      (p): p is string => Boolean(p),
    ),
    'survey-media',
  )
  let cursor = 0
  const gpsAccuracyScreenshotUrl = survey?.gps_accuracy_screenshot ? singleFileUrls[cursor++] ?? null : null
  const teamSignatureUrl = survey?.team_signature ? singleFileUrls[cursor++] ?? null : null
  const authoritySignatureUrl = survey?.authority_signature ? singleFileUrls[cursor++] ?? null : null

  return {
    location,
    survey,
    surveyPhotoUrls,
    namedPhotoUrls,
    layoutMapPhotoUrls,
    gpsAccuracyScreenshotUrl,
    teamSignatureUrl,
    authoritySignatureUrl,
    activeUnits,
    productionJob,
    assignedUnit,
    qcInspections,
    sanctionedSchool,
  }
}

// ─── Fetch all field agents (for admin assign dropdown) ───────────────────────
export async function getFieldAgents(): Promise<{ id: string; email: string }[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.listUsers()
  if (error || !data) return []
  return data.users
    .filter(u => u.app_metadata?.role === 'field_agent')
    .map(u => ({ id: u.id, email: u.email ?? u.id }))
}
