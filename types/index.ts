// ─── Vendor ───────────────────────────────────────────────────────────────────

export type VendorType =
  | 'raw_materials'
  | 'tiles'
  | 'sanitary_fittings'
  | 'construction_hardware'
  | 'transport'
  | 'other'

export type VendorStatus = 'active' | 'inactive' | 'pending_review'

export type BankAccountType = 'savings' | 'current'

export interface Vendor {
  id: string
  company_name: string
  vendor_type: VendorType
  contact_person: string
  phone: string
  email: string | null
  website: string | null
  address: string
  district: string
  state: string
  pincode: string
  gst_number: string | null
  pan_number: string | null
  bank_name: string
  bank_account_holder: string
  bank_account_number: string
  bank_ifsc: string
  bank_account_type: BankAccountType
  supply_categories: string[]
  notes: string | null
  status: VendorStatus
  created_by: string
  created_at: string
}

export interface VendorOnboardingFormData {
  // Section 1 — Business Info
  company_name: string
  vendor_type: VendorType
  registration_number: string

  // Section 2 — Contact
  contact_person: string
  phone: string
  email: string
  website: string

  // Section 3 — Address
  address: string
  district: string
  city: string
  state: string
  pincode: string

  // Section 4 — Tax & Compliance
  gst_number: string
  pan_number: string

  // Section 5 — Bank Details
  bank_name: string
  bank_account_holder: string
  bank_account_number: string
  bank_account_number_confirm: string
  bank_ifsc: string
  bank_account_type: BankAccountType

  // Section 6 — Supply Categories
  supply_categories: string[]

  // Section 7 — Notes
  notes: string
}

// ─── User Roles ──────────────────────────────────────────────────────────────

export type UserRole =
  | 'field_agent'
  | 'manufacturing_unit'
  | 'qc_inspector'
  | 'admin'
  | 'verifier'

// ─── Location Status ──────────────────────────────────────────────────────────

export type LocationStatus =
  | 'pending'
  | 'surveyed'
  | 'assigned'
  | 'in_production'
  | 'qc_failed'
  | 'qc_passed'
  | 'dispatched'
  | 'delivered'
  | 'installed'
  | 'verified'
  | 'closed'

// ─── Production Job Status ────────────────────────────────────────────────────

export type ProductionJobStatus =
  | 'pending'
  | 'in_production'
  | 'complete'
  | 'qc_passed'
  | 'qc_failed'
  | 'dispatched'

// ─── Payment Tranche ──────────────────────────────────────────────────────────

export type TrancheName = 'Advance' | 'On QC Pass' | 'On Delivery' | 'On Verification'
export type TriggerMilestone = 'manual' | 'qc_passed' | 'delivered' | 'verified'
export type TrancheStatus = 'locked' | 'unlocked' | 'released'

// ─── Installation Report Status ───────────────────────────────────────────────

export type InstallationReportStatus = 'pending' | 'approved' | 'rejected'

// ─── QC Result ────────────────────────────────────────────────────────────────

export type QCResult = 'passed' | 'failed'

// ─── Database Row Types ───────────────────────────────────────────────────────

export interface Location {
  id: string
  location_code: string
  name: string | null
  district: string | null
  block: string | null
  village: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  assigned_agent: string | null
  assigned_unit_id: string | null
  status: LocationStatus
  created_at: string
}

export interface Survey {
  id: string
  location_id: string
  agent_id: string
  submitted_at: string
  synced_at: string | null

  // Toilet-site GPS — captured alongside the toilet_site_photo field
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy: number | null
  /** @deprecated unused since the 4-section reduced questionnaire (2026-08-10) — kept for historical reports */
  ramp_gps_lat: number | null
  /** @deprecated unused since the 4-section reduced questionnaire (2026-08-10) — kept for historical reports */
  ramp_gps_lng: number | null
  /** @deprecated unused since the 4-section reduced questionnaire (2026-08-10) — kept for historical reports */
  ramp_gps_accuracy: number | null
  /** @deprecated unused since the 4-section reduced questionnaire (2026-08-10) — kept for historical reports */
  gps_accuracy_screenshot: string | null

  // Sections 1–2 — full CWSN questionnaire answers (non-photo fields)
  // (see lib/survey/questionnaire.ts for the field-id schema)
  answers: Record<string, string | boolean | number | null>

  // Section 3 — the 7 mandatory named photo angles, keyed by slot id
  named_photos: Record<string, string>
  // Section 2 — inline questionnaire photo fields (toilet site, ramp,
  // tactile route, braille layout, obstructions), keyed by field id
  field_attachments: Record<string, string[]>
  /** @deprecated unused since the 4-section reduced questionnaire (2026-08-10) — kept for historical reports */
  photos: string[]
  videos: string[]
  /** @deprecated unused since the 4-section reduced questionnaire (2026-08-10) — kept for historical reports */
  layout_map_photos: string[]

  // Section 4 — Declaration
  team_name: string | null
  team_signature: string | null
  authority_name: string | null
  authority_designation: string | null
  authority_signature: string | null
  declaration_date: string | null

  is_offline_submission: boolean
}

