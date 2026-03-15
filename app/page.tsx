import { redirect } from 'next/navigation'

/**
 * Root page — server component.
 *
 * In normal operation this page is never reached: middleware intercepts every
 * request to "/" and redirects authenticated users straight to their role
 * dashboard, and unauthenticated users to /login.
 *
 * This redirect acts as a safe fallback only (e.g. if middleware is somehow
 * bypassed or a future config change removes "/" from the matcher).
 */
export default function RootPage() {
  redirect('/login')
}
