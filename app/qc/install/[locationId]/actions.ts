'use server'

import React from 'react'
import { getUserWithRole } from '@/lib/supabase/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { INSTALL_PHOTO_SLOTS } from '@/types'

// NOTE: this used to be the Field Agent's step (app/agent/install/...).
// Moved to QC Inspector — the site-visit "after report" is now a separate
// role from the person who reported the before-condition, matching the
// agency's real workflow (separation of duties between the field agent's
// survey/delivery and the QC inspector's independent verification).
// The `agent_id` column name is a holdover from that move; it now stores
// the submitting QC inspector's user id.

export interface InstallSubmission {
  locationId: string
  locationCode: string
  gpsLat: number | null
  gpsLng: number | null
  installationDate: string

  // Checklist — matches GeM Project Completion & Quality Certification
  cwsnUnitInstalled: boolean | null
  rampInstalled: boolean | null
  grabBarsInstalled: boolean | null
  brailleSignageInstalled: boolean | null
  brailleLayoutInstalled: boolean | null
  tactileTilesInstalled: boolean | null
  plumbingConnected: boolean | null
  electricalConnected: boolean | null
  functionalTestingPassed: boolean | null
  installationNotes: string

  // Media — categorized photos already uploaded by client, keyed by slot id → storage path
  namedPhotoPaths: Record<string, string>

  // Joint signatures — base64 PNG, uploaded server-side
  principalSignatureDataUrl: string
  principalName: string
  principalDesignation: string

  deptRepApplicable: boolean
  deptRepName: string
  deptRepDesignation: string
  deptRepSignatureDataUrl: string

  contractorName: string
  contractorSignatureDataUrl: string

  schoolSealAffixed: boolean | null
}

export interface InstallResult {
  success: boolean
  error?: string
  reportId?: string
  pdfUrl?: string
}

