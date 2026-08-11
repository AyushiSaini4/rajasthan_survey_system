'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Timeline {
  location_code: string
  name: string | null
  district: string
  block: string
  status: string
  pending_since: string | null
  surveyed_at: string | null
  assigned_at: string | null
  assigned_unit_name: string | null
  production_status: string | null
  production_completed_at: string | null
  dispatched_at: string | null
  qc_result: string | null
  qc_at: string | null
  delivered_at: string | null
  installed_at: string | null
  installation_status: string | null
  verified_at: string | null
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

// A stage only appears on the timeline once its timestamp exists — nothing
// is inferred or estimated, so a location with, say, no QC record yet simply
// shows fewer entries rather than a guessed/placeholder one.
function buildStages(t: Timeline): Array<{ label: string; at: string | null; detail?: string; tone: 'done' | 'failed' }> {
  const stages: Array<{ label: string; at: string | null; detail?: string; tone: 'done' | 'failed' }> = []

  stages.push({ label: 'Added to project', at: t.pending_since, tone: 'done' })
  if (t.surveyed_at) stages.push({ label: 'Field survey completed', at: t.surveyed_at, tone: 'done' })
  if (t.assigned_at) stages.push({ label: 'Assigned to manufacturing unit', at: t.assigned_at, detail: t.assigned_unit_name ?? undefined, tone: 'done' })
  if (t.production_completed_at) stages.push({ label: 'Production completed', at: t.production_completed_at, tone: 'done' })
  if (t.qc_at) stages.push({ label: t.qc_result === 'failed' ? 'Factory QC — failed' : 'Factory QC — passed', at: t.qc_at, tone: t.qc_result === 'failed' ? 'failed' : 'done' })
  if (t.dispatched_at) stages.push({ label: 'Dispatched from unit', at: t.dispatched_at, tone: 'done' })
  if (t.delivered_at) stages.push({ label: 'Delivered on-site', at: t.delivered_at, tone: 'done' })
  if (t.installed_at) stages.push({ label: t.installation_status === 'rejected' ? 'Site report — rejected' : 'Site installation report filed', at: t.installed_at, tone: t.installation_status === 'rejected' ? 'failed' : 'done' })
  if (t.verified_at) stages.push({ label: 'Final approval — project closed', at: t.verified_at, tone: 'done' })

  return stages.sort((a, b) => new Date(a.at ?? 0).getTime() - new Date(b.at ?? 0).getTime())
}

export default function PublicLocationTimelinePage() {
  const params = useParams()
  const code = params.code as string

  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('public_location_timeline')
        .select('*')
        .eq('location_code', code)
        .maybeSingle()
      if (!data) { setNotFound(true); setLoading(false); return }
      setTimeline(data as Timeline)
      setLoading(false)
    }
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <nav className="border-b border-white/10 bg-white/5 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/public" className="text-slate-300 hover:text-white text-sm flex items-center gap-1.5">
            ← Back to dashboard
          </Link>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />Live
          </span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <svg className="w-6 h-6 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : notFound || !timeline ? (
          <p className="text-slate-500 text-sm">Location not found.</p>
        ) : (
          <>
            <span className="text-xs font-mono text-slate-500">{timeline.location_code}</span>
            <h1 className="text-2xl font-bold text-white mt-0.5 mb-1">{timeline.name ?? timeline.location_code}</h1>
            <p className="text-slate-400 text-sm mb-8">{titleCase(timeline.block)}, {titleCase(timeline.district)}</p>

            <div className="relative pl-6">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/10" />
              {buildStages(timeline).map((stage, i) => (
                <div key={i} className="relative pb-7 last:pb-0">
                  <span
                    className={`absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                      stage.tone === 'failed' ? 'bg-red-500' : 'bg-emerald-500'
                    }`}
                  />
                  <p className="text-sm font-semibold text-white">{stage.label}</p>
                  {stage.detail && <p className="text-xs text-slate-400 mt-0.5">{stage.detail}</p>}
                  <p className="text-xs text-slate-500 mt-0.5">{fmtDate(stage.at)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
