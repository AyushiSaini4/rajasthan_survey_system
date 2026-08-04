import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PrintButton from '@/components/admin/PrintButton'

/** qc-inspections is a public bucket — photos are stored as bare paths, build public URLs directly (no signing needed/possible issue). */
function publicUrl(bucket: string, path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!
  return `${base}/storage/v1/object/public/${bucket}/${path}`
}

export default async function QCReportPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: inspection } = await supabase
    .from('qc_inspections')
    .select(`
      *,
      locations ( location_code, name, district, block, village, address ),
      production_jobs ( id, qty_tiles, qty_toilet_units, qty_ramp_units, qty_fittings, manufacturing_units ( name, district, contact_name ) )
    `)
    .eq('id', params.id)
    .single()

  if (!inspection) notFound()

  const photoUrls: string[] = (inspection.photos ?? []).map((p: string) => publicUrl('qc-inspections', p))
  // inspector_signature_url is stored as a full public URL already (see app/qc/*/actions.ts uploadSignature) — used as-is.
  const signatureUrl: string | null = inspection.inspector_signature_url ?? null

  const loc = inspection.locations
  const unit = inspection.production_jobs?.manufacturing_units

  const checklistRows: [string, boolean | null, string | null][] = [
    ['Quantity Correct', inspection.qty_correct, inspection.qty_notes],
    ['Dimensions Correct', inspection.dimensions_correct, inspection.dimensions_notes],
    ['Finish Quality Pass', inspection.finish_quality_pass, inspection.finish_notes],
    ['Defects Present', inspection.defects_present, inspection.defects_description],
  ]

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <div className="max-w-3xl mx-auto px-4 py-8 print:px-0 print:py-0">

        <div className="flex items-center justify-between mb-6 print:hidden">
          <a href="/admin/qc" className="text-sm text-gray-500 hover:text-gray-800">← Back to QC Overview</a>
          <div className="flex items-center gap-2">
            {inspection.pdf_url && (
              <a href={inspection.pdf_url} target="_blank" rel="noreferrer"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
                ⬇ Download PDF
              </a>
            )}
            <PrintButton label={inspection.pdf_url ? '🖨 Print This Page' : '🖨 Print / Export PDF'} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-8 print:shadow-none print:ring-0 print:p-0">
          <div className="text-center border-b border-gray-200 pb-6 mb-6 print:pb-4 print:mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">SNIS Rajasthan</p>
            <h1 className="text-xl font-bold text-gray-900 mt-1">Quality Control Inspection Report</h1>
            <p className="text-sm text-gray-500 mt-1">
              Inspection #{inspection.inspection_number} — {new Date(inspection.inspected_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <span className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-bold ${
              inspection.result === 'passed' ? 'bg-green-100 text-green-700' :
              inspection.result === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {inspection.result === 'passed' ? '✓ PASSED' : inspection.result === 'failed' ? '✗ FAILED' : 'PENDING'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Location</p>
              <p className="font-medium text-gray-900">{loc?.name}</p>
              <p className="text-gray-500 font-mono text-xs">{loc?.location_code}</p>
              <p className="text-gray-500">{[loc?.village, loc?.block, loc?.district].filter(Boolean).join(', ')}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Manufacturing Unit</p>
              <p className="font-medium text-gray-900">{unit?.name ?? '—'}</p>
              <p className="text-gray-500">{unit?.contact_name ?? ''}</p>
              <p className="text-gray-500">{unit?.district ?? ''}</p>
            </div>
          </div>

          {inspection.production_jobs && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Quantities Produced</p>
              <div className="grid grid-cols-4 gap-3 text-center">
                {[['Tiles (sq ft)', inspection.production_jobs.qty_tiles], ['Toilet Units', inspection.production_jobs.qty_toilet_units], ['Ramp Units', inspection.production_jobs.qty_ramp_units], ['Fitting Sets', inspection.production_jobs.qty_fittings]].map(([label, val]) => (
                  <div key={label as string} className="bg-gray-50 rounded-lg p-2 print:border print:border-gray-200">
                    <p className="text-lg font-bold text-gray-900">{val ?? '—'}</p>
                    <p className="text-[10px] text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Inspection Checklist</p>
            <table className="w-full text-sm border-collapse">
              <tbody>
                {checklistRows.map(([label, val, notes]) => (
                  <tr key={label} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-medium text-gray-700 w-1/3">{label}</td>
                    <td className="py-2 pr-3 w-24">
                      {val === null ? <span className="text-gray-400">—</span> : val ? (
                        <span className="text-green-700 font-medium">Yes</span>
                      ) : (
                        <span className="text-red-600 font-medium">No</span>
                      )}
                    </td>
                    <td className="py-2 text-gray-500">{notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {inspection.overall_notes && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Overall Notes</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 print:border print:border-gray-200 print:bg-white whitespace-pre-wrap">{inspection.overall_notes}</p>
            </div>
          )}

          {inspection.rework_required && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-3 print:bg-white">
              <p className="text-sm font-semibold text-amber-800">Rework Required</p>
              {inspection.rework_deadline && (
                <p className="text-xs text-amber-700 mt-0.5">Deadline: {new Date(inspection.rework_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              )}
            </div>
          )}

          {photoUrls.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Photos ({photoUrls.length})</p>
              <div className="grid grid-cols-3 gap-2 print:grid-cols-4">
                {photoUrls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt={`Inspection photo ${i + 1}`} className="w-full h-28 object-cover rounded-lg border border-gray-200 print:h-24" />
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 pt-6 mt-6 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Inspector</p>
              {signatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={signatureUrl} alt="Inspector signature" className="h-14 border-b border-gray-300" />
              ) : (
                <div className="h-14 w-40 border-b border-gray-300" />
              )}
              <p className="text-sm text-gray-700 mt-1">{inspection.inspector_name ?? '—'}</p>
            </div>
            <p className="text-xs text-gray-400">Generated {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
