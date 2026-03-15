import Link from 'next/link'
import SignOutButton from '@/components/shared/SignOutButton'

/**
 * Agent shell layout — mobile-first (max-w-2xl centred).
 * Uses the same defensive pattern as the admin layout:
 * explicit style= fallback on the brand icon so it can never expand
 * to full-screen if Tailwind fails to load.
 */
export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-12">

            {/* Brand */}
            <Link href="/agent/dashboard" className="flex items-center gap-2">
              <div
                className="w-6 h-6 bg-green-600 rounded flex items-center justify-center flex-shrink-0"
                style={{ width: 24, height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg
                  className="w-3.5 h-3.5 text-white"
                  width={14}
                  height={14}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <span className="font-semibold text-gray-900 text-sm">Field Survey</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                Agent
              </span>
            </Link>

            {/* Sign out */}
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-4 py-4">
        {children}
      </main>
    </div>
  )
}
