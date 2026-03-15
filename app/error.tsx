'use client'

// Global error boundary — catches any unhandled error that bubbles past a
// segment-level error.tsx, including errors thrown from layout components.
// app/unit/error.tsx covers the page level; this covers the layout level and
// any other route that doesn't have its own error boundary yet.

import { useEffect } from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[Global error boundary]', error)
  }, [error])

  return (
    <html>
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            background: '#f9fafb',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: 400,
              width: '100%',
              background: '#fff',
              border: '1px solid #fecaca',
              borderRadius: 12,
              padding: '2rem',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 48,
                height: 48,
                background: '#fee2e2',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              <svg
                width={24}
                height={24}
                fill="none"
                viewBox="0 0 24 24"
                stroke="#dc2626"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 600, color: '#111827' }}>
              Something went wrong
            </h2>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
              An unexpected error occurred. Please try again or return to the home page.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={reset}
                style={{
                  padding: '0.625rem 1rem',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
              <a
                href="/login"
                style={{
                  padding: '0.625rem 1rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  borderRadius: 8,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  display: 'block',
                }}
              >
                Back to login
              </a>
            </div>

            {error.digest && (
              <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                Ref: <span style={{ fontFamily: 'monospace' }}>{error.digest}</span>
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
