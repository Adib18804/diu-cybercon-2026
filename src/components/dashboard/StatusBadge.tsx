// =============================================================================
// StatusBadge — maps every system status to a consistent badge style.
// Works in both server and client components (no hooks).
// =============================================================================

import { Badge, type BadgeVariant } from "@/components/ui/Badge"

// ─── Status → variant + label ────────────────────────────────────────────────

const STATUS_MAP: Record<string, { variant: BadgeVariant; label: string }> = {
  // Registration
  PENDING: { variant: "amber", label: "Pending review" },
  CONFIRMED: { variant: "neon", label: "Confirmed" },
  CANCELLED: { variant: "muted", label: "Cancelled" },
  WAITLISTED: { variant: "cyan", label: "Waitlisted" },

  // Verification
  VERIFIED: { variant: "neon", label: "Verified" },
  REJECTED: { variant: "pink", label: "Rejected" },
  REVISION_REQUIRED: { variant: "violet", label: "Revision required" },

  // Submissions
  SUBMITTED: { variant: "cyan", label: "Submitted" },
  UNDER_REVIEW: { variant: "amber", label: "Under review" },
  APPROVED: { variant: "neon", label: "Approved" },
  PUBLISHED: { variant: "neon", label: "Published" },
  COMPLETED: { variant: "neon", label: "Completed" },

  // Check-in
  NOT_ARRIVED: { variant: "muted", label: "Not checked in" },
  CHECKED_IN: { variant: "neon", label: "Checked in" },
  CHECKED_OUT: { variant: "cyan", label: "Checked out" },

  // Sponsor applications
  CONTACTED: { variant: "cyan", label: "Contacted" },
  NEGOTIATION: { variant: "violet", label: "In negotiation" },

  // Events
  DRAFT: { variant: "muted", label: "Draft" },
  OPEN: { variant: "neon", label: "Open" },
  CLOSED: { variant: "amber", label: "Closed" },
}

function humanize(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ")
}

const DOT_STATUSES = new Set([
  "VERIFIED",
  "CONFIRMED",
  "CHECKED_IN",
  "APPROVED",
  "PUBLISHED",
  "OPEN",
])

export interface StatusBadgeProps {
  status: string | null | undefined
  size?: "sm" | "md" | "lg"
  className?: string
}

export function StatusBadge({ status, size = "md", className }: StatusBadgeProps) {
  if (!status) {
    return (
      <Badge variant="muted" size={size} className={className}>
        Not uploaded
      </Badge>
    )
  }

  const known = STATUS_MAP[status]
  const variant = known?.variant ?? "muted"
  const label = known?.label ?? humanize(status)

  return (
    <Badge
      variant={variant}
      size={size}
      className={className}
      dot={DOT_STATUSES.has(status)}
    >
      {label}
    </Badge>
  )
}
