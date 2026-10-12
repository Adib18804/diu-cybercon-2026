// =============================================================================
// Events — pure display helpers shared by /events hub + module detail pages
// =============================================================================

export interface EventAccentClasses {
  /** e.g. "badge-cyan" */
  badge: string
  /** e.g. "text-cyan" */
  text: string
  /** e.g. "border-cyan/30" */
  border: string
  /** e.g. "bg-cyan/5" */
  iconBg: string
}

const ACCENT_BY_SLUG: Record<string, EventAccentClasses> = {
  ctf: {
    badge: "badge-cyan",
    text: "text-cyan",
    border: "border-cyan/30",
    iconBg: "bg-cyan/5",
  },
  "trace-route": {
    badge: "badge-neon",
    text: "text-neon",
    border: "border-neon/30",
    iconBg: "bg-neon/5",
  },
  "project-showcase": {
    badge: "badge-violet",
    text: "text-violet",
    border: "border-violet/30",
    iconBg: "bg-violet/5",
  },
  poster: {
    badge: "badge-pink",
    text: "text-pink",
    border: "border-pink/30",
    iconBg: "bg-pink/5",
  },
  panel: {
    badge: "badge-amber",
    text: "text-amber",
    border: "border-amber/30",
    iconBg: "bg-amber/5",
  },
  workshops: {
    badge: "badge-violet",
    text: "text-violet",
    border: "border-violet/30",
    iconBg: "bg-violet/5",
  },
}

const FALLBACK_ACCENT: EventAccentClasses = {
  badge: "badge-cyan",
  text: "text-cyan",
  border: "border-cyan/30",
  iconBg: "bg-cyan/5",
}

export function eventAccentClasses(slug: string): EventAccentClasses {
  return ACCENT_BY_SLUG[slug] ?? FALLBACK_ACCENT
}

export type EventBadgeType = "team" | "solo" | "attendance" | "individual"

/** Map an event to the EventTypeBadge variant shown on cards. */
export function eventBadgeType(type: string, isTeamEvent: boolean): EventBadgeType {
  if (type === "PANEL_DISCUSSION") {
    return "attendance"
  }
  if (type === "HANDS_ON") {
    return "individual"
  }
  return isTeamEvent ? "team" : "solo"
}

export type RegistrationState = "open" | "soon" | "closed" | "completed"

/** Derive the registration status shown as a pill on cards and detail pages. */
export function registrationState(
  status: string,
  registrationOpen: boolean,
): RegistrationState {
  if (status === "COMPLETED") {
    return "completed"
  }
  if (registrationOpen && status === "OPEN") {
    return "open"
  }
  if (status === "DRAFT") {
    return "soon"
  }
  return "closed"
}

export const REGISTRATION_STATE_LABEL: Record<RegistrationState, string> = {
  open: "Registration Open",
  soon: "Opens Soon",
  closed: "Registration Closed",
  completed: "Completed",
}

export const REGISTRATION_STATE_CLASS: Record<RegistrationState, string> = {
  open: "border-neon/30 bg-neon/5 text-neon",
  soon: "border-amber/30 bg-amber/5 text-amber",
  closed: "border-border bg-bg-panel text-text-faint",
  completed: "border-border bg-bg-panel text-text-faint",
}
