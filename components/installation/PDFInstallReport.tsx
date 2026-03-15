/**
 * Installation Report PDF — @react-pdf/renderer document.
 *
 * Spec sections (CLAUDE.md):
 *  1.  Header: project name, "Installation Report"
 *  2.  Location block: code, name, district, block, village, address
 *  3.  GPS coordinates + submission timestamp
 *  4.  Delivery confirmation block
 *  5.  Installation checklist (toilet / ramp / hardware)
 *  6.  Installation notes
 *  7.  Photos — 2 per row, max 6
 *  8.  Digital signature + signed by name & designation
 *  9.  Verification status (shown when approved)
 *  10. Footer
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

// ─── Data shape ───────────────────────────────────────────────────────────────

export interface InstallReportData {
  locationCode: string
  locationName: string | null
  locationDistrict: string | null
  locationBlock: string | null
  locationVillage: string | null
  locationAddress: string | null

  gpsLat: number | null
  gpsLng: number | null
  submittedAt: string

  toiletInstalled: boolean | null
  rampInstalled: boolean | null
  hardwareInstalled: boolean | null
  installationNotes: string | null

  photoUrls: string[]          // public URLs, max 6 shown
  signatureUrl: string | null
  signedByName: string | null
  signedByDesignation: string | null

  // Filled in after verifier approves
  verificationStatus: 'approved' | 'rejected' | null
  verifierNotes: string | null
  verifiedAt: string | null
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const C = {
  black: '#111827', gray500: '#6b7280', gray200: '#e5e7eb',
  blue: '#1d4ed8', green: '#16a34a', red: '#dc2626',
  greenBg: '#dcfce7', grayBg: '#f3f4f6', white: '#ffffff',
}

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: C.black, fontFamily: 'Helvetica' },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: C.blue },
  headerTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.blue },
  headerSub: { fontSize: 9, color: C.gray500, marginTop: 2 },

  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.black, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },

  block: { backgroundColor: C.grayBg, borderRadius: 6, padding: 12, marginBottom: 8 },
  row2: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '48%' },
  label: { fontSize: 8, color: C.gray500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  value: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.black },
  valueNormal: { fontSize: 10, color: C.black },

  checkRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.gray200, alignItems: 'center', gap: 8 },
  checkLabel: { flex: 2, fontSize: 10, color: C.black },
  checkResult: { flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  pass: { color: C.green },
  fail: { color: C.red },

  photoRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  photoCell: { flex: 1 },
  photoImg: { width: '100%', height: 120, borderRadius: 4, objectFit: 'cover' },
  photoCaption: { fontSize: 8, color: C.gray500, marginTop: 2, textAlign: 'center' },

  sigBox: { marginTop: 8, borderWidth: 1, borderColor: C.gray200, borderRadius: 6, padding: 10, alignItems: 'center' },
  sigImg: { width: 160, height: 60, objectFit: 'contain' },
  sigName: { fontSize: 9, color: C.gray500, marginTop: 4 },

  verifyBox: { marginTop: 12, borderRadius: 6, padding: 12 },
  verifyTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 4 },

  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.gray200, paddingTop: 6 },
  footerText: { fontSize: 8, color: C.gray500 },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tick(v: boolean | null): string {
  if (v === null || v === undefined) return '—'
  return v ? '✓ Yes' : '✗ No'
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return iso }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

// ─── Document ─────────────────────────────────────────────────────────────────

export function PDFInstallReport({ data }: { data: InstallReportData }) {
  const photos = data.photoUrls.slice(0, 6)
  const photoRows: string[][] = []
  for (let i = 0; i < photos.length; i += 2) photoRows.push(photos.slice(i, i + 2))

  return (
    <Document
      title={`Installation Report — ${data.locationCode}`}
      author="Rajasthan Special Needs Infrastructure System"
    >
      <Page size="A4" style={s.page}>

        {/* 1. Header */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerTitle}>Installation Report</Text>
            <Text style={s.headerSub}>Rajasthan Special Needs Infrastructure Project</Text>
          </View>
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.blue }}>{data.locationCode}</Text>
        </View>

        {/* 2. Location block */}
        <Text style={s.sectionTitle}>Location Details</Text>
        <View style={s.block}>
          <View style={s.row2}>
            <View style={s.cell}><Text style={s.label}>Location Code</Text><Text style={s.value}>{data.locationCode}</Text></View>
            <View style={s.cell}><Text style={s.label}>Location Name</Text><Text style={s.value}>{data.locationName ?? '—'}</Text></View>
            <View style={s.cell}><Text style={s.label}>District</Text><Text style={s.valueNormal}>{data.locationDistrict ?? '—'}</Text></View>
            <View style={s.cell}><Text style={s.label}>Block</Text><Text style={s.valueNormal}>{data.locationBlock ?? '—'}</Text></View>
            <View style={s.cell}><Text style={s.label}>Village</Text><Text style={s.valueNormal}>{data.locationVillage ?? '—'}</Text></View>
            {data.locationAddress && (
              <View style={{ width: '100%' }}><Text style={s.label}>Address</Text><Text style={s.valueNormal}>{data.locationAddress}</Text></View>
            )}
          </View>
        </View>

        {/* 3. GPS + timestamp */}
        <Text style={s.sectionTitle}>Submission Details</Text>
        <View style={{ ...s.block, ...s.row2 }}>
          <View style={s.cell}><Text style={s.label}>Submitted</Text><Text style={s.valueNormal}>{fmtDateTime(data.submittedAt)}</Text></View>
          {(data.gpsLat && data.gpsLng) && (
            <View style={s.cell}><Text style={s.label}>GPS Coordinates</Text><Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>{data.gpsLat.toFixed(6)}, {data.gpsLng.toFixed(6)}</Text></View>
          )}
        </View>

        {/* 5. Installation checklist */}
        <Text style={s.sectionTitle}>Installation Checklist</Text>
        <View style={{ ...s.checkRow, backgroundColor: C.grayBg }}>
          <Text style={{ ...s.checkLabel, fontFamily: 'Helvetica-Bold' }}>Item</Text>
          <Text style={{ ...s.checkResult, fontFamily: 'Helvetica-Bold' }}>Status</Text>
        </View>
        {[
          { label: 'Toilet installed', val: data.toiletInstalled },
          { label: 'Ramp installed', val: data.rampInstalled },
          { label: 'Hardware / fittings installed', val: data.hardwareInstalled },
        ].map((item) => (
          <View key={item.label} style={s.checkRow}>
            <Text style={s.checkLabel}>{item.label}</Text>
            <Text style={{ ...s.checkResult, ...(item.val ? s.pass : s.fail) }}>{tick(item.val)}</Text>
          </View>
        ))}

        {/* 6. Installation notes */}
        {data.installationNotes && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 9, color: C.gray500, fontFamily: 'Helvetica-Bold' }}>Installation Notes:</Text>
            <Text style={{ fontSize: 9, color: C.black, marginTop: 2 }}>{data.installationNotes}</Text>
          </View>
        )}

        {/* 7. Photos */}
        {photoRows.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Installation Photos</Text>
            {photoRows.map((row, ri) => (
              <View key={ri} style={s.photoRow}>
                {row.map((url, ci) => (
                  <View key={ci} style={s.photoCell}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image style={s.photoImg} src={url} />
                    <Text style={s.photoCaption}>Photo {ri * 2 + ci + 1}</Text>
                  </View>
                ))}
                {row.length === 1 && <View style={s.photoCell} />}
              </View>
            ))}
          </>
        )}

        {/* 8. Signature */}
        <Text style={s.sectionTitle}>Supervisor Signature</Text>
        <View style={s.sigBox}>
          {data.signatureUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image style={s.sigImg} src={data.signatureUrl} />
          ) : (
            <Text style={{ fontSize: 9, color: C.gray500 }}>Signature not available</Text>
          )}
          {data.signedByName && (
            <Text style={s.sigName}>
              {data.signedByName}
              {data.signedByDesignation ? ` — ${data.signedByDesignation}` : ''}
              {' · '}{fmtDate(data.submittedAt)}
            </Text>
          )}
        </View>

        {/* 9. Verification status */}
        {data.verificationStatus && (
          <>
            <Text style={s.sectionTitle}>Verification</Text>
            <View style={{ ...s.verifyBox, backgroundColor: data.verificationStatus === 'approved' ? C.greenBg : '#fee2e2' }}>
              <Text style={{ ...s.verifyTitle, color: data.verificationStatus === 'approved' ? C.green : C.red }}>
                {data.verificationStatus === 'approved' ? '✓ APPROVED' : '✗ REJECTED'}
              </Text>
              {data.verifiedAt && <Text style={{ fontSize: 9, color: C.gray500 }}>{fmtDate(data.verifiedAt)}</Text>}
              {data.verifierNotes && <Text style={{ fontSize: 9, color: C.black, marginTop: 4 }}>{data.verifierNotes}</Text>}
            </View>
          </>
        )}

        {/* 10. Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generated by system on {fmtDate(new Date().toISOString())}</Text>
          <Text style={s.footerText}>{data.locationCode} — Installation Report</Text>
        </View>

      </Page>
    </Document>
  )
}
