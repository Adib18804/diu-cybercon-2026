"use client"

// =============================================================================
// AdminStatCard — compact metric tile for the dashboard and analytics pages.
// =============================================================================

import type { LucideIcon } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import * as React from "react"

import { cn } from "@/lib/utils"

export type StatAccent =
  | "cyan"
  | "neon"
  | "violet"
  | "pink"
  | "amber"
  | "muted"

const ACCENT_CLASSES: Record<
  StatAccent,
  { icon: string; value: string }
> = {
  cyan: { icon: "border-cyan/30 bg-cyan/10 text-cyan", value: "text-cyan" },
  neon: { icon: "border-neon/30 bg-neon/10 text-neon", value: "text-neon" },
  violet: {
    icon: "border-violet/40 bg-violet/10 text-violet-300",
    value: "text-violet-300",
  },
  pink: { icon: "border-pink/30 bg-pink/10 text-pink", value: "text-pink" },
  amber: { icon: "border-amber/30 bg-amber/10 text-amber", value: "text-amber" },
  muted: {
    icon: "border-border bg-bg-elevated text-text-muted",
    value: "text-text-primary",
  },
}

export interface AdminStatCardProps {
  label: string
  value: number | string
  icon?: LucideIcon
  accent?: StatAccent
  hint?: string
  /** When set, the whole card becomes a link. */
  href?: Route
  loading?: boolean
}

export function AdminStatCard({
  label,
  value,
  icon: Icon,
  accent = "cyan",
  hint,
  href,
  loading = false,
}: AdminStatCardProps) {
  const body = (
    <div
      className={cn(
        "group flex h-full flex-col gap-3 rounded-lg border border-border bg-bg-panel p-4 transition-colors",
        href && "hover:border-cyan/40",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-micro uppercase tracking-wider text-text-muted">
          {label}
        </p>
        {Icon && (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
              ACCENT_CLASSES[accent].icon,
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-8 w-16 animate-pulse rounded bg-bg-elevated" />
      ) : (
        <p
          className={cn(
            "font-display text-2xl font-bold leading-none tracking-tight",
            ACCENT_CLASSES[accent].value,
          )}
        >
          {value}
        </p>
      )}

      {hint && <p className="text-xs text-text-faint">{hint}</p>}
    </div>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
      >
        {body}
      </Link>
    )
  }
  return body
}
