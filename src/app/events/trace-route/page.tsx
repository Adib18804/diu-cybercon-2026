// =============================================================================
// Trace & Route Module — /events/trace-route
// =============================================================================

import type { Metadata } from "next"

import { EventDetailPage } from "@/components/events"

export const revalidate = 120

export const metadata: Metadata = {
  title: "Trace & Route",
  description:
    "A solo networking competition at DIU CyberCon 2026 — routing, packet tracing, troubleshooting, and network security on 14 November at Daffodil Smart City.",
}

export default function TraceRouteEventPage() {
  return <EventDetailPage slug="trace-route" />
}