function getPublicUrl(bucket: string, path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`
}

async function uploadSignature(
  dataUrl: string,
  locationCode: string,
  slug: string,
  admin: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  if (!dataUrl) return null
  try {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    const path = `${locationCode}/install/${Date.now()}_${slug}_signature.png`
    const { error } = await admin.storage
      .from('installation-media')
      .upload(path, buffer, { contentType: 'image/png', upsert: false })
    if (error) { console.error(`[uploadSignature:${slug}]`, error.message); return null }
    return getPublicUrl('installation-media', path)
  } catch (e) {
    console.error(`[uploadSignature:${slug}]`, e)
    return null
  }
}

async function generatePDF(
  reportData: Parameters<typeof import('@/components/installation/PDFInstallReport').PDFInstallReport>[0]['data'],
  locationCode: string,
  admin: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  try {
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { PDFInstallReport } = await import('@/components/installation/PDFInstallReport')
    const pdfElement = React.createElement(PDFInstallReport, { data: reportData })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(pdfElement as any)

    const pdfPath = `${locationCode}/install/${Date.now()}_installation_report.pdf`
    const { error } = await admin.storage
      .from('reports')
      .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: false })
    if (error) { console.error('[generatePDF] upload:', error.message); return null }
    return getPublicUrl('reports', pdfPath)
  } catch (e) {
    console.error('[generatePDF]', e)
    return null
  }
}

export async function submitInstallationReport(
  submission: InstallSubmission
): Promise<InstallResult> {
  const { user, role } = await getUserWithRole()
  if (!user || role !== 'qc_inspector') return { success: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Upload the three joint signatures
  const principalSignatureUrl = await uploadSignature(submission.principalSignatureDataUrl, submission.locationCode, 'principal', admin)
  const deptRepSignatureUrl = submission.deptRepApplicable
    ? await uploadSignature(submission.deptRepSignatureDataUrl, submission.locationCode, 'dept_rep', admin)
    : null
  const contractorSignatureUrl = await uploadSignature(submission.contractorSignatureDataUrl, submission.locationCode, 'contractor', admin)

  // Check for existing report (from delivery step)
  const { data: existing } = await admin
    .from('installation_reports')
    .select('id')
    .eq('location_id', submission.locationId)
    .maybeSingle()

  let reportId: string

  const installFields = {
    agent_id: user.id,
    gps_lat: submission.gpsLat,
    gps_lng: submission.gpsLng,
    installation_date: submission.installationDate || null,

    cwsn_unit_installed: submission.cwsnUnitInstalled,
    ramp_installed: submission.rampInstalled,
    grab_bars_installed: submission.grabBarsInstalled,
    braille_signage_installed: submission.brailleSignageInstalled,
    braille_layout_installed: submission.brailleLayoutInstalled,
    tactile_tiles_installed: submission.tactileTilesInstalled,
    plumbing_connected: submission.plumbingConnected,
    electrical_connected: submission.electricalConnected,
    functional_testing_passed: submission.functionalTestingPassed,
    installation_notes: submission.installationNotes || null,

    named_photos: submission.namedPhotoPaths,
    // Keep legacy `photos` populated too so anything still reading the flat array works.
    photos: Object.values(submission.namedPhotoPaths),

    signature_data_url: principalSignatureUrl,
    signed_by_name: submission.principalName || null,
    signed_by_designation: submission.principalDesignation || null,

    dept_rep_applicable: submission.deptRepApplicable,
    dept_rep_name: submission.deptRepApplicable ? (submission.deptRepName || null) : null,
    dept_rep_designation: submission.deptRepApplicable ? (submission.deptRepDesignation || null) : null,
    dept_rep_signature_url: deptRepSignatureUrl,

    contractor_name: submission.contractorName || null,
    contractor_signature_url: contractorSignatureUrl,

    school_seal_affixed: submission.schoolSealAffixed,

    submitted_at: now,
    status: 'pending',
  }

  if (existing) {
    const { error } = await admin
      .from('installation_reports')
      .update(installFields)
      .eq('id', existing.id)
    if (error) {
      console.error('[submitInstallationReport] update:', error.message)
      return { success: false, error: 'Failed to save installation report. Please try again.' }
    }
    reportId = existing.id as string
  } else {
    const { data: inserted, error } = await admin
      .from('installation_reports')
      .insert({ location_id: submission.locationId, delivery_confirmed: false, ...installFields })
      .select('id')
      .single()
    if (error || !inserted) {
      console.error('[submitInstallationReport] insert:', error?.message)
      return { success: false, error: 'Failed to save installation report. Please try again.' }
    }
    reportId = inserted.id as string
  }

  // Update location status → 'installed'
  await admin.from('locations').update({ status: 'installed' }).eq('id', submission.locationId)

  // Fetch location details for PDF
  const { data: loc } = await admin
    .from('locations')
    .select('location_code, name, district, block, village, address')
    .eq('id', submission.locationId)
    .single()

  // Resolve named photo paths → public URLs, in fixed slot order, for the PDF
  const namedPhotoUrls = INSTALL_PHOTO_SLOTS
    .map(({ id }) => submission.namedPhotoPaths[id])
    .filter(Boolean)
    .map((p) => getPublicUrl('installation-media', p))

  // Generate PDF (non-fatal)
  const reportData = {
    locationCode: loc?.location_code ?? submission.locationCode,
    locationName: loc?.name ?? null,
    locationDistrict: loc?.district ?? null,
    locationBlock: loc?.block ?? null,
    locationVillage: loc?.village ?? null,
    locationAddress: loc?.address ?? null,
    gpsLat: submission.gpsLat,
    gpsLng: submission.gpsLng,
    submittedAt: now,
    installationDate: submission.installationDate || null,

    checklist: {
      cwsnUnitInstalled: submission.cwsnUnitInstalled,
      rampInstalled: submission.rampInstalled,
      grabBarsInstalled: submission.grabBarsInstalled,
      brailleSignageInstalled: submission.brailleSignageInstalled,
      brailleLayoutInstalled: submission.brailleLayoutInstalled,
      tactileTilesInstalled: submission.tactileTilesInstalled,
      plumbingConnected: submission.plumbingConnected,
      electricalConnected: submission.electricalConnected,
      functionalTestingPassed: submission.functionalTestingPassed,
    },
    installationNotes: submission.installationNotes || null,

    photoUrls: namedPhotoUrls,

    principalSignatureUrl,
    principalName: submission.principalName || null,
    principalDesignation: submission.principalDesignation || null,

    deptRepApplicable: submission.deptRepApplicable,
    deptRepSignatureUrl,
    deptRepName: submission.deptRepApplicable ? (submission.deptRepName || null) : null,
    deptRepDesignation: submission.deptRepApplicable ? (submission.deptRepDesignation || null) : null,

    contractorSignatureUrl,
    contractorName: submission.contractorName || null,

    schoolSealAffixed: submission.schoolSealAffixed,

    verificationStatus: null,
    verifierNotes: null,
    verifiedAt: null,
  }

  const pdfUrl = await generatePDF(reportData, submission.locationCode, admin)
  if (pdfUrl) {
    await admin
      .from('installation_reports')
      .update({ pdf_url: pdfUrl })
      .eq('id', reportId)
  }

  return { success: true, reportId, pdfUrl: pdfUrl ?? undefined }
}
