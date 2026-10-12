// =============================================================================
// CTF Module — /events/ctf
// =============================================================================

import type { Metadata } from "next"

import { EventDetailPage } from "@/components/events"

export const revalidate = 120

export const metadata: Metadata = {
  title: "Capture The Flag (CTF)",
  description:
    "Team-based Capture The Flag competition at DIU CyberCon 2026 — online prelims on 24 October, on-site finals on 14–15 November at Daffodil Smart City. Teams of 2–5.",
}

export default function CtfEventPage() {
  return <EventDetailPage slug="ctf" />
}
