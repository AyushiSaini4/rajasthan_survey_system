'use server'

import React from 'react'
import { getUserWithRole } from '@/lib/supabase/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export interface InstallSubmission {
  locationId: string
  locationCode: string
  gpsLat: number | null
  gpsLng: number | null

  // Checklist
  toiletInstalled: boolean | null
  rampInstalled: boolean | null
  hardwareInstalled: boolean | null
  installationNotes: string

  // Media — photos already uploaded by client
  photoPaths: string[]

  // Signature — base64 PNG, uploaded server-side
  signatureDataUrl: string
  signedByName: string
  signedByDesignation: string
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
  admin: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  try {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    const path = `${locationCode}/install/${Date.now()}_signature.png`
    const { error } = await admin.storage
      .from('installation-media')
      .upload(path, buffer, { contentType: 'image/png', upsert: false })
    if (error) { console.error('[uploadSignature]', error.message); return null }
    return getPublicUrl('installation-media', path)
  } catch (e) {
    console.error('[uploadSignature]', e)
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
  if (!user || role !== 'field_agent') return { success: false, error: 'Unauthorized' }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Upload signature
  const signatureUrl = await uploadSignature(
    submission.signatureDataUrl,
    submission.locationCode,
    admin
  )

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
    toilet_installed: submission.toiletInstalled,
    ramp_installed: submission.rampInstalled,
    hardware_installed: submission.hardwareInstalled,
    installation_notes: submission.installationNotes || null,
    photos: submission.photoPaths,
    signature_data_url: signatureUrl,
    signed_by_name: submission.signedByName || null,
    signed_by_designation: submission.signedByDesignation || null,
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
    toiletInstalled: submission.toiletInstalled,
    rampInstalled: submission.rampInstalled,
    hardwareInstalled: submission.hardwareInstalled,
    installationNotes: submission.installationNotes || null,
    photoUrls: submission.photoPaths.map((p) =>
      getPublicUrl('installation-media', p)
    ),
    signatureUrl,
    signedByName: submission.signedByName || null,
    signedByDesignation: submission.signedByDesignation || null,
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
