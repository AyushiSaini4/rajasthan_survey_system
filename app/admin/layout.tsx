import Link from 'next/link'
import SignOutButton from '@/components/shared/SignOutButton'

const NAV_LINKS = [
  { href: '/admin/dashboard', label: 'Locations' },
  { href: '/admin/units',     label: 'Units' },
  { href: '/admin/qc',        label: 'QC' },
  { href: '/admin/payments',  label: 'Payments' },
  { href: '/admin/reports',   label: 'Reports' },
]

/**
 * Admin shell layout.
 *
 * Nav is a single row — no hidden/md:hidden toggling between a "desktop nav"
 * and a "mobile nav".  Previously having two nav sections that relied on
 * Tailwind responsive classes to hide one another meant both would render
 * simultaneously if Tailwind failed to load (service-worker cache serving
 * a stale CSS bundle), producing the "nav appears twice" bug.
 *
 * Now: one header row with brand + sign-out, one scrollable nav row below.
 * Works identically at every screen size without any visibility toggling.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Row 1: Brand + Sign out */}
          <div className="flex items-center justify-between h-12">
            {/* Brand */}
            <div className="flex items-center gap-2">
              {/*
                style= is a hard fallback: keeps this box 24×24 px even when
                Tailwind fails to load (stale service-worker CSS in dev).
                Without it, @tailwind base's `svg { display:block }` makes the
                unsized SVG expand to fill the full-width block container,
                producing the "giant icon" that covers the whole screen.
              */}
              <div
                className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center flex-shrink-0"
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
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
              </div>
              <span className="font-semibold text-gray-900 text-sm">SNIS Rajasthan</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                Admin
              </span>
            </div>

            {/* Sign out */}
            <SignOutButton />
          </div>

          {/* Row 2: Navigation — single scrollable row, always visible */}
          <nav className="flex items-center gap-1 pb-2 overflow-x-auto">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex-shrink-0 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors whitespace-nowrap"
              >
                {link.label}
              </Link>
            ))}
          </nav>

        </div>
      </header>

      {/* ── Page content ────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  )
}
