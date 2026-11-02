// =============================================================================
// CTF Module — /events/ctf
// =============================================================================

import type { Metadata } from "next"

import { EventDetailPage } from "@/components/events"

export const revalidate = 120

export const metadata: Metadata = {
  title: "Capture The Flag (CTF)",
  description:
    "Team-based Capture The Flag competition at DIU_CYBERCON 2026 — free online preliminaries and finals on 12 December at the Library Zone. Teams of up to 4.",
}

export default function CtfEventPage() {
  return <EventDetailPage slug="ctf" />
}
