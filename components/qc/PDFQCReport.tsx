/**
 * QC Inspection PDF report — @react-pdf/renderer document.
 *
 * Spec (from CLAUDE.md):
 *  1. Header: Project name, "QC Inspection Report", Inspection #N
 *  2. Reference block: location code, job ID, unit name, inspection date
 *  3. Full checklist — each item: name | Pass/Fail | notes
 *  4. Photos — 2 per row, max 8, each with caption
 *  5. Overall result — large PASSED (green) or FAILED (red)
 *  6. Rework section — only if FAILED
 *  7. Inspector signature image + name
 *  8. Footer: generated timestamp, inspection number
 *
 * This file exports a React component that @react-pdf/renderer turns into a PDF.
 * It is imported and rendered via renderToBuffer() inside the server action.
 */

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QCReportData {
  // Identity
  locationCode: string
  locationName: string | null
  locationDistrict: string | null
  locationBlock: string | null
  jobId: string
  unitName: string
  inspectionDate: string       // ISO string
  inspectionNumber: number

  // Checklist
  qtyCorrect: boolean | null
  qtyNotes: string | null
  dimensionsCorrect: boolean | null
  dimensionsNotes: string | null
  finishQualityPass: boolean | null
  finishNotes: string | null
  defectsPresent: boolean | null
  defectsDescription: string | null
  overallNotes: string | null

  // Result
  result: 'passed' | 'failed'

  // Rework (if failed)
  reworkRequired: boolean
  reworkDeadline: string | null

  // Media
  photoUrls: string[]          // public URLs, max 8 shown
  signatureUrl: string | null  // public URL to PNG

  // Inspector
  inspectorName: string | null
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const C = {
  black:    '#111827',
  gray500:  '#6b7280',
  gray200:  '#e5e7eb',
  indigo:   '#4f46e5',
  green:    '#16a34a',
  red:      '#dc2626',
  greenBg:  '#dcfce7',
  redBg:    '#fee2e2',
  white:    '#ffffff',
}

const s = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    color: C.black,
    fontFamily: 'Helvetica',
  },

  // ── Header ────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: C.indigo,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: C.indigo,
  },
  headerSub: {
    fontSize: 10,
    color: C.gray500,
    marginTop: 2,
  },
  inspectionBadge: {
    backgroundColor: C.indigo,
    color: C.white,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
  },

  // ── Reference block ────────────────────────────────────────────────────────
  refBlock: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  refItem: {
    width: '48%',
  },
  refLabel: {
    fontSize: 8,
    color: C.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  refValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.black,
  },

  // ── Section ────────────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: C.black,
    marginBottom: 6,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Checklist ─────────────────────────────────────────────────────────────
  checkRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.gray200,
    paddingVertical: 6,
    alignItems: 'flex-start',
    gap: 8,
  },
  checkLabel: {
    flex: 2,
    fontSize: 10,
    color: C.black,
  },
  checkResult: {
    flex: 1,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  checkNotes: {
    flex: 3,
    fontSize: 9,
    color: C.gray500,
  },
  pass: { color: C.green },
  fail: { color: C.red },

  // ── Result banner ──────────────────────────────────────────────────────────
  resultBanner: {
    marginTop: 16,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  resultText: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2,
  },

  // ── Rework ────────────────────────────────────────────────────────────────
  reworkBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 6,
    padding: 10,
    backgroundColor: C.redBg,
  },
  reworkTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.red,
    marginBottom: 4,
  },
  reworkText: {
    fontSize: 9,
    color: '#7f1d1d',
  },

  // ── Photos ────────────────────────────────────────────────────────────────
  photoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  photoCell: {
    flex: 1,
  },
  photoImg: {
    width: '100%',
    height: 120,
    borderRadius: 4,
    objectFit: 'cover',
  },
  photoCaption: {
    fontSize: 8,
    color: C.gray500,
    marginTop: 2,
    textAlign: 'center',
  },

  // ── Signature ─────────────────────────────────────────────────────────────
  sigBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.gray200,
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  sigImg: {
    width: 160,
    height: 60,
    objectFit: 'contain',
  },
  sigName: {
    fontSize: 9,
    color: C.gray500,
    marginTop: 4,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: C.gray200,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 8,
    color: C.gray500,
  },
})

