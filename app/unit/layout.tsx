import Link from 'next/link'
import SignOutButton from '@/components/shared/SignOutButton'

/**
 * Manufacturing Unit shell layout — mobile-friendly (max-w-3xl centred).
 * Orange/amber brand colour distinguishes it from the agent (green) and admin (blue) portals.
 * Defensive style= on the brand icon follows the same pattern as agent/admin layouts.
 */
export default function UnitLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center justify-between h-12">

            {/* Brand */}
            <Link href="/unit/dashboard" className="flex items-center gap-2">
              <div
                className="w-6 h-6 bg-orange-600 rounded flex items-center justify-center flex-shrink-0"
                style={{ width: 24, height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {/* Factory / gear icon */}
                <svg
                  className="w-3.5 h-3.5 text-white"
                  width={14}
                  height={14}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                  />
                </svg>
              </div>
              <span className="font-semibold text-gray-900 text-sm">Production Unit</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                Unit
              </span>
            </Link>

            {/* Sign out */}
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 py-4">
        {children}
      </main>
    </div>
  )
}
