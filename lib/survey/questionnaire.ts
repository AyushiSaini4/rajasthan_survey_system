/**
 * CWSN Survey Questionnaire — single source of truth.
 *
 * Reduced from the original 17-section questionnaire to 4 sections, per the
 * updated spec (2026-08-10). Drives SurveyFormClient.tsx (dynamic field
 * rendering), submitSurvey validation, and the admin location detail page.
 *
 * Section 3 (mandatory named photos) and Section 4 (declaration/signatures)
 * are handled by dedicated components rather than generic fields, same as
 * before. Everything else in Sections 1–2 flows through
 * `answers: Record<fieldId, AnswerValue>` — EXCEPT fields of type 'photo',
 * which capture one or more images inline (e.g. a geo-tagged toilet-site
 * photo right where the "is a site approved?" question is asked). Photo
 * fields are never stored in `answers` — SurveyFormClient intercepts them
 * before they reach the generic QuestionnaireFieldInput renderer and stores
 * them via the same ordered-file-list + photoMeta upload pattern used for
 * the mandatory photos and signatures, landing in surveys.field_attachments
 * (jsonb, keyed by field id → storage path array).
 */

export type FieldType = 'yesno' | 'text' | 'number' | 'date' | 'dropdown' | 'photo'

export interface QuestionnaireField {
  id: string
  label: string
  type: FieldType
  /** Options for 'dropdown' fields. */
  options?: string[]
  /** Shown when required and left blank on submit. */
  required?: boolean
  /** Only render this field when `answers[showIf.fieldId] === showIf.equals`. */
  showIf?: { fieldId: string; equals: boolean | string }
  placeholder?: string
  /** For type 'photo' — how many images this field accepts. Default 1. */
  maxPhotos?: number
  /** For type 'photo' — capture GPS alongside the photo (e.g. toilet site). */
  requiresGps?: boolean
}

export interface QuestionnaireSection {
  id: string
  title: string
  fields: QuestionnaireField[]
}

