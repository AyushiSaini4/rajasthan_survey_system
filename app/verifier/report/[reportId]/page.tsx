import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserWithRole } from '@/lib/supabase/auth'
import { getInstallationReportById, getPublicStorageUrl } from '@/lib/supabase/installation'
import VerificationForm from '@/components/verifier/VerificationForm'

export const dynamic = 'force-dynamic'

interface Props {
  params: { reportId: string }
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function CheckRow({ label, value }: { label: string; value: boolean | null | undefined }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      {value === true ? (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
          ✓ Yes
        </span>
      ) : value === false ? (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
          ✗ No
        </span>
      ) : (
        <span className="text-xs text-gray-400">—</span>
      )}
    </div>
  )
}

export default async function VerifierReportPage({ params }: Props) {
  let user: Awaited<ReturnType<typeof getUserWithRole>>['user'] = null
  let role: Awaited<ReturnType<typeof getUserWithRole>>['role'] = null

  try {
    ;({ user, role } = await getUserWithRole())
  } catch {
    redirect('/login')
  }

  if (!user || role !== 'verifier') redirect('/login')

  let report: Awaited<ReturnType<typeof getInstallationReportById>> = null
  try {
    report = await getInstallationReportById(params.reportId)
  } catch {
    // fall through to notFound
  }
  if (!report) notFound()

  const photoUrls: string[] = (report.photos ?? []).map((p: string) =>
    getPublicStorageUrl('installation-media', p)
  )

  const signatureUrl = report.signature_data_url
    ? report.signature_data_url.startsWith('http')
      ? report.signature_data_url
      : getPublicStorageUrl('installation-media', report.signature_data_url)
    : null

  return (
    <div className="space-y-5 pb-10">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/verifier/dashboard" className="hover:text-gray-700">Dashboard</Link>
          <span>›</span>
          <span className="text-gray-900 font-medium">Installation Report</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Installation Report</h1>
        <p className="text-sm font-mono text-blue-600 mt-0.5">
          {report.location.location_code}
          {report.location.name ? ` — ${report.location.name}` : ''}
        </p>
        {(report.location.district || report.location.block) && (
          <p className="text-xs text-gray-400 mt-0.5">
            {[report.location.district, report.location.block, report.location.village]
              .filter(Boolean)
              .join(', ')}
          </p>
        )}
      </div>

      {/* PDF link */}
      {report.pdf_url && (
        <a
          href={report.pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          View Full PDF Report ↗
        </a>
      )}

      {/* Location details */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Location</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {[
            { label: 'Code', value: report.location.location_code },
            { label: 'Name', value: report.location.name ?? '—' },
            { label: 'District', value: report.location.district ?? '—' },
            { label: 'Block', value: report.location.block ?? '—' },
            { label: 'Village', value: report.location.village ?? '—' },
          ].map((item) => (
            <div key={item.label}>
              <dt className="text-xs text-gray-400">{item.label}</dt>
              <dd className="text-sm font-medium text-gray-900 mt-0.5">{item.value}</dd>
            </div>
          ))}
          {report.location.address && (
            <div className="col-span-2">
              <dt className="text-xs text-gray-400">Address</dt>
              <dd className="text-sm text-gray-700 mt-0.5">{report.location.address}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Submission metadata */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Submission Details</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <dt className="text-xs text-gray-400">Submitted</dt>
            <dd className="text-sm text-gray-900 mt-0.5">{fmtDateTime(report.submitted_at)}</dd>
          </div>
          {report.gps_lat != null && report.gps_lng != null && (
            <div>
              <dt className="text-xs text-gray-400">GPS Coordinates</dt>
              <dd className="text-xs font-mono text-gray-700 mt-0.5">
                {(report.gps_lat as number).toFixed(5)}, {(report.gps_lng as number).toFixed(5)}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Delivery confirmation */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Delivery Confirmation</h2>
        <div className="flex items-center gap-2">
          {report.delivery_confirmed ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
              ✓ Goods received on site
            </span>
          ) : (
            <span className="text-sm text-gray-400 italic">Not yet confirmed</span>
          )}
        </div>
        {report.goods_received_at && (
          <p className="text-xs text-gray-400 mt-1.5">
            Received: {fmtDate(report.goods_received_at)}
          </p>
        )}
      </div>

      {/* Installation checklist */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Installation Checklist</h2>
        <CheckRow label="Toilet installed" value={report.toilet_installed} />
        <CheckRow label="Ramp / accessible entry installed" value={report.ramp_installed} />
        <CheckRow label="Hardware / fittings installed" value={report.hardware_installed} />
        {report.installation_notes && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-1">Notes</p>
            <p className="text-sm text-gray-700">{report.installation_notes}</p>
          </div>
        )}
      </div>

      {/* Photos */}
      {photoUrls.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Photos ({photoUrls.length})
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {photoUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Installation photo ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Supervisor signature */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Supervisor Sign-off</h2>
        {signatureUrl ? (
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 mb-2 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signatureUrl}
              alt="Supervisor signature"
              className="max-h-28 mx-auto"
            />
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic mb-2">No signature on file</p>
        )}
        {report.signed_by_name && (
          <p className="text-sm font-semibold text-gray-900">{report.signed_by_name}</p>
        )}
        {report.signed_by_designation && (
          <p className="text-xs text-gray-500">{report.signed_by_designation}</p>
        )}
      </div>

      {/* Verification form */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
          Your Verification Decision
        </h2>
        <VerificationForm reportId={report.id} currentStatus={report.status} />
      </div>
    </div>
  )
}
