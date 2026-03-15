import Link from 'next/link'
import SignOutButton from '@/components/shared/SignOutButton'

/**
 * QC Inspector shell layout — mobile-first (max-w-2xl).
 * Indigo/purple brand distinguishes it from agent (green), unit (orange), admin (blue).
 */
export default function QCLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-12">

            <Link href="/qc/dashboard" className="flex items-center gap-2">
              <div
                className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center flex-shrink-0"
                style={{ width: 24, height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {/* Clipboard-check icon */}
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
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
              </div>
              <span className="font-semibold text-gray-900 text-sm">QC Inspection</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
                Inspector
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
