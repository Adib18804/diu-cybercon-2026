import { randomInt } from "node:crypto"

import type { EventType } from "@prisma/client"

import { REGISTRATION } from "@/lib/constants"

const REGISTRATION_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const EVENT_REGISTRATION_CODES: Record<EventType, string> = {
  CTF: "C",
  INNOVATION_SYMPOSIUM: "IS",
  TRACE_ROUTE: "TR",
  POSTER_PRESENTATION: "P",
  PROJECT_SHOWCASE: "PJ",
  PANEL_DISCUSSION: "PN",
  HANDS_ON: "W",
}

/** Create an event-specific ID with a transactionally allocated serial. */
export function generateRegistrationId(eventType: EventType, serial: number): string {
  const suffix = Array.from({ length: REGISTRATION.idLength }, () =>
    REGISTRATION_CHARS[randomInt(REGISTRATION_CHARS.length)],
  ).join("")
  return `CYB26-${EVENT_REGISTRATION_CODES[eventType]}-${serial}-${suffix}`
}
