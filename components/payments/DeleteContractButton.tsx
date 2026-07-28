'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function DeleteContractButton({
  contractId,
  supplierName,
}: {
  contractId: string
  supplierName: string
}) {
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm(`Delete contract for "${supplierName}"? This will also delete all tranches and cannot be undone.`)) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('payment_contracts').delete().eq('id', contractId)
    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-sm text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
    >
      {deleting ? 'Deleting…' : 'Delete'}
    </button>
  )
}
