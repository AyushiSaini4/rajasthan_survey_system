'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSignOut() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors px-3 py-1.5 rounded-md hover:bg-gray-100"
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
