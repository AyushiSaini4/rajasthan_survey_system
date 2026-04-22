import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that never require authentication
const PUBLIC_ROUTES = ['/login', '/signup', '/public']

// Role → dashboard mapping (kept here so middleware imports nothing from /lib)
const ROLE_DASHBOARDS: Record<string, string> = {
  field_agent:        '/agent/dashboard',
  manufacturing_unit: '/unit/dashboard',
  qc_inspector:       '/qc/dashboard',
  admin:              '/admin/dashboard',
  verifier:           '/verifier/dashboard',
}

/**
 * Build a redirect response and copy ALL refreshed session cookies from
 * supabaseResponse into it.
 *
 * This is the critical fix: the old code created bare NextResponse.redirect()
 * calls that discarded any token refresh Supabase had just written to
 * supabaseResponse.cookies.  Without copying them, the browser never received
 * the updated access token, so the very next request looked unauthenticated.
 */
function buildRedirect(
  toPathname: string,
  request: NextRequest,
  supabaseResponse: NextResponse
): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = toPathname
  const redirectRes = NextResponse.redirect(url)

  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirectRes.cookies.set(cookie.name, cookie.value, {
      path:     cookie.path,
      sameSite: cookie.sameSite,
      secure:   cookie.secure,
      httpOnly: cookie.httpOnly,
      maxAge:   cookie.maxAge,
    })
  })

  return redirectRes
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: No logic between createServerClient and getUser().
  // Any await here causes subtle session-refresh bugs (random logouts).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── Not authenticated ─────────────────────────────────────────────────────
  if (!user && !PUBLIC_ROUTES.includes(pathname)) {
    return buildRedirect('/login', request, supabaseResponse)
  }

  // ── Authenticated visiting / or /login → send straight to role dashboard ──
  // We do this in middleware because user.app_metadata is already available
  // from the getUser() call above — no second network round-trip needed.
  // This also eliminates the blank-screen flash that happened when app/page.tsx
  // was making its own getUser() call after middleware had already done one.
  if (user && (pathname === '/' || pathname === '/login')) {
    const role = user.app_metadata?.role as string | undefined
    const dashboard =
      role && ROLE_DASHBOARDS[role] ? ROLE_DASHBOARDS[role] : '/login'
    return buildRedirect(dashboard, request, supabaseResponse)
  }

  // ── Pass through ──────────────────────────────────────────────────────────
  // Always return supabaseResponse (not a plain NextResponse.next()) so that
  // refreshed cookies are forwarded to the browser on every request.
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|workbox-.*\\.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
