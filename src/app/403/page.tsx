// =============================================================================
// 403 Forbidden Page — /403
// Rendered when an authenticated non-admin hits an admin route.
// =============================================================================

import { Home, LayoutDashboard, ShieldX } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { auth } from "@/lib/auth"

export const metadata: Metadata = {
  title: "403 — Access Denied",
  description: "You do not have permission to access this area.",
  robots: { index: false, follow: false },
}

export default async function ForbiddenPage() {
  const session = await auth()
  const isAuthenticated = Boolean(session?.user)

  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-16">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-25" />

      <div className="relative z-content w-full max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-lg border border-pink/30 bg-pink/5 shadow-glow-pink">
          <ShieldX size={36} className="text-pink" aria-hidden="true" />
        </div>

        <p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-pink">
          403 · Forbidden
        </p>

        <h1 className="mb-4 font-display text-section-h2 font-bold tracking-tight text-text-primary">
          Access Denied
        </h1>

        <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-text-muted">
          {isAuthenticated
            ? "Your account doesn't have the permissions required to view this area. If you believe this is a mistake, contact the organizing team."
            : "This area is restricted to authorized organizers. Sign in with an admin account to continue."}
        </p>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="btn-primary flex items-center justify-center gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              Go to Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="btn-primary flex items-center justify-center gap-2"
            >
              <ShieldX className="h-4 w-4" />
              Sign In
            </Link>
          )}

          <Link
            href="/"
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
