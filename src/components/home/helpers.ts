// =============================================================================
// Homepage — pure display helpers (no React, no data fetching)
// =============================================================================

import type { CardAccent } from "@/components/ui"

// Accent colour per event slug — matches EVENT_MODULES metadata in constants.ts
const ACCENT_BY_SLUG: Record<string, CardAccent> = {
  ctf: "cyan",
  "trace-route": "neon",
  "project-showcase": "violet",
  poster: "pink",
  panel: "amber",
  workshops: "violet",
}

export function accentForSlug(slug: string): CardAccent {
  return ACCENT_BY_SLUG[slug] ?? "cyan"
}

/** "Day 01" / "Day 02" … */
export function dayLabel(day: number | null | undefined): string {
  if (!day || day < 1) {return "Event Day"}
  return `Day ${String(day).padStart(2, "0")}`
}

/** Human summary of how participants join a module. */
export function participationLabel(
  type: string,
  isTeamEvent: boolean,
  minTeamSize: number | null,
  maxTeamSize: number | null,
): string {
  if (type === "PANEL_DISCUSSION") {return "Open attendance"}
  if (type === "HANDS_ON") {return "Individual · limited seats"}
  if (!isTeamEvent) {return "Solo / Individual"}
  const lo = minTeamSize ?? 1
  const hi = maxTeamSize ?? 5
  return lo === hi ? `Team of ${lo}` : `Team ${lo}–${hi}`
}

/** Format an ISO date string as "24 Oct 2026" without timezone surprises. */
export function formatISODateShort(iso: string | null): string {
  if (!iso) {return "To be announced"}
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {return "To be announced"}
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(d)
}
