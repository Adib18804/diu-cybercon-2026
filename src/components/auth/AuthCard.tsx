import * as React from "react"

import { APP_NAME } from "@/lib/constants"

// =============================================================================
// AuthCard — shared shell for all auth pages (login, signup, reset, verify)
// =============================================================================

interface AuthCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  /** Rendered below the content, separated by a border */
  footer?: React.ReactNode
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="gradient-border rounded-lg p-6 sm:p-8">
      {/* Brand mark */}
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg border border-cyan/40 bg-cyan/5 font-mono text-lg font-bold text-cyan shadow-glow-cyan-sm">
          &gt;_
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">
          {APP_NAME}
        </p>
      </div>

      {/* Heading */}
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            {subtitle}
          </p>
        )}
      </div>

      {/* Content */}
      {children}

      {/* Footer */}
      {footer && (
        <div className="mt-6 border-t border-border pt-5 text-center text-sm text-text-muted">
          {footer}
        </div>
      )}
    </div>
  )
}
