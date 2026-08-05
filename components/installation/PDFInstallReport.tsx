/**
 * Installation Report PDF — @react-pdf/renderer document.
 *
 * Mirrors the GeM "Project Completion & Quality Certification" paper form:
 *  1.  Header: project name, "Installation Report"
 *  2.  Location block: code, name, district, block, village, address
 *  3.  GPS coordinates + installation date + submission timestamp
 *  4.  Installation checklist (9 items incl. functional testing)
 *  5.  Installation notes
 *  6.  Photo record — 2 per row
 *  7.  Joint signatures: Principal, Department Representative (if applicable), Contractor
 *  8.  School seal confirmation
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

export interface InstallChecklist {
  cwsnUnitInstalled: boolean | null
  rampInstalled: boolean | null
  grabBarsInstalled: boolean | null
  brailleSignageInstalled: boolean | null
  brailleLayoutInstalled: boolean | null
  tactileTilesInstalled: boolean | null
  plumbingConnected: boolean | null
  electricalConnected: boolean | null
  functionalTestingPassed: boolean | null
}

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
  installationDate: string | null

  checklist: InstallChecklist
  installationNotes: string | null

  photoUrls: string[]          // public URLs, categorized photo record in slot order

  principalSignatureUrl: string | null
  principalName: string | null
  principalDesignation: string | null

  deptRepApplicable: boolean
  deptRepSignatureUrl: string | null
  deptRepName: string | null
  deptRepDesignation: string | null

  contractorSignatureUrl: string | null
  contractorName: string | null

  schoolSealAffixed: boolean | null

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

  sigGrid: { flexDirection: 'row', gap: 8, marginTop: 6 },
  sigBox: { flex: 1, borderWidth: 1, borderColor: C.gray200, borderRadius: 6, padding: 10, alignItems: 'center' },
  sigBoxLabel: { fontSize: 8, color: C.gray500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, textAlign: 'center' },
  sigImg: { width: 120, height: 50, objectFit: 'contain' },
  sigName: { fontSize: 9, color: C.gray500, marginTop: 4, textAlign: 'center' },

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

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return iso }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

const CHECKLIST_ROWS: Array<{ key: keyof InstallChecklist; label: string }> = [
  { key: 'cwsnUnitInstalled', label: 'CWSN Accessible Unit' },
  { key: 'rampInstalled', label: 'Ramp' },
  { key: 'grabBarsInstalled', label: 'Grab Bars' },
  { key: 'brailleSignageInstalled', label: 'Braille Signage' },
  { key: 'brailleLayoutInstalled', label: 'Braille Layout Map' },
  { key: 'tactileTilesInstalled', label: 'Tactile Tiles' },
  { key: 'plumbingConnected', label: 'Plumbing Connection' },
  { key: 'electricalConnected', label: 'Electrical Connection' },
  { key: 'functionalTestingPassed', label: 'Functional Testing' },
]

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
            <Text style={s.headerTitle}>Project Completion & Quality Certification</Text>
            <Text style={s.headerSub}>Rajasthan Special Needs Infrastructure Project</Text>
          </View>
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.blue }}>{data.locationCode}</Text>
        </View>

        {/* 2. Location block */}
        <Text style={s.sectionTitle}>Location Details</Text>
        <View style={s.block}>
          <View style={s.row2}>
            <View style={s.cell}><Text style={s.label}>Location Code</Text><Text style={s.value}>{data.locationCode}</Text></View>
            <View style={s.cell}><Text style={s.label}>School Name</Text><Text style={s.value}>{data.locationName ?? '—'}</Text></View>
            <View style={s.cell}><Text style={s.label}>District</Text><Text style={s.valueNormal}>{data.locationDistrict ?? '—'}</Text></View>
            <View style={s.cell}><Text style={s.label}>Block</Text><Text style={s.valueNormal}>{data.locationBlock ?? '—'}</Text></View>
            <View style={s.cell}><Text style={s.label}>Village</Text><Text style={s.valueNormal}>{data.locationVillage ?? '—'}</Text></View>
            {data.locationAddress && (
              <View style={{ width: '100%' }}><Text style={s.label}>Address</Text><Text style={s.valueNormal}>{data.locationAddress}</Text></View>
            )}
          </View>
        </View>

        {/* 3. GPS + dates */}
        <Text style={s.sectionTitle}>Submission Details</Text>
        <View style={{ ...s.block, ...s.row2 }}>
          <View style={s.cell}><Text style={s.label}>Date of Installation</Text><Text style={s.valueNormal}>{fmtDate(data.installationDate)}</Text></View>
          <View style={s.cell}><Text style={s.label}>Report Submitted</Text><Text style={s.valueNormal}>{fmtDateTime(data.submittedAt)}</Text></View>
          {(data.gpsLat && data.gpsLng) && (
            <View style={s.cell}><Text style={s.label}>GPS Coordinates</Text><Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>{data.gpsLat.toFixed(6)}, {data.gpsLng.toFixed(6)}</Text></View>
          )}
        </View>

        {/* 4. Installation checklist */}
        <Text style={s.sectionTitle}>Installation Checklist</Text>
        <View style={{ ...s.checkRow, backgroundColor: C.grayBg }}>
          <Text style={{ ...s.checkLabel, fontFamily: 'Helvetica-Bold' }}>Item</Text>
          <Text style={{ ...s.checkResult, fontFamily: 'Helvetica-Bold' }}>Status</Text>
        </View>
        {CHECKLIST_ROWS.map((row) => {
          const val = data.checklist[row.key]
          return (
            <View key={row.key} style={s.checkRow}>
              <Text style={s.checkLabel}>{row.label}</Text>
              <Text style={{ ...s.checkResult, ...(val ? s.pass : s.fail) }}>{tick(val)}</Text>
            </View>
          )
        })}

        {/* 5. Installation notes */}
        {data.installationNotes && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 9, color: C.gray500, fontFamily: 'Helvetica-Bold' }}>Installation Notes:</Text>
            <Text style={{ fontSize: 9, color: C.black, marginTop: 2 }}>{data.installationNotes}</Text>
          </View>
        )}

        {/* 6. Photo record */}
        {photoRows.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Photo Record</Text>
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

        {/* 7. Joint signatures */}
        <Text style={s.sectionTitle}>Joint Signatures</Text>
        <View style={s.sigGrid}>
          <View style={s.sigBox}>
            <Text style={s.sigBoxLabel}>Principal / Head of Institution</Text>
            {data.principalSignatureUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image style={s.sigImg} src={data.principalSignatureUrl} />
            ) : (
              <Text style={{ fontSize: 8, color: C.gray500 }}>Not available</Text>
            )}
            {data.principalName && (
              <Text style={s.sigName}>
                {data.principalName}
                {data.principalDesignation ? ` — ${data.principalDesignation}` : ''}
              </Text>
            )}
          </View>

          <View style={s.sigBox}>
            <Text style={s.sigBoxLabel}>Department Representative</Text>
            {!data.deptRepApplicable ? (
              <Text style={{ fontSize: 8, color: C.gray500 }}>Not applicable</Text>
            ) : data.deptRepSignatureUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image style={s.sigImg} src={data.deptRepSignatureUrl} />
            ) : (
              <Text style={{ fontSize: 8, color: C.gray500 }}>Not available</Text>
            )}
            {data.deptRepApplicable && data.deptRepName && (
              <Text style={s.sigName}>
                {data.deptRepName}
                {data.deptRepDesignation ? ` — ${data.deptRepDesignation}` : ''}
              </Text>
            )}
          </View>

          <View style={s.sigBox}>
            <Text style={s.sigBoxLabel}>Authorized Rep. of Contractor</Text>
            {data.contractorSignatureUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image style={s.sigImg} src={data.contractorSignatureUrl} />
            ) : (
              <Text style={{ fontSize: 8, color: C.gray500 }}>Not available</Text>
            )}
            {data.contractorName && <Text style={s.sigName}>{data.contractorName}</Text>}
          </View>
        </View>

        {/* 8. School seal */}
        <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 9, color: C.gray500, fontFamily: 'Helvetica-Bold' }}>School Seal Affixed:</Text>
          <Text style={{ fontSize: 9, ...(data.schoolSealAffixed ? s.pass : s.fail) }}>{tick(data.schoolSealAffixed)}</Text>
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
