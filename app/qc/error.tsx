'use client'

import { useEffect } from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function QCError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[QC portal error]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-white rounded-xl border border-red-200 shadow-sm p-6 text-center">
        <div
          className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg className="w-6 h-6 text-red-600" width={24} height={24} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Something went wrong</h2>
        <p className="text-sm text-gray-500 mb-5">There was a problem loading this page.</p>
        <div className="flex flex-col gap-2">
          <button onClick={reset} className="w-full py-2.5 px-4 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
            Try again
          </button>
          <a href="/qc/dashboard" className="w-full py-2.5 px-4 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors text-center">
            Back to dashboard
          </a>
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-gray-400">Ref: <span className="font-mono">{error.digest}</span></p>
        )}
      </div>
    </div>
  )
}
