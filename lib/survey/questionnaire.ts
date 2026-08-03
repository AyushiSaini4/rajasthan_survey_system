/**
 * CWSN Survey Questionnaire — single source of truth.
 *
 * Mirrors the official "Detailed survey questionnaire for the Rajasthan
 * Government School Education - CWSN project" (17 sections). Drives:
 *  - SurveyFormClient.tsx (dynamic field rendering)
 *  - submitSurvey validation (required fields)
 *  - future PDF/report rendering for verifier & admin views
 *
 * Sections 3 (GPS), 15 (mandatory named photos), and 17 (declaration/
 * signatures) are handled by dedicated components/columns rather than
 * generic fields, since they need custom capture UI. Everything else
 * flows through `answers: Record<fieldId, AnswerValue>`.
 */

export type FieldType = 'yesno' | 'text' | 'number' | 'date' | 'dropdown'

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
}

export interface QuestionnaireSection {
  id: string
  title: string
  fields: QuestionnaireField[]
}

const ROOM_TYPE_OPTIONS = [
  'Classroom',
  'Office',
  'Toilet',
  'Staff Room',
  'Library',
  'Laboratory',
  'Store Room',
  'Assembly Hall',
  'Other',
]

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
      { id: 'village_town', label: 'Village/Town', type: 'text' },
      {
        id: 'school_category',
        label: 'School Category',
        type: 'dropdown',
        options: ['Primary', 'Secondary', 'Sr. Sec.'],
      },
      { id: 'school_type', label: 'Type of School', type: 'text' },
      { id: 'adpc_contact', label: 'ADPC Name and Contact No.', type: 'text' },
      { id: 'district_aen_contact', label: 'District AEN Name and Contact No.', type: 'text' },
      { id: 'jen_contact', label: 'JEN Name and Contact No.', type: 'text' },
    ],
  },
  {
    id: 'authority_approval',
    title: 'Section 2 — Authority Details & Approval',
    fields: [
      { id: 'hoi_name', label: 'Name of Head of Institution (Principal/Headmaster)', type: 'text', required: true },
      { id: 'hoi_contact', label: 'Contact Number', type: 'text' },
      { id: 'hoi_present', label: 'Presence During Survey', type: 'yesno' },
      { id: 'local_authority_name', label: 'Name of Local Authority Representative', type: 'text' },
      { id: 'local_authority_designation', label: 'Designation', type: 'text' },
      { id: 'local_authority_contact', label: 'Contact Number', type: 'text' },
      { id: 'approval_toilet_site', label: 'Site identified for CWSN Toilet approved?', type: 'yesno', required: true },
      { id: 'approval_ramp_alignment', label: 'Ramp alignment approved?', type: 'yesno', required: true },
      { id: 'approval_tactile_path', label: 'Tactile path alignment approved?', type: 'yesno', required: true },
      { id: 'approval_braille_signage', label: 'Braille signage locations approved?', type: 'yesno', required: true },
      { id: 'approval_braille_layout', label: 'Braille layout/map approved?', type: 'yesno', required: true },
      { id: 'signage_texts', label: 'Signage texts (max 10, comma-separated)', type: 'text' },
      {
        id: 'location_final_confirmed',
        label: 'Principal confirms proposed location is final and shall not be changed after survey',
        type: 'yesno',
        required: true,
      },
      { id: 'approval_remarks', label: 'Remarks (if any objection)', type: 'text' },
    ],
  },
  {
    id: 'existing_infrastructure',
    title: 'Section 4 — Existing Infrastructure Status',
    fields: [
      { id: 'existing_toilet_available', label: 'Existing Toilet Available?', type: 'yesno' },
      { id: 'separate_cwsn_toilet_available', label: 'Separate CWSN Toilet Available?', type: 'yesno' },
      { id: 'clear_space_available', label: 'Clear space available for new construction?', type: 'yesno', required: true },
      { id: 'area_dimensions', label: 'Area Dimensions (L × W)', type: 'text' },
      { id: 'encroachment_obstruction', label: 'Any encroachment/obstruction?', type: 'yesno' },
      { id: 'crane_obstruction', label: 'Any obstruction for crane', type: 'text' },
      { id: 'infra_remarks', label: 'Remarks (if any)', type: 'text' },
    ],
  },
  {
    id: 'site_feasibility_toilet',
    title: 'Section 5 — Site Feasibility: CWSN Toilet',
    fields: [
      {
        id: 'ground_condition',
        label: 'Ground Condition',
        type: 'dropdown',
        options: ['Soil', 'Concrete', 'Uneven'],
      },
      {
        id: 'site_level',
        label: 'Site Level',
        type: 'dropdown',
        options: ['Flat', 'Slope', 'Uneven'],
      },
      { id: 'waterlogging_issue', label: 'Waterlogging issue?', type: 'yesno' },
      { id: 'excavation_feasibility', label: 'Excavation feasibility?', type: 'yesno' },
      {
        id: 'foundation_requirement',
        label: 'Foundation requirement',
        type: 'dropdown',
        options: ['Normal', 'Special'],
      },
    ],
  },
  {
    id: 'utilities',
    title: 'Section 6 — Sewer / Water / Electrical Connection',
    fields: [
      { id: 'sewer_line_available', label: 'Sewer line available?', type: 'yesno' },
      { id: 'existing_manhole', label: 'Existing manhole?', type: 'yesno' },
      { id: 'sewer_distance_m', label: 'Distance from proposed toilet (meters)', type: 'number' },
      { id: 'sewer_connection_feasible', label: 'Connection feasible?', type: 'yesno' },
      {
        id: 'septic_tank_required',
        label: 'Septic Tank Required?',
        type: 'yesno',
        showIf: { fieldId: 'sewer_connection_feasible', equals: false },
      },
      { id: 'water_source_available', label: 'Water source available?', type: 'yesno' },
      { id: 'water_distance', label: 'Distance to connection', type: 'text' },
      { id: 'water_pressure_adequate', label: 'Pressure adequate?', type: 'yesno' },
      { id: 'power_supply_available', label: 'Power supply available nearby?', type: 'yesno' },
      { id: 'electrical_distance', label: 'Distance to connection point', type: 'text' },
    ],
  },
  {
    id: 'ramp_feasibility',
    title: 'Section 7 — Ramp Feasibility',
    fields: [
      { id: 'ramp_required', label: 'Ramp required?', type: 'yesno', required: true },
      { id: 'toilet_height', label: 'Height of toilet', type: 'text' },
      { id: 'ramp_length_possible_m', label: 'Ramp length possible (meters)', type: 'number' },
      { id: 'ramp_slope_feasible', label: 'Slope feasible (1:12 standard)?', type: 'yesno' },
      { id: 'ramp_surface_condition', label: 'Surface condition', type: 'text' },
    ],
  },
  {
    id: 'accessibility_movement',
    title: 'Section 8 — Accessibility & Movement (Critical)',
    fields: [
      {
        id: 'road_accessibility',
        label: 'Road accessibility to school',
        type: 'dropdown',
        options: ['Good', 'Average', 'Poor'],
        required: true,
      },
      { id: 'approach_road_width_m', label: 'Approach road width (meters)', type: 'number' },
      { id: 'turning_radius_available', label: 'Turning radius available for truck and crane?', type: 'yesno' },
      { id: 'truck_entry_possible', label: 'Truck entry inside school possible?', type: 'yesno' },
      { id: 'max_vehicle_size', label: 'Maximum vehicle size that can enter', type: 'text' },
      { id: 'crane_movement_possible', label: 'Crane movement possible?', type: 'yesno', required: true },
      { id: 'crane_setup_space', label: 'Space available for crane setup?', type: 'yesno' },
      { id: 'overhead_obstruction', label: 'Any overhead obstruction (wires/trees)?', type: 'yesno' },
      { id: 'unload_to_install_distance', label: 'Distance from unloading point to installation point', type: 'text' },
      { id: 'local_crane_vendor_available', label: 'Local Crane Vendor Available?', type: 'yesno' },
      { id: 'crane_owner_name', label: 'Crane Owner Name', type: 'text' },
      { id: 'crane_owner_contact', label: 'Contact Number', type: 'text' },
      { id: 'crane_distance_from_site', label: 'Distance from site', type: 'text' },
    ],
  },
  {
    id: 'tactile_tile',
    title: 'Section 9 — Tactile Tile Installation',
    fields: [
      { id: 'tactile_path_required', label: 'Path required from gate to key locations?', type: 'yesno' },
      { id: 'tactile_path_length_m', label: 'Proposed path length (meters)', type: 'number' },
      {
        id: 'tactile_surface_condition',
        label: 'Surface condition',
        type: 'dropdown',
        options: ['Concrete', 'Soil', 'Tiles'],
      },
      { id: 'tactile_level_difference', label: 'Level difference along path?', type: 'text' },
      { id: 'tactile_obstacles', label: 'Obstacles (steps/poles/drains)?', type: 'text' },
    ],
  },
  {
    id: 'braille_signage',
    title: 'Section 10 — Braille Signage',
    fields: [
      { id: 'signage_room_count', label: 'Number of rooms requiring signage', type: 'number' },
      { id: 'signage_room_types', label: 'Types of rooms', type: 'dropdown', options: ROOM_TYPE_OPTIONS },
      {
        id: 'signage_mounting_surface',
        label: 'Mounting surface',
        type: 'dropdown',
        options: ['Wall', 'Door'],
      },
      { id: 'signage_mounting_height_feasible', label: 'Mounting height feasible?', type: 'yesno' },
      { id: 'signage_visibility_adequate', label: 'Visibility and accessibility adequate?', type: 'yesno' },
    ],
  },
  {
    id: 'braille_layout',
    title: 'Section 11 — Braille Layout Map of School',
    fields: [
      { id: 'layout_drawing_available', label: 'School layout drawing available?', type: 'yesno' },
      {
        id: 'layout_sketch_prepared',
        label: 'Sketch prepared during survey?',
        type: 'yesno',
        showIf: { fieldId: 'layout_drawing_available', equals: false },
      },
      { id: 'layout_entry_exit_marked', label: 'Entry/Exit points marked?', type: 'yesno' },
      { id: 'layout_all_blocks_marked', label: 'All blocks/rooms marked?', type: 'yesno' },
      { id: 'layout_open_areas_included', label: 'Open areas/playgrounds included?', type: 'yesno' },
    ],
  },
  {
    id: 'leveling_civil',
    title: 'Section 12 — Leveling & Civil Requirements',
    fields: [
      { id: 'ground_leveling_required', label: 'Ground leveling required?', type: 'yesno' },
      { id: 'estimated_leveling_area', label: 'Estimated leveling area', type: 'text' },
      { id: 'foundation_required', label: 'Foundation required?', type: 'yesno' },
      { id: 'drainage_provision_required', label: 'Drainage provision required?', type: 'yesno' },
    ],
  },
  {
    id: 'safety_risk',
    title: 'Section 13 — Safety & Risk Identification',
    fields: [
      { id: 'hazard_open_drains', label: 'Open drains', type: 'yesno' },
      { id: 'hazard_electrical', label: 'Electrical hazards', type: 'yesno' },
      { id: 'hazard_structural', label: 'Structural risks', type: 'yesno' },
      { id: 'work_obstruction_anticipated', label: 'Work obstruction anticipated?', type: 'yesno' },
    ],
  },
  {
    id: 'execution_challenges',
    title: 'Section 14 — Execution Challenges & Solutions',
    fields: [
      { id: 'issue_identified', label: 'Issue Identified', type: 'text' },
      { id: 'proposed_solution', label: 'Proposed Solution', type: 'text' },
    ],
  },
  {
    id: 'final_feasibility',
    title: 'Section 16 — Final Feasibility Summary',
    fields: [
      { id: 'toilet_feasible', label: 'CWSN Toilet Feasible?', type: 'yesno', required: true },
      { id: 'ramp_feasible', label: 'Ramp Feasible?', type: 'yesno', required: true },
      { id: 'tactile_tile_feasible', label: 'Tactile Tile Feasible?', type: 'yesno', required: true },
      { id: 'braille_signage_feasible', label: 'Braille Signage Feasible?', type: 'yesno', required: true },
      { id: 'overall_site_ready', label: 'Overall Site Ready for Execution?', type: 'yesno', required: true },
    ],
  },
]