// ─── CWSN School Directory ─────────────────────────────────────────────────────
// Mirrors the live public.cwsn_schools table (created outside this repo via
// migrations 0008/0009 — see supabase/migrations/20260805_cwsn_schools_directory.sql).

export interface CWSNSchool {
  id: string
  sno: number
  district: string
  block: string
  school_name: string
  udise_code: string
  cwsn_toilet_no: number | null
  ramp_no: number | null
  tactile_tile_sqft: number | null
  grab_bar_no: number | null
  braille_signage_no: number | null
  braille_layout_plan_no: number | null
  sanction_amount_lacs: number | null
  /** Set once this school has entered the survey pipeline — see locations. */
  location_id: string | null
  created_at: string
}

export interface ManufacturingUnit {
  id: string
  name: string
  district: string | null
  contact_name: string | null
  contact_phone: string | null
  user_id: string | null
  is_active: boolean
}

export interface ProductionJob {
  id: string
  location_id: string
  survey_id: string
  unit_id: string
  assigned_by: string
  assigned_at: string
  qty_tiles: number | null
  qty_toilet_units: number | null
  qty_ramp_units: number | null
  qty_fittings: number | null
  qty_other: Record<string, number> | null
  progress_pct: number
  status: ProductionJobStatus
  production_notes: string | null
  completed_at: string | null
  dispatched_at: string | null
}

export interface QCInspection {
  id: string
  production_job_id: string
  location_id: string
  inspector_id: string
  inspected_at: string
  inspection_number: number
  qty_correct: boolean | null
  qty_notes: string | null
  dimensions_correct: boolean | null
  dimensions_notes: string | null
  finish_quality_pass: boolean | null
  finish_notes: string | null
  defects_present: boolean | null
  defects_description: string | null
  overall_notes: string | null
  result: QCResult | null
  photos: string[]
  inspector_signature_url: string | null
  inspector_name: string | null
  pdf_url: string | null
  rework_required: boolean
  rework_deadline: string | null
}

export interface PaymentContract {
  id: string
  supplier_name: string
  location_id: string | null
  total_contract_value: number
  currency: string
  created_by: string
  created_at: string
  notes: string | null
}

export interface PaymentTranche {
  id: string
  contract_id: string
  tranche_name: TrancheName
  trigger_milestone: TriggerMilestone
  percentage: number
  amount: number
  status: TrancheStatus
  unlocked_at: string | null
  released_at: string | null
  released_by: string | null
  payment_reference: string | null
  notes: string | null
}

export interface InstallationReport {
  id: string
  location_id: string
  agent_id: string
  submitted_at: string
  gps_lat: number | null
  gps_lng: number | null
  goods_received_at: string | null
  goods_received_by: string | null
  delivery_confirmed: boolean
  /** @deprecated superseded by cwsn_unit_installed — kept for historical reports */
  toilet_installed: boolean | null
  ramp_installed: boolean | null
  /** @deprecated superseded by grab_bars_installed / plumbing_connected / electrical_connected */
  hardware_installed: boolean | null
  installation_notes: string | null
  photos: string[]
  /** Principal / Head of Institution signature (column name kept for compatibility) */
  signature_data_url: string | null
  /** Principal / Head of Institution name (column name kept for compatibility) */
  signed_by_name: string | null
  /** Principal / Head of Institution designation (column name kept for compatibility) */
  signed_by_designation: string | null
  pdf_url: string | null
  status: InstallationReportStatus
  verified_by: string | null
  verified_at: string | null
  verifier_notes: string | null
  rejection_reason: string | null

  // ── QC expansion (matches GeM Completion & Quality Certification) ─────────
  installation_date: string | null
  cwsn_unit_installed: boolean | null
  grab_bars_installed: boolean | null
  braille_signage_installed: boolean | null
  braille_layout_installed: boolean | null
  tactile_tiles_installed: boolean | null
  plumbing_connected: boolean | null
  electrical_connected: boolean | null
  functional_testing_passed: boolean | null
  named_photos: Record<string, string>
  dept_rep_applicable: boolean | null
  dept_rep_name: string | null
  dept_rep_designation: string | null
  dept_rep_signature_url: string | null
  contractor_name: string | null
  contractor_signature_url: string | null
  school_seal_affixed: boolean | null
}

/** Named photo slot ids for the installation completion record. */
export const INSTALL_PHOTO_SLOTS = [
  { id: 'cwsn_unit', label: 'Installed Accessible Unit' },
  { id: 'ramp', label: 'Ramp' },
  { id: 'braille_signage', label: 'Braille Signage' },
  { id: 'braille_layout', label: 'Braille Layout Map' },
  { id: 'tactile_tiles', label: 'Tactile Tiles' },
  { id: 'overall', label: 'Overall Completion Photograph' },
] as const

export type InstallPhotoSlotId = typeof INSTALL_PHOTO_SLOTS[number]['id']

// ─── Offline Sync ─────────────────────────────────────────────────────────────

export type OfflineStoreType =
  | 'survey'
  | 'qc_inspection'
  | 'installation_report'
  | 'delivery_confirmation'

export interface PendingSubmission {
  id: string
  type: OfflineStoreType
  data: Survey | QCInspection | InstallationReport | Record<string, unknown>
  created_at: string
  attempted_at: string | null
}
