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
  gps_lat: number | null
  gps_lng: number | null
  gps_accuracy: number | null
  toilet_present: boolean | null
  toilet_condition: 'good' | 'damaged' | 'missing' | null
  ramp_present: boolean | null
  ramp_condition: 'good' | 'damaged' | 'missing' | null
  hardware_condition: 'good' | 'damaged' | 'missing' | null
  notes: string | null
  qty_tiles: number | null
  qty_toilet_units: number | null
  qty_ramp_units: number | null
  qty_fittings: number | null
  qty_other: Record<string, number> | null
  photos: string[]
  videos: string[]
  is_offline_submission: boolean
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
  toilet_installed: boolean | null
  ramp_installed: boolean | null
  hardware_installed: boolean | null
  installation_notes: string | null
  photos: string[]
  signature_data_url: string | null
  signed_by_name: string | null
  signed_by_designation: string | null
  pdf_url: string | null
  status: InstallationReportStatus
  verified_by: string | null
  verified_at: string | null
  verifier_notes: string | null
  rejection_reason: string | null
}

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
