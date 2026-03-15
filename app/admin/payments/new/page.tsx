import { redirect } from 'next/navigation'
import { getUserWithRole } from '@/lib/supabase/auth'
import { getLocationsForDropdown } from '@/lib/supabase/payments'
import NewContractForm from '@/components/payments/NewContractForm'

export const dynamic = 'force-dynamic'

export default async function NewPaymentContractPage() {
  let user: Awaited<ReturnType<typeof getUserWithRole>>['user'] = null
  let role: Awaited<ReturnType<typeof getUserWithRole>>['role'] = null

  try {
    ;({ user, role } = await getUserWithRole())
  } catch {
    redirect('/login')
  }

  if (!user || role !== 'admin') redirect('/login')

  const locations = await getLocationsForDropdown()

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <a href="/admin/payments" className="hover:text-gray-700">Payments</a>
          <span>›</span>
          <span className="text-gray-900 font-medium">New Contract</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">New Payment Contract</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Set up a supplier payment contract with 4 milestone-based tranches.
        </p>
      </div>

      <NewContractForm locations={locations} />
    </div>
  )
}
