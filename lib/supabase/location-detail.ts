import { createClient } from './server'
import { createAdminClient } from './admin'
import type {
  Location,
  Survey,
  ManufacturingUnit,
  ProductionJob,
  QCInspection,
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
  activeUnits: ManufacturingUnit[]
  productionJob: ProductionJob | null
  assignedUnit: ManufacturingUnit | null
  qcInspections: QCInspection[]
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

  // ── 2. Parallel queries — survey, active units, production job ────────────
  const [surveyResult, unitsResult, jobResult] = await Promise.all([
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

  // ── 5. Signed photo URLs for survey photos ────────────────────────────────
  const surveyPhotoUrls = survey?.photos?.length
    ? await signPhotoPaths(survey.photos, 'survey-media')
    : []

  return {
    location,
    survey,
    surveyPhotoUrls,
    activeUnits,
    productionJob,
    assignedUnit,
    qcInspections,
  }
}
