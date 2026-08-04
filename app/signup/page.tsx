'use client'

import { Suspense, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type SignupRole = 'field_agent' | 'manufacturing_unit' | 'qc_inspector'

const ROLE_META: Record<SignupRole, { title: string; icon: JSX.Element; blurb: string }> = {
  field_agent: {
    title: 'Field Agent',
    blurb: 'Conduct on-site CWSN infrastructure surveys',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />,
  },
  manufacturing_unit: {
    title: 'Manufacturing Unit',
    blurb: 'Produce and dispatch approved infrastructure',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" />,
  },
  qc_inspector: {
    title: 'QC Inspector',
    blurb: 'Inspect completed production before dispatch',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />,
  },
}

function SignUpForm() {
  const searchParams = useSearchParams()
  const preselected = searchParams.get('role') as SignupRole | null
  const [role, setRole] = useState<SignupRole | null>(
    preselected && preselected in ROLE_META ? preselected : null,
  )

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [unitName, setUnitName] = useState('')
  const [unitDistrict, setUnitDistrict] = useState('')
  const [unitContactName, setUnitContactName] = useState('')
  const [unitContactPhone, setUnitContactPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!role) { setError('Please select what you\'ll be doing.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (role === 'manufacturing_unit' && !unitName.trim()) { setError('Unit name is required.'); return }

    setLoading(true)
    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // user_metadata (client-writable) — a database trigger validates
        // this and copies it into app_metadata.role server-side. The
        // client can never set app_metadata directly, so this can't be
        // used to request 'admin'.
        data: {
          requested_role: role,
          ...(role === 'manufacturing_unit' ? {
            unit_name: unitName.trim(),
            unit_district: unitDistrict.trim(),
            unit_contact_name: unitContactName.trim(),
            unit_contact_phone: unitContactPhone.trim(),
          } : {}),
        },
      },
    })
    if (signUpError) { setError(signUpError.message ?? 'Sign-up failed.'); setLoading(false); return }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError) { setSuccess(true); setLoading(false); return }
    router.push('/'); router.refresh()
  }

  if (success) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-2xl">
            <svg className="h-9 w-9 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
          </div>
          <h2 className="text-xl font-bold text-white">Check your email</h2>
          <p className="text-slate-400 text-sm max-w-xs">We sent a confirmation link to <strong className="text-white">{email}</strong>.</p>
          <Link href="/login" className="inline-block text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition">← Back to Sign in</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-2xl mb-4">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              {role ? ROLE_META[role].icon : <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />}
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Create Account</h1>
          <p className="text-slate-400 text-sm mt-1">SNIS Rajasthan Survey System</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 shadow-2xl border border-white/10">
          {!role ? (
            <>
              <p className="text-slate-300 text-xs font-semibold uppercase tracking-widest mb-3">What will you be doing?</p>
              <div className="space-y-2">
                {(Object.keys(ROLE_META) as SignupRole[]).map((r) => (
                  <button key={r} onClick={() => setRole(r)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition text-left">
                    <div className="w-9 h-9 rounded-lg bg-emerald-600/30 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-emerald-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">{ROLE_META[r].icon}</svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{ROLE_META[r].title}</p>
                      <p className="text-xs text-slate-400">{ROLE_META[r].blurb}</p>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-slate-500 mt-4">Government/agency admin accounts are created by the system administrator.</p>
              <p className="text-center text-xs text-slate-400 mt-2">Already have an account? <Link href="/login" className="text-slate-200 font-semibold hover:text-white transition">Sign in</Link></p>
            </>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <button type="button" onClick={() => setRole(null)} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Change role
              </button>
              <h2 className="text-base font-bold text-white -mt-1">Create {ROLE_META[role].title} Account</h2>
              {error && (
                <div className="flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 text-red-300 text-sm">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                  {error}
                </div>
              )}

              {role === 'manufacturing_unit' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Unit name *</label>
                    <input type="text" required value={unitName} onChange={e => setUnitName(e.target.value)} disabled={loading} placeholder="e.g. Jaipur Unit" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">District</label>
                    <input type="text" value={unitDistrict} onChange={e => setUnitDistrict(e.target.value)} disabled={loading} placeholder="Jaipur" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Contact phone</label>
                    <input type="text" value={unitContactPhone} onChange={e => setUnitContactPhone(e.target.value)} disabled={loading} placeholder="98XXXXXXXX" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Contact person</label>
                    <input type="text" value={unitContactName} onChange={e => setUnitContactName(e.target.value)} disabled={loading} placeholder="Manager name" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Email address</label>
                <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={loading} placeholder="you@example.com" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Password</label>
                <input type="password" autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={loading} placeholder="Min. 6 characters" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Confirm password</label>
                <input type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} disabled={loading} placeholder="••••••••" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition" />
              </div>
              <button type="submit" disabled={loading} className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-lg hover:opacity-90 transition disabled:opacity-50">
                {loading ? <span className="flex items-center justify-center gap-2"><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Creating account…</span> : `Create ${ROLE_META[role].title} Account`}
              </button>
              <p className="text-center text-xs text-slate-400">Already have an account? <Link href="/login" className="text-slate-200 font-semibold hover:text-white transition">Sign in</Link></p>
            </form>
          )}
        </div>
        <p className="text-center text-xs text-slate-600 mt-6">Rajasthan — 1,250 locations · RJ-0001 to RJ-1250</p>
      </div>
    </main>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  )
}
