import Link from 'next/link'
import SignOutButton from '@/components/shared/SignOutButton'

/**
 * Verifier shell layout — mobile-first (max-w-2xl).
 * Teal/emerald brand distinguishes it from agent (green), unit (orange),
 * admin (blue), and QC (indigo).
 */
export default function VerifierLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-12">

            <Link href="/verifier/dashboard" className="flex items-center gap-2">
              <div
                className="w-6 h-6 bg-teal-600 rounded flex items-center justify-center flex-shrink-0"
                style={{ width: 24, height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {/* Shield-check icon */}
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
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <span className="font-semibold text-gray-900 text-sm">Verification</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700 border border-teal-200">
                Verifier
              </span>
            </Link>

            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {children}
      </main>
    </div>
  )
}
