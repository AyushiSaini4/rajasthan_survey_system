'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
type Role = 'admin' | 'agent' | 'public'
const roles = [
  { id: 'admin' as Role, label: 'Government Authority', sublabel: 'Admin Portal', color: 'from-blue-600 to-blue-700' },
  { id: 'agent' as Role, label: 'Field Agent', sublabel: 'Survey Worker', color: 'from-emerald-600 to-emerald-700' },
  { id: 'public' as Role, label: 'Public', sublabel: 'View Progress', color: 'from-orange-500 to-orange-600' },
]
export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null); setLoading(true)
    if (selectedRole === 'public') { router.push('/public'); return }
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError) { setError('Invalid email or password. Please try again.'); setLoading(false); return }
    router.push('/'); router.refresh()
  }
  const activeRole = roles.find(r => r.id === selectedRole)
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-12">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-2xl mb-4">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SNIS Rajasthan</h1>
          <p className="text-slate-400 text-sm mt-1">Special Needs Infrastructure Survey System</p>
        </div>
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 shadow-2xl border border-white/10">
          <p className="text-slate-300 text-xs font-semibold uppercase tracking-widest mb-3">Select your role</p>
          <div className="grid grid-cols-3 gap-2 mb-6">
            {roles.map(role => (
              <button key={role.id} onClick={() => { setSelectedRole(role.id); setError(null) }}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 ${selectedRole === role.id ? 'border-white bg-white/20 shadow-lg scale-105' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                <div className={`px-3 py-1 rounded-lg text-xs font-bold ${selectedRole === role.id ? `bg-gradient-to-br ${role.color} text-white` : 'bg-white/10 text-slate-300'}`}>{role.label}</div>
                <p className={`text-[10px] ${selectedRole === role.id ? 'text-slate-200' : 'text-slate-500'}`}>{role.sublabel}</p>
              </button>
            ))}
          </div>
          {selectedRole === 'public' && (
            <div className="mb-4 p-4 rounded-xl bg-orange-500/20 border border-orange-400/30 text-center">
              <p className="text-orange-200 text-sm mb-3">No login required for public access.</p>
              <button onClick={() => router.push('/public')} className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-orange-600 shadow-lg hover:opacity-90 transition">View Public Dashboard →</button>
            </div>
          )}
          {selectedRole && selectedRole !== 'public' && (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {error && <div className="flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Email address</label>
                <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={loading} placeholder="you@example.com" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 transition" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Password</label>
                <input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={loading} placeholder="••••••••" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 transition" />
              </div>
              <button type="submit" disabled={loading} className={`w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r ${activeRole?.color} shadow-lg hover:opacity-90 transition disabled:opacity-50`}>
                {loading ? 'Signing in…' : `Sign in as ${activeRole?.label}`}
              </button>
              {selectedRole === 'agent' && <p className="text-center text-xs text-slate-400">New field agent? <Link href="/signup" className="text-slate-200 font-semibold hover:text-white">Create account</Link></p>}
              {selectedRole === 'admin' && <p className="text-center text-xs text-slate-500 mt-2">Admin accounts are created by the system administrator.</p>}
            </form>
          )}
          {!selectedRole && <p className="text-center text-xs text-slate-500 mt-2">Select a role above to continue</p>}
        </div>
        <p className="text-center text-xs text-slate-600 mt-6">Rajasthan — 1,250 locations · RJ-0001 to RJ-1250</p>
      </div>
    </main>
  )
}
