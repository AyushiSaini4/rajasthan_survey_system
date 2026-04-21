import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getLocationDetailData, getFieldAgents } from '@/lib/supabase/location-detail'
import LocationTimeline from '@/components/admin/LocationTimeline'
import LocationStatusBadge from '@/components/shared/LocationStatusBadge'
import AssignUnitSection from '@/components/admin/AssignUnitSection'
import AssignAgentSection from '@/components/admin/AssignAgentSection'
import type { QCInspection } from '@/types'

export const dynamic = 'force-dynamic'

interface Props { params: { id: string } }

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ConditionBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-gray-400">—</span>
  const colour = value === 'good' ? 'bg-green-100 text-green-700' : value === 'damaged' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${colour}`}>{value}</span>
}

function BoolCell({ value }: { value: boolean | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-gray-400">—</span>
  return value ? <span className="text-green-600 font-medium">Yes</span> : <span className="text-red-500 font-medium">No</span>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-5 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function InfoGrid({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
          <dd className="mt-0.5 text-sm text-gray-900">{value ?? <span className="text-gray-400">—</span>}</dd>
        </div>
      ))}
    </dl>
  )
}

function QCCard({ qc }: { qc: QCInspection }) {
  const isPassed = qc.result === 'passed'
  return (
    <div className={`rounded-lg border p-4 ${isPassed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">Inspection #{qc.inspection_number}</span>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${isPassed ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {qc.result ?? 'Pending'}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
        <div><dt className="text-xs text-gray-500">Inspector</dt><dd className="font-medium">{qc.inspector_name ?? '—'}</dd></div>
        <div><dt className="text-xs text-gray-500">Date</dt><dd>{formatDate(qc.inspected_at)}</dd></div>
        <div><dt className="text-xs text-gray-500">Qty correct</dt><dd><BoolCell value={qc.qty_correct} /></dd></div>
        <div><dt className="text-xs text-gray-500">Dimensions correct</dt><dd><BoolCell value={qc.dimensions_correct} /></dd></div>
        <div><dt className="text-xs text-gray-500">Finish quality</dt><dd><BoolCell value={qc.finish_quality_pass} /></dd></div>
        <div><dt className="text-xs text-gray-500">Defects present</dt><dd><BoolCell value={qc.defects_present} /></dd></div>
      </dl>
      {qc.overall_notes && <p className="text-xs text-gray-600 italic border-t border-gray-200 pt-2 mt-2">&ldquo;{qc.overall_notes}&rdquo;</p>}
      {qc.rework_required && <p className="text-xs text-red-700 mt-2 font-medium">⚠ Rework required{qc.rework_deadline ? ` — deadline: ${qc.rework_deadline}` : ''}</p>}
      {qc.pdf_url && <a href={qc.pdf_url} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs text-blue-600 hover:underline">View QC PDF ↗</a>}
    </div>
  )
}

