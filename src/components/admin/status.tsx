"use client"

// =============================================================================
// Status pills — one visual language for every status enum in the system.
// =============================================================================

import { cn } from "@/lib/utils"

// Positive / done → neon green
// Active / in review → cyan
// Waiting → amber
// Negative → pink
// Needs action → violet
// Inactive → muted

const STATUS_STYLES: Record<string, string> = {
  // ── Positive ─────────────────────────────────────────────────────────────
  VERIFIED: "border-neon/30 bg-neon/10 text-neon",
  APPROVED: "border-neon/30 bg-neon/10 text-neon",
  PUBLISHED: "border-neon/30 bg-neon/10 text-neon",
  CONFIRMED: "border-neon/30 bg-neon/10 text-neon",
  COMPLETED: "border-neon/30 bg-neon/10 text-neon",
  CHECKED_IN: "border-neon/30 bg-neon/10 text-neon",
  OPEN: "border-neon/30 bg-neon/10 text-neon",
  ACTIVE: "border-neon/30 bg-neon/10 text-neon",

  // ── Active / in progress ─────────────────────────────────────────────────
  UNDER_REVIEW: "border-cyan/30 bg-cyan/10 text-cyan",
  CHECKED_OUT: "border-cyan/30 bg-cyan/10 text-cyan",
  NEGOTIATION: "border-cyan/30 bg-cyan/10 text-cyan",

  // ── Waiting ──────────────────────────────────────────────────────────────
  PENDING: "border-amber/30 bg-amber/10 text-amber",
  SUBMITTED: "border-amber/30 bg-amber/10 text-amber",
  CONTACTED: "border-amber/30 bg-amber/10 text-amber",
  WAITLISTED: "border-amber/30 bg-amber/10 text-amber",

  // ── Negative ─────────────────────────────────────────────────────────────
  REJECTED: "border-pink/30 bg-pink/10 text-pink",
  CANCELLED: "border-pink/30 bg-pink/10 text-pink",
  SUSPENDED: "border-pink/30 bg-pink/10 text-pink",

  // ── Needs action ─────────────────────────────────────────────────────────
  REVISION_REQUIRED: "border-violet/40 bg-violet/10 text-violet-300",

  // ── Inactive ─────────────────────────────────────────────────────────────
  NOT_ARRIVED: "border-border bg-bg-elevated text-text-muted",
  DRAFT: "border-border bg-bg-elevated text-text-muted",
  CLOSED: "border-border bg-bg-elevated text-text-muted",
  INACTIVE: "border-border bg-bg-elevated text-text-muted",
}

/** "REVISION_REQUIRED" → "Revision Required" */
export function humanizeStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export interface StatusPillProps {
  status: string
  className?: string
}

export function StatusPill({ status, className }: StatusPillProps) {
  const style =
    STATUS_STYLES[status] ?? "border-border bg-bg-elevated text-text-muted"
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[0.625rem] font-bold uppercase tracking-wider",
        style,
        className,
      )}
    >
      {humanizeStatus(status)}
    </span>
  )
}

// ─── Admin role badge ─────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  EVENT_ADMIN: "Event Admin",
  REGISTRATION_ADMIN: "Registration Admin",
  CONTENT_ADMIN: "Content Admin",
  SPONSORSHIP_ADMIN: "Sponsorship Admin",
  VERIFICATION_ADMIN: "Verification Admin",
}

export function AdminRoleBadge({
  role,
  className,
}: {
  role: string | null | undefined
  className?: string
}) {
  if (!role) {return null}
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border border-violet/40 bg-violet/10 px-2 py-0.5 font-mono text-[0.625rem] font-bold uppercase tracking-wider text-violet-300",
        className,
      )}
    >
      {ROLE_LABELS[role] ?? humanizeStatus(role)}
    </span>
  )
}
