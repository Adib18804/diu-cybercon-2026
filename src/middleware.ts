// =============================================================================
// DIU_CYBERCON 2026 — Next.js Middleware
// Runs on the Edge Runtime before every matched request.
//
// Responsibilities (in order):
//   0. Per-request nonce + Content-Security-Policy
//   1. Maintenance mode gate
//   2. CORS enforcement (API routes)
//   3. Auth guard (protected routes)
//   4. Admin role gate (admin routes)
//   5. Security headers (belt-and-suspenders on top of next.config.ts)
// =============================================================================

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

import { SESSION_COOKIE_NAME, USE_SECURE_SESSION_COOKIE } from "@/lib/session-cookie"

// ─── Route matchers ───────────────────────────────────────────────────────────

/** Routes that require any authenticated user */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/dashboard/(.*)",
  "/sponsor-portal",
  "/sponsor-portal/(.*)",
]

/** Routes that require ADMIN or STAFF role */
const ADMIN_ROUTES = [
  "/admin",
  "/admin/(.*)",
]

/** Routes only accessible to unauthenticated users (redirect logged-in away) */
const AUTH_ONLY_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
]

/** API routes — apply CORS */
const API_PREFIX = "/api"

// ─── Allowed CORS origins ─────────────────────────────────────────────────────

function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS ?? ""
  const origins = raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)

  // Always include localhost in development
  if (process.env.NODE_ENV === "development") {
    origins.push("http://localhost:3000", "http://127.0.0.1:3000")
  }

  return origins
}

// ─── Route matching helpers ───────────────────────────────────────────────────

function matchesAny(pathname: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.endsWith("(.*)")) {
      const prefix = pattern.slice(0, -4)
      return pathname === prefix || pathname.startsWith(prefix + "/")
    }
    return pathname === pattern
  })
}

// ─── CORS handler ─────────────────────────────────────────────────────────────

function handleCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get("origin")
  const allowedOrigins = getAllowedOrigins()

  // Preflight
  if (request.method === "OPTIONS") {
    const preflightResponse = new NextResponse(null, { status: 204 })
    applyCorsHeaders(preflightResponse, origin, allowedOrigins)
    preflightResponse.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    )
    preflightResponse.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-CSRF-Token, X-Requested-With",
    )
    preflightResponse.headers.set("Access-Control-Max-Age", "86400")
    return preflightResponse
  }

  applyCorsHeaders(response, origin, allowedOrigins)
  return response
}

function applyCorsHeaders(
  response: NextResponse,
  origin: string | null,
  allowedOrigins: string[],
): void {
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Credentials", "true")
    response.headers.set("Vary", "Origin")
  }
  // Never set wildcard — not even as fallback
}

// ─── Security headers (supplementary to next.config.ts) ─────────────────────

function applySecurityHeaders(response: NextResponse): void {
  // These are set here as a belt-and-suspenders layer.
  // next.config.ts headers() sets them statically at build time.
  // Middleware sets them dynamically per-request (catches edge cases).
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
}

// ─── Content-Security-Policy (nonce-based, per request) ───────────────────────

/**
 * Build the per-request CSP. The nonce is threaded through two channels:
 *
 *   • REQUEST header  — Next.js parses the CSP from the forwarded request
 *     headers and stamps the nonce onto every framework/page script it
 *     renders; we also expose it as `x-nonce` so the root layout can add it
 *     to hand-written inline scripts.
 *   • RESPONSE header — what the browser actually enforces.
 *
 * 'strict-dynamic' makes modern browsers trust only nonce-carrying scripts
 * (plus whatever those scripts load themselves), so injected <script> tags
 * are dead on arrival even if an escaping bug ever slipped through.
 *
 * Notes on the allow-lists:
 *   • 'unsafe-eval'  — dev only (webpack eval source maps / HMR).
 *   • ws: wss:       — dev only (HMR websocket).
 *   • style-src 'unsafe-inline' — framer-motion + react-hot-toast set style
 *     attributes at runtime; no external stylesheets are used (fonts are
 *     self-hosted by next/font).
 *   • img-src https: — admin-managed content may reference https image URLs
 *     (Cloudinary/Supabase/CDN); data: + blob: for previews and canvases.
 *   • frame-src      — the Google Maps embed on the venue page.
 *   • upgrade-insecure-requests — production only (would break plain-http
 *     localhost otherwise).
 */
function buildContentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development"

  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    `frame-src https://www.google.com https://maps.google.com`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ]

  if (!isDev) {
    directives.push("upgrade-insecure-requests")
  }

  return directives.join("; ")
}