/** Section 15 — the 10 mandatory named photo angles, in required order. */
export const MANDATORY_PHOTO_SLOTS: { id: string; label: string }[] = [
  { id: 'main_gate', label: 'Main Gate' },
  { id: 'school_board', label: 'School Board' },
  { id: 'toilet_location', label: 'Toilet Location' },
  { id: 'water_point', label: 'Water Point' },
  { id: 'sewer_point', label: 'Sewer Point' },
  { id: 'electrical_point', label: 'Electrical Point' },
  { id: 'ramp_alignment', label: 'Ramp Alignment' },
  { id: 'tactile_route', label: 'Tactile Route' },
  { id: 'braille_location', label: 'Braille Location' },
  { id: 'overall_panorama', label: 'Overall Panorama' },
]

/** Answer map keyed by QuestionnaireField.id. */
export type AnswerValue = string | boolean | number | null
export type Answers = Record<string, AnswerValue>

/** Flatten all fields across sections (useful for validation). */
export function allFields(): QuestionnaireField[] {
  return QUESTIONNAIRE.flatMap((s) => s.fields)
}

/** Returns the first missing-required-field error message, or null if valid. */
export function validateAnswers(answers: Answers): string | null {
  for (const section of QUESTIONNAIRE) {
    for (const field of section.fields) {
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