export default async function LocationDetailPage({ params }: Props) {
  const [data, agents] = await Promise.all([
    getLocationDetailData(params.id),
    getFieldAgents(),
  ])

  if (!data) notFound()

  const { location, survey, surveyPhotoUrls, activeUnits, productionJob, assignedUnit, qcInspections } = data

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      <div>
        <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          All Locations
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{location.location_code}</span>
            <LocationStatusBadge status={location.status} size="md" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{location.name ?? 'Unnamed Location'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{location.address ?? '—'}</p>
        </div>
      </div>

      <LocationTimeline currentStatus={location.status} />

      <Section title="Location Details">
        <InfoGrid rows={[
          ['Code', location.location_code],
          ['Name', location.name],
          ['District', location.district],
          ['Block', location.block],
          ['Village', location.village],
          ['Address', location.address],
          ['GPS', (location.latitude && location.longitude) ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : null],
          ['Status', <LocationStatusBadge key="status" status={location.status} size="sm" />],
          ['Assigned Unit', assignedUnit ? assignedUnit.name : null],
          ['Created', formatDate(location.created_at)],
        ]} />
      </Section>

      {/* ── Assign Field Agent ── always visible to admin ── */}
      <Section title="Assign Field Agent">
        <AssignAgentSection
          locationId={location.id}
          agents={agents}
          currentAgentId={location.assigned_agent}
        />
      </Section>

      {survey ? (
        <Section title="Survey Data">
          <div className="space-y-5">
            <InfoGrid rows={[
              ['Submitted', formatDate(survey.submitted_at)],
              ['Synced', formatDate(survey.synced_at)],
              ['GPS (survey)', (survey.gps_lat && survey.gps_lng) ? `${survey.gps_lat.toFixed(6)}, ${survey.gps_lng.toFixed(6)}` : null],
              ['GPS accuracy', survey.gps_accuracy ? `${survey.gps_accuracy.toFixed(0)} m` : null],
              ['Offline submission', survey.is_offline_submission ? 'Yes' : 'No'],
            ]} />
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Infrastructure Checklist</h3>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 border border-gray-200">Item</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 border border-gray-200">Present</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 border border-gray-200">Condition</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="px-3 py-2 border border-gray-200 font-medium">Toilet</td><td className="px-3 py-2 border border-gray-200"><BoolCell value={survey.toilet_present} /></td><td className="px-3 py-2 border border-gray-200"><ConditionBadge value={survey.toilet_condition} /></td></tr>
                  <tr className="bg-gray-50"><td className="px-3 py-2 border border-gray-200 font-medium">Ramp</td><td className="px-3 py-2 border border-gray-200"><BoolCell value={survey.ramp_present} /></td><td className="px-3 py-2 border border-gray-200"><ConditionBadge value={survey.ramp_condition} /></td></tr>
                  <tr><td className="px-3 py-2 border border-gray-200 font-medium">Hardware / Fittings</td><td className="px-3 py-2 border border-gray-200">—</td><td className="px-3 py-2 border border-gray-200"><ConditionBadge value={survey.hardware_condition} /></td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Material Quantities Required</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[['Tiles (sq ft)', survey.qty_tiles],['Toilet Units', survey.qty_toilet_units],['Ramp Units', survey.qty_ramp_units],['Fitting Sets', survey.qty_fittings]].map(([label, value]) => (
                  <div key={label as string} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
                    <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            {survey.notes && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded p-3 border border-gray-200">{survey.notes}</p>
              </div>
            )}
            {surveyPhotoUrls.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Photos ({surveyPhotoUrls.length})</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {surveyPhotoUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Survey photo ${i + 1}`} className="w-full h-36 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      ) : (
        <Section title="Survey Data">
          <p className="text-sm text-gray-500 italic">No survey submitted yet for this location.</p>
        </Section>
      )}

      {location.status === 'surveyed' && (
        <Section title="Assign to Manufacturing Unit">
          <AssignUnitSection locationId={location.id} activeUnits={activeUnits} />
        </Section>
      )}

      {productionJob && (
        <Section title="Production Job">
          <div className="space-y-4">
            <InfoGrid rows={[
              ['Job ID', <span key="jid" className="font-mono text-xs">{productionJob.id}</span>],
              ['Unit', assignedUnit?.name ?? productionJob.unit_id],
              ['Assigned', formatDate(productionJob.assigned_at)],
              ['Status', <span key="pjst" className={['inline-block px-2 py-0.5 rounded text-xs font-semibold capitalize', productionJob.status === 'qc_passed' ? 'bg-green-100 text-green-700' : productionJob.status === 'qc_failed' ? 'bg-red-100 text-red-700' : productionJob.status === 'dispatched' ? 'bg-purple-100 text-purple-700' : productionJob.status === 'complete' ? 'bg-blue-100 text-blue-700' : productionJob.status === 'in_production' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'].join(' ')}>{productionJob.status.replace(/_/g, ' ')}</span>],
              ['Completed', formatDate(productionJob.completed_at)],
              ['Dispatched', formatDate(productionJob.dispatched_at)],
            ]} />
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500">Production Progress</span>
                <span className="text-xs font-bold text-gray-700">{productionJob.progress_pct}%</span>
              </div>
              <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${productionJob.progress_pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${productionJob.progress_pct}%` }} />
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quantities to Produce</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[['Tiles (sq ft)', productionJob.qty_tiles],['Toilet Units', productionJob.qty_toilet_units],['Ramp Units', productionJob.qty_ramp_units],['Fitting Sets', productionJob.qty_fittings]].map(([label, value]) => (
                  <div key={label as string} className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
                    <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            {productionJob.production_notes && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</h3>
                <p className="text-sm text-gray-700 bg-gray-50 rounded p-3 border border-gray-200 whitespace-pre-wrap">{productionJob.production_notes}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {qcInspections.length > 0 && (
        <Section title={`QC Inspections (${qcInspections.length})`}>
          <div className="space-y-3">
            {qcInspections.map((qc) => <QCCard key={qc.id} qc={qc} />)}
          </div>
        </Section>
      )}
    </div>
  )
}
