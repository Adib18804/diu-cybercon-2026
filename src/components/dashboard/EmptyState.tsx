import type * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// EmptyState — consistent placeholder for empty dashboard sections.
// Works in server components (no hooks, no client directives).
// =============================================================================

export interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed border-border bg-bg-panel/50 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-md border border-cyan/25 bg-cyan/5 text-cyan">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-base font-semibold text-text-primary">
        {title}
      </h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-text-muted">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
