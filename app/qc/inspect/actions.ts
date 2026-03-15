'use server'

import React from 'react'
import { getUserWithRole } from '@/lib/supabase/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getInspectionCount } from '@/lib/supabase/qc'
import type { QCReportData } from '@/components/qc/PDFQCReport'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QCSubmissionData {
  jobId: string
  locationId: string
  locationCode: string

  // Checklist
  qtyCorrect: boolean | null
  qtyNotes: string
  dimensionsCorrect: boolean | null
  dimensionsNotes: string
  finishQualityPass: boolean | null
  finishNotes: string
  defectsPresent: boolean | null
  defectsDescription: string
  overallNotes: string

  // Media
  photoPaths: string[]       // already uploaded to qc-inspections by client
  signatureDataUrl: string   // base64 PNG data URL — uploaded server-side

  // Inspector
  inspectorName: string

  // Result
  result: 'passed' | 'failed'
  reworkDeadline: string     // ISO date string, only used if failed
}

export interface QCSubmitResult {
  success: boolean
  error?: string
  inspectionId?: string
  pdfUrl?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPublicUrl(bucket: string, path: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`
}

async function uploadSignature(
  signatureDataUrl: string,
  locationCode: string,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  try {
    const base64 = signatureDataUrl.replace(/^data:image\/png;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')
    const path = `${locationCode}/qc/${Date.now()}_signature.png`

    const { error } = await adminClient.storage
      .from('qc-inspections')
      .upload(path, buffer, { contentType: 'image/png', upsert: false })

    if (error) {
      console.error('[uploadSignature]', error.message)
      return null
    }

    return getPublicUrl('qc-inspections', path)
  } catch (err) {
    console.error('[uploadSignature] unexpected:', err)
    return null
  }
}

// ─── PDF generation ───────────────────────────────────────────────────────────
// Dynamic import avoids module-level browser-API issues with @react-pdf/renderer

async function generateAndUploadPDF(
  reportData: QCReportData,
  locationCode: string,
  inspectionNumber: number,
  adminClient: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  try {
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { PDFQCReport } = await import('@/components/qc/PDFQCReport')

    // renderToBuffer expects ReactElement<DocumentProps>. Our wrapper has
    // { data: QCReportData } as outer props but renders a <Document> internally.
    // Splitting into two statements lets the eslint-disable apply cleanly.
    const pdfElement = React.createElement(PDFQCReport, { data: reportData })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(pdfElement as any)

    const pdfPath = `${locationCode}/qc/${Date.now()}_inspection_${inspectionNumber}.pdf`

    const { error: uploadError } = await adminClient.storage
      .from('reports')
      .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: false })

    if (uploadError) {
      console.error('[generateAndUploadPDF] upload error:', uploadError.message)
      return null
    }

    return getPublicUrl('reports', pdfPath)
  } catch (err) {
    console.error('[generateAndUploadPDF] generation failed:', err)
    return null
  }
}

// ─── Main action ──────────────────────────────────────────────────────────────

export async function submitQCInspection(
  submission: QCSubmissionData
): Promise<QCSubmitResult> {

  // ── 1. Auth guard ──────────────────────────────────────────────────────────
  const { user, role } = await getUserWithRole()
  if (!user || role !== 'qc_inspector') {
    return { success: false, error: 'Unauthorized' }
  }

  const adminClient = createAdminClient()

  // ── 2. Verify job is still in 'complete' state ─────────────────────────────
  const { data: job, error: jobErr } = await adminClient
    .from('production_jobs')
    .select('id, status, location_id, unit_id')
    .eq('id', submission.jobId)
    .single()

  if (jobErr || !job) {
    return { success: false, error: 'Production job not found' }
  }

  if (job.status !== 'complete') {
    return { success: false, error: 'This job is no longer awaiting inspection' }
  }

  // ── 3. Get inspection number ───────────────────────────────────────────────
  const prevCount = await getInspectionCount(submission.jobId)
  const inspectionNumber = prevCount + 1

  // ── 4. Upload inspector signature ──────────────────────────────────────────
  const signatureUrl = await uploadSignature(
    submission.signatureDataUrl,
    submission.locationCode,
    adminClient
  )

  // ── 5. INSERT qc_inspections record ───────────────────────────────────────
  const inspectedAt = new Date().toISOString()
  const isPassed = submission.result === 'passed'

  const { data: inspection, error: insertErr } = await adminClient
    .from('qc_inspections')
    .insert({
      production_job_id: submission.jobId,
      location_id: submission.locationId,
      inspector_id: user.id,
      inspected_at: inspectedAt,
      inspection_number: inspectionNumber,
      qty_correct: submission.qtyCorrect,
      qty_notes: submission.qtyNotes || null,
      dimensions_correct: submission.dimensionsCorrect,
      dimensions_notes: submission.dimensionsNotes || null,
      finish_quality_pass: submission.finishQualityPass,
      finish_notes: submission.finishNotes || null,
      defects_present: submission.defectsPresent,
      defects_description: submission.defectsDescription || null,
      overall_notes: submission.overallNotes || null,
      result: submission.result,
      photos: submission.photoPaths,
      inspector_signature_url: signatureUrl,
      inspector_name: submission.inspectorName,
      rework_required: !isPassed,
      rework_deadline: (!isPassed && submission.reworkDeadline) ? submission.reworkDeadline : null,
      pdf_url: null, // set after PDF generation below
    })
    .select('id')
    .single()

  if (insertErr || !inspection) {
    console.error('[submitQCInspection] insert:', insertErr?.message)
    return { success: false, error: 'Failed to save inspection record. Please try again.' }
  }

  const inspectionId = inspection.id as string

  // ── 6. UPDATE production_job status ───────────────────────────────────────
  const newJobStatus = isPassed ? 'qc_passed' : 'qc_failed'
  await adminClient
    .from('production_jobs')
    .update({ status: newJobStatus })
    .eq('id', submission.jobId)

  // ── 7. UPDATE location status ─────────────────────────────────────────────
  const newLocStatus = isPassed ? 'qc_passed' : 'qc_failed'
  await adminClient
    .from('locations')
    .update({ status: newLocStatus })
    .eq('id', submission.locationId)

  // ── 8. Auto-unlock 'On QC Pass' payment tranche (only if passed) ───────────
  if (isPassed) {
    // Find any locked 'On QC Pass' tranches for contracts that cover this location.
    // payment_contracts may be linked directly to location_id.
    const { data: contracts } = await adminClient
      .from('payment_contracts')
      .select('id')
      .eq('location_id', submission.locationId)

    if (contracts && contracts.length > 0) {
      const contractIds = contracts.map((c: { id: string }) => c.id)
      await adminClient
        .from('payment_tranches')
        .update({
          status: 'unlocked',
          unlocked_at: new Date().toISOString(),
        })
        .in('contract_id', contractIds)
        .eq('trigger_milestone', 'qc_passed')
        .eq('status', 'locked')
    }
  }

  // ── 9. Generate PDF (non-fatal — inspection is already saved) ─────────────
  // Fetch location + unit details for the PDF
  const { data: loc } = await adminClient
    .from('locations')
    .select('location_code, name, district, block, village')
    .eq('id', submission.locationId)
    .single()

  const { data: unit } = await adminClient
    .from('manufacturing_units')
    .select('name')
    .eq('id', job.unit_id)
    .single()

  const reportData: QCReportData = {
    locationCode: loc?.location_code ?? submission.locationCode,
    locationName: loc?.name ?? null,
    locationDistrict: loc?.district ?? null,
    locationBlock: loc?.block ?? null,
    jobId: submission.jobId,
    unitName: unit?.name ?? 'Unknown Unit',
    inspectionDate: inspectedAt,
    inspectionNumber,
    qtyCorrect: submission.qtyCorrect,
    qtyNotes: submission.qtyNotes || null,
    dimensionsCorrect: submission.dimensionsCorrect,
    dimensionsNotes: submission.dimensionsNotes || null,
    finishQualityPass: submission.finishQualityPass,
    finishNotes: submission.finishNotes || null,
    defectsPresent: submission.defectsPresent,
    defectsDescription: submission.defectsDescription || null,
    overallNotes: submission.overallNotes || null,
    result: submission.result,
    reworkRequired: !isPassed,
    reworkDeadline: submission.reworkDeadline || null,
    photoUrls: submission.photoPaths.map((p) => getPublicUrl('qc-inspections', p)),
    signatureUrl,
    inspectorName: submission.inspectorName,
  }

  const pdfUrl = await generateAndUploadPDF(
    reportData,
    submission.locationCode,
    inspectionNumber,
    adminClient
  )

  // Back-patch pdf_url if generation succeeded
  if (pdfUrl) {
    await adminClient
      .from('qc_inspections')
      .update({ pdf_url: pdfUrl })
      .eq('id', inspectionId)
  }

  return {
    success: true,
    inspectionId,
    pdfUrl: pdfUrl ?? undefined,
  }
}
