// =============================================================================
// Maintenance Page — /maintenance
// Served via middleware rewrite when NEXT_PUBLIC_MAINTENANCE_MODE=true.
// =============================================================================

import { Mail, RefreshCw, Wrench } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { APP_EMAIL, APP_NAME } from "@/lib/constants"

export const metadata: Metadata = {
  title: "Under Maintenance",
  description: `${APP_NAME} is currently under maintenance. Please check back soon.`,
  robots: { index: false, follow: false },
}

export default function MaintenancePage() {
  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-16">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-25" />

      <div className="relative z-content w-full max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-lg border border-amber/30 bg-amber/5">
          <Wrench size={36} className="text-amber" aria-hidden="true" />
        </div>

        <p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-amber">
          Scheduled Upgrade
        </p>

        <h1 className="mb-4 font-display text-section-h2 font-bold tracking-tight text-text-primary">
          We&apos;ll Be Right Back
        </h1>

        <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-text-muted">
          {APP_NAME} is temporarily down for maintenance. We&apos;re upgrading
          systems to make the experience faster and more secure. Please check
          back in a little while.
        </p>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="btn-primary flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Link>

          <a
            href={`mailto:${APP_EMAIL}`}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Mail className="h-4 w-4" />
            Contact Us
          </a>
        </div>

        <p className="mt-8 font-mono text-xs text-text-faint">
          Status updates will be posted on our official channels.
        </p>
      </div>
    </div>
  )
}