// ─── Main middleware ──────────────────────────────────────────────────────────

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // ── 0. Per-request nonce + CSP ────────────────────────────────────────
  // 128 bits of entropy, base64 — fresh for every request.
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
    "base64",
  )
  const csp = buildContentSecurityPolicy(nonce)

  // Forwarded request headers. Client-supplied copies of headers that
  // downstream code treats as trusted are stripped first (spoofing guard),
  // then the CSP + nonce for this request are set. Next.js reads the CSP
  // from the request headers to stamp the nonce onto its scripts.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete("x-nonce")
  requestHeaders.delete("x-user-id")
  requestHeaders.delete("x-user-role")
  requestHeaders.delete("x-user-admin-role")
  requestHeaders.delete("content-security-policy")
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  /** Attach the enforced CSP + belt-and-suspenders headers to a response. */
  function withSecurity(response: NextResponse): NextResponse {
    applySecurityHeaders(response)
    response.headers.set("Content-Security-Policy", csp)
    return response
  }

  // ── 1. Maintenance mode ───────────────────────────────────────────────
  const maintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true"
  if (maintenanceMode) {
    // Allow admin routes and the API through even in maintenance mode
    const isAdminRoute = matchesAny(pathname, ADMIN_ROUTES)
    const isApiRoute = pathname.startsWith(API_PREFIX)
    const isAuthRoute = matchesAny(pathname, [...AUTH_ONLY_ROUTES, "/verify-email", "/reset-password"])

    if (!isAdminRoute && !isApiRoute && !isAuthRoute && pathname !== "/maintenance") {
      const url = request.nextUrl.clone()
      url.pathname = "/maintenance"
      return withSecurity(
        NextResponse.rewrite(url, { request: { headers: requestHeaders } }),
      )
    }
  }

  // ── 2. CORS for API routes ────────────────────────────────────────────
  if (pathname.startsWith(API_PREFIX)) {
    const apiResponse = NextResponse.next({
      request: { headers: requestHeaders },
    })
    const corsResponse = handleCors(request, apiResponse)
    withSecurity(corsResponse)

    // Handle OPTIONS preflight immediately
    if (request.method === "OPTIONS") {
      return corsResponse
    }

    return corsResponse
  }

  // ── 3. Auth — get session token ───────────────────────────────────────
  // The session JWT is encrypted with a key derived from the COOKIE NAME
  // (HKDF salt = auth.ts's sessionToken cookie name at mint time). getToken
  // must therefore be given the exact same name + salt, or it treats every
  // signed-in user as anonymous.
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    cookieName: SESSION_COOKIE_NAME,
    salt: SESSION_COOKIE_NAME,
    secureCookie: USE_SECURE_SESSION_COOKIE,
  })

  const isAuthenticated = !!token
  const userRole = token?.role as string | undefined
  const adminRole = token?.adminRole as string | undefined
  const isAdmin = userRole === "ADMIN" || userRole === "STAFF"

  // Forward trusted identity headers to server components via the request.
  // (Client-supplied copies were stripped in step 0; these overwrite them
  // with values derived from the verified session.)
  if (isAuthenticated) {
    requestHeaders.set("x-user-id", token.id)
    requestHeaders.set("x-user-role", userRole ?? "PARTICIPANT")
    if (adminRole) {
      requestHeaders.set("x-user-admin-role", adminRole)
    }
  }

  // ── 4. Redirect authenticated users away from auth pages ─────────────
  if (isAuthenticated && matchesAny(pathname, AUTH_ONLY_ROUTES)) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // ── 5. Protected route — must be logged in ────────────────────────────
  if (matchesAny(pathname, PROTECTED_ROUTES)) {
    if (!isAuthenticated) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(url)
    }

    // Check for suspended account
    if (token?.isSuspended === true) {
      const url = request.nextUrl.clone()
      url.pathname = "/suspended"
      return NextResponse.redirect(url)
    }
  }

  // ── 6. Admin route — must be admin role ───────────────────────────────
  if (matchesAny(pathname, ADMIN_ROUTES)) {
    if (!isAuthenticated) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(url)
    }

    if (!isAdmin) {
      // Authenticated but not an admin — forbidden
      const url = request.nextUrl.clone()
      url.pathname = "/403"
      return withSecurity(
        NextResponse.rewrite(url, { request: { headers: requestHeaders } }),
      )
    }

    // Admin is authenticated and has admin role — allow through
    // Granular permission checks happen in each route handler/layout
  }

  // ── 7. Sponsor portal — must be authenticated ─────────────────────────
  // (Specific sponsor approval check happens in the layout/page itself
  //  since it requires a DB call to check approval status)

  // ── 8. Apply security headers and pass through ────────────────────────
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  withSecurity(response)

  return response
}

// ─── Matcher — which routes trigger middleware ────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     *  - _next/static  (static files)
     *  - _next/image   (image optimization)
     *  - favicon.ico
     *  - public files  (icons, fonts, images, robots.txt, sitemap.xml)
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|fonts/|images/|og-image.png|robots.txt|sitemap.xml|site.webmanifest).*)",
  ],
}
