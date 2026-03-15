'use client'

/**
 * Error boundary for all /agent/* routes.
 *
 * In Next.js 14 App Router, error.tsx must be a Client Component.
 * It catches unhandled exceptions thrown by any server component in the
 * /agent segment and renders this fallback UI instead of a blank
 * "Internal Server Error" page.
 */

import { useEffect } from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AgentError({ error, reset }: Props) {
  useEffect(() => {
    // Log to console in dev so the full stack is visible in the terminal
    console.error('[AgentError boundary]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">

        {/* Icon */}
        <div
          className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4"
          style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg
            className="w-7 h-7 text-red-600"
            width={28}
            height={28}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <h1 className="text-lg font-bold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-sm text-gray-500 mb-6">
          An unexpected error occurred. This has been logged. Please try again — if
          the problem persists, contact your system administrator.
        </p>

        {/* Error digest (production) or message (dev) */}
        {(error.digest || error.message) && (
          <p className="text-xs font-mono text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-6 break-all">
            {error.digest ?? error.message}
          </p>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Try again
          </button>
          <a
            href="/agent/dashboard"
            className="px-4 py-2 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
