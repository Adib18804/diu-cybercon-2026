// =============================================================================
// Suspended Account Page — /suspended
// Middleware redirects here when a suspended user hits a protected route.
// =============================================================================

import { Ban, Mail } from "lucide-react"
import type { Metadata } from "next"

import { SuspendedSignOut } from "./SuspendedSignOut"

import { APP_EMAIL } from "@/lib/constants"


export const metadata: Metadata = {
  title: "Account Suspended",
  description: "Your account has been suspended.",
  robots: { index: false, follow: false },
}

export default function SuspendedPage() {
  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-16">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-25" />

      <div className="relative z-content w-full max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-lg border border-pink/30 bg-pink/5 shadow-glow-pink">
          <Ban size={36} className="text-pink" aria-hidden="true" />
        </div>

        <p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-pink">
          Access Suspended
        </p>

        <h1 className="mb-4 font-display text-section-h2 font-bold tracking-tight text-text-primary">
          Account Suspended
        </h1>

        <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-text-muted">
          Your account has been suspended by the organizing team. If you
          believe this is a mistake or need more information, please contact us
          at the email below.
        </p>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={`mailto:${APP_EMAIL}`}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Mail className="h-4 w-4" />
            {APP_EMAIL}
          </a>

          <SuspendedSignOut />
        </div>
      </div>
    </div>
  )
}