export const QUESTIONNAIRE: QuestionnaireSection[] = [
  {
    id: 'basic_details',
    title: 'Section 1 — Basic Details',
    fields: [
      { id: 'survey_date', label: 'Survey Date', type: 'date', required: true },
      { id: 'survey_team_name', label: 'Survey Team Name', type: 'text', required: true },
      { id: 'school_name', label: 'School Name', type: 'text', required: true },
      { id: 'udise_code', label: 'UDISE Code', type: 'text', required: true },
      { id: 'district', label: 'District', type: 'text', required: true },
      { id: 'block', label: 'Block', type: 'text', required: true },
    ],
  },
  {
    id: 'authority_approval',
    title: 'Section 2 — Authority Details & Approval',
    fields: [
      // ── Head of Institution ──────────────────────────────────────────
      { id: 'hoi_name', label: 'Head of Institution — Name', type: 'text', required: true },
      { id: 'hoi_contact', label: 'Contact Number', type: 'text' },
      { id: 'hoi_present', label: 'Presence During Survey', type: 'yesno' },

      // ── Other authority representative ───────────────────────────────
      { id: 'other_authority_name', label: 'Other Authority Representative — Name', type: 'text' },
      { id: 'other_authority_designation', label: 'Designation', type: 'text' },
      { id: 'other_authority_contact', label: 'Contact Number', type: 'text' },

      // ── Toilet site approval — geo-tagged photo + GPS ────────────────
      { id: 'toilet_site_approved', label: 'Site identified for CWSN Toilet approved?', type: 'yesno', required: true },
      {
        id: 'toilet_site_photo', label: 'Toilet Site — Geo-Tagged Photo', type: 'photo', required: true,
        showIf: { fieldId: 'toilet_site_approved', equals: true }, requiresGps: true,
      },

      // ── Ramp length ───────────────────────────────────────────────────
      { id: 'ramp_length_available', label: 'Ramp length of 15ft available at site?', type: 'yesno', required: true },
      {
        id: 'ramp_length_photo', label: 'Ramp Site — Geo-Tagged Photo', type: 'photo', required: true,
        showIf: { fieldId: 'ramp_length_available', equals: true },
      },

      // ── Tactile route ─────────────────────────────────────────────────
      { id: 'tactile_route_approved', label: 'Tactile route/path alignment approved?', type: 'yesno', required: true },
      {
        id: 'tactile_route_photo', label: 'Tactile Route — Map / Route Photo', type: 'photo', required: true,
        showIf: { fieldId: 'tactile_route_approved', equals: true },
      },
      {
        id: 'tactile_route_reason', label: 'Reason not approved', type: 'text',
        showIf: { fieldId: 'tactile_route_approved', equals: false },
      },

      // ── Braille layout — digital map OR approved hand sketch ────────
      {
        id: 'braille_layout_photo', label: 'Braille Layout Map (digital map, or approved hand-made sketch)',
        type: 'photo', maxPhotos: 2,
      },

      // ── Braille signage — 10 blank numbered fields ───────────────────
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `braille_signage_${i + 1}`,
        label: `Braille Signage — Sr. No. ${i + 1}`,
        type: 'text' as const,
      })),

      // ── Site conditions ───────────────────────────────────────────────
      { id: 'ground_condition', label: 'Ground Condition', type: 'dropdown', options: ['Soil', 'Concrete', 'Uneven'] },
      { id: 'site_level', label: 'Site Level', type: 'dropdown', options: ['Flat', 'Slope', 'Uneven'] },
      { id: 'foundation_requirement', label: 'Foundation Requirement', type: 'dropdown', options: ['Normal', 'Special'] },

      // ── Distances ─────────────────────────────────────────────────────
      { id: 'sewer_distance_ft', label: 'Distance to Sewer Line / Manhole (ft)', type: 'number' },
      { id: 'water_distance_ft', label: 'Distance to Water Source (ft)', type: 'number' },
      { id: 'electric_distance_ft', label: 'Distance to Electric Point (ft)', type: 'number' },

      // ── Overhead obstruction ──────────────────────────────────────────
      { id: 'overhead_obstruction', label: 'Overhead obstruction for unloading/crane?', type: 'yesno' },
      {
        id: 'obstruction_photos', label: 'Obstruction Photos', type: 'photo', maxPhotos: 3, required: true,
        showIf: { fieldId: 'overhead_obstruction', equals: true },
      },

      // ── Crane ─────────────────────────────────────────────────────────
      { id: 'local_crane_vendor_available', label: 'Local Crane Vendor Available?', type: 'yesno' },
      { id: 'crane_owner_name', label: 'Crane Owner Name', type: 'text' },
      { id: 'crane_owner_contact', label: 'Contact Number', type: 'text' },

      // ── Execution challenges ──────────────────────────────────────────
      { id: 'execution_challenge', label: 'Any Specific Execution Challenge Forecasted', type: 'text' },
    ],
  },
]

/** Section 3 — the 7 mandatory named photo angles, in required order. */
export const MANDATORY_PHOTO_SLOTS: { id: string; label: string }[] = [
  { id: 'main_gate', label: 'Main Gate' },
  { id: 'school_board', label: 'School Board' },
  { id: 'water_point', label: 'Water Point' },
  { id: 'sewer_point', label: 'Sewer Point' },
  { id: 'electrical_point', label: 'Electrical Point' },
  { id: 'overall_panorama', label: 'Overall Panorama' },
  { id: 'obstacles', label: 'Obstacles' },
]

/** Answer map keyed by QuestionnaireField.id — never holds 'photo' field values. */
export type AnswerValue = string | boolean | number | null
export type Answers = Record<string, AnswerValue>

/** Flatten all fields across sections (useful for validation). */
export function allFields(): QuestionnaireField[] {
  return QUESTIONNAIRE.flatMap((s) => s.fields)
}

/** Fields whose values live in `answers` — excludes type 'photo', which is handled separately. */
export function answerFields(): QuestionnaireField[] {
  return allFields().filter((f) => f.type !== 'photo')
}

/** Returns the first missing-required-field error message, or null if valid. */
export function validateAnswers(answers: Answers): string | null {
  for (const section of QUESTIONNAIRE) {
    for (const field of section.fields) {
      if (field.type === 'photo') continue // validated separately against uploaded files
      if (!field.required) continue
      if (field.showIf) {
        const dep = answers[field.showIf.fieldId]
        if (dep !== field.showIf.equals) continue
      }
      const v = answers[field.id]
      if (v === undefined || v === null || v === '') {
        return `${section.title}: "${field.label}" is required.`
      }
    }
  }
  return null
}