// ─── Helper ───────────────────────────────────────────────────────────────────

function fmt(v: boolean | null, trueLabel = 'Pass', falseLabel = 'Fail'): string {
  if (v === null || v === undefined) return '—'
  return v ? trueLabel : falseLabel
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return iso
  }
}

// ─── PDF Document ─────────────────────────────────────────────────────────────

export function PDFQCReport({ data }: { data: QCReportData }) {
  const isPass = data.result === 'passed'
  const photos = data.photoUrls.slice(0, 8) // max 8

  // Group photos into pairs for 2-per-row layout
  const photoRows: string[][] = []
  for (let i = 0; i < photos.length; i += 2) {
    photoRows.push(photos.slice(i, i + 2))
  }

  return (
    <Document
      title={`QC Inspection #${data.inspectionNumber} — ${data.locationCode}`}
      author="Rajasthan Special Needs Infrastructure System"
    >
      <Page size="A4" style={s.page}>

        {/* ── 1. Header ─────────────────────────────────────────────────── */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerTitle}>QC Inspection Report</Text>
            <Text style={s.headerSub}>Rajasthan Special Needs Infrastructure Project</Text>
          </View>
          <Text style={s.inspectionBadge}>Inspection #{data.inspectionNumber}</Text>
        </View>

        {/* ── 2. Reference block ────────────────────────────────────────── */}
        <View style={s.refBlock}>
          <View style={s.refItem}>
            <Text style={s.refLabel}>Location Code</Text>
            <Text style={s.refValue}>{data.locationCode}</Text>
          </View>
          <View style={s.refItem}>
            <Text style={s.refLabel}>Location Name</Text>
            <Text style={s.refValue}>{data.locationName ?? '—'}</Text>
          </View>
          <View style={s.refItem}>
            <Text style={s.refLabel}>Manufacturing Unit</Text>
            <Text style={s.refValue}>{data.unitName}</Text>
          </View>
          <View style={s.refItem}>
            <Text style={s.refLabel}>Inspection Date</Text>
            <Text style={s.refValue}>{fmtDate(data.inspectionDate)}</Text>
          </View>
          <View style={s.refItem}>
            <Text style={s.refLabel}>District</Text>
            <Text style={s.refValue}>{data.locationDistrict ?? '—'}</Text>
          </View>
          <View style={s.refItem}>
            <Text style={s.refLabel}>Production Job ID</Text>
            <Text style={{ ...s.refValue, fontSize: 8 }}>{data.jobId}</Text>
          </View>
        </View>

        {/* ── 3. Checklist ─────────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Inspection Checklist</Text>

        {/* Header row */}
        <View style={{ ...s.checkRow, backgroundColor: '#f3f4f6' }}>
          <Text style={{ ...s.checkLabel, fontFamily: 'Helvetica-Bold' }}>Item</Text>
          <Text style={{ ...s.checkResult, fontFamily: 'Helvetica-Bold' }}>Result</Text>
          <Text style={{ ...s.checkNotes, fontFamily: 'Helvetica-Bold' }}>Notes</Text>
        </View>

        <View style={s.checkRow}>
          <Text style={s.checkLabel}>Quantities correct</Text>
          <Text style={{ ...s.checkResult, ...(data.qtyCorrect ? s.pass : s.fail) }}>
            {fmt(data.qtyCorrect)}
          </Text>
          <Text style={s.checkNotes}>{data.qtyNotes || '—'}</Text>
        </View>

        <View style={s.checkRow}>
          <Text style={s.checkLabel}>Dimensions correct</Text>
          <Text style={{ ...s.checkResult, ...(data.dimensionsCorrect ? s.pass : s.fail) }}>
            {fmt(data.dimensionsCorrect)}
          </Text>
          <Text style={s.checkNotes}>{data.dimensionsNotes || '—'}</Text>
        </View>

        <View style={s.checkRow}>
          <Text style={s.checkLabel}>Finish quality acceptable</Text>
          <Text style={{ ...s.checkResult, ...(data.finishQualityPass ? s.pass : s.fail) }}>
            {fmt(data.finishQualityPass)}
          </Text>
          <Text style={s.checkNotes}>{data.finishNotes || '—'}</Text>
        </View>

        <View style={s.checkRow}>
          <Text style={s.checkLabel}>Defects present</Text>
          <Text style={{ ...s.checkResult, ...(data.defectsPresent ? s.fail : s.pass) }}>
            {fmt(data.defectsPresent, 'Yes — Defects', 'No Defects')}
          </Text>
          <Text style={s.checkNotes}>{data.defectsDescription || '—'}</Text>
        </View>

        {data.overallNotes && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 9, color: C.gray500, fontFamily: 'Helvetica-Bold' }}>Overall Notes:</Text>
            <Text style={{ fontSize: 9, color: C.black, marginTop: 2 }}>{data.overallNotes}</Text>
          </View>
        )}

        {/* ── 5. Overall result ─────────────────────────────────────────── */}
        <View style={{
          ...s.resultBanner,
          backgroundColor: isPass ? C.greenBg : C.redBg,
        }}>
          <Text style={{ ...s.resultText, color: isPass ? C.green : C.red }}>
            {isPass ? '✓  PASSED' : '✗  FAILED'}
          </Text>
        </View>

        {/* ── 6. Rework section (only if failed) ───────────────────────── */}
        {!isPass && (
          <View style={s.reworkBox}>
            <Text style={s.reworkTitle}>Rework Required</Text>
            {data.reworkDeadline && (
              <Text style={s.reworkText}>
                Rework deadline: {fmtDate(data.reworkDeadline)}
              </Text>
            )}
            {data.defectsDescription && (
              <Text style={{ ...s.reworkText, marginTop: 4 }}>
                Issues: {data.defectsDescription}
              </Text>
            )}
            <Text style={{ ...s.reworkText, marginTop: 4, fontFamily: 'Helvetica-Bold' }}>
              A new QC inspection will be required after rework is complete.
            </Text>
          </View>
        )}

        {/* ── 4. Photos ─────────────────────────────────────────────────── */}
        {photoRows.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Inspection Photos</Text>
            {photoRows.map((row, rowIdx) => (
              <View key={rowIdx} style={s.photoRow}>
                {row.map((url, colIdx) => (
                  <View key={colIdx} style={s.photoCell}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image, not HTML <img> */}
                    <Image style={s.photoImg} src={url} />
                    <Text style={s.photoCaption}>Photo {rowIdx * 2 + colIdx + 1}</Text>
                  </View>
                ))}
                {/* Pad odd rows with an empty cell */}
                {row.length === 1 && <View style={s.photoCell} />}
              </View>
            ))}
          </>
        )}

        {/* ── 7. Inspector signature ────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Inspector Signature</Text>
        <View style={s.sigBox}>
          {data.signatureUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image, not HTML <img>
            <Image style={s.sigImg} src={data.signatureUrl} />
          ) : (
            <Text style={{ fontSize: 9, color: C.gray500 }}>Signature not available</Text>
          )}
          <Text style={s.sigName}>
            {data.inspectorName ?? 'Inspector'} — {fmtDate(data.inspectionDate)}
          </Text>
        </View>

        {/* ── 8. Footer ─────────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generated by system on {fmtDate(new Date().toISOString())}</Text>
          <Text style={s.footerText}>
            Inspection #{data.inspectionNumber} · {data.locationCode}
          </Text>
        </View>

      </Page>
    </Document>
  )
}
