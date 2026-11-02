// =============================================================================
// Panel Discussion Module — /events/panel
// =============================================================================

import type { Metadata } from "next"

import { EventDetailPage } from "@/components/events"

export const revalidate = 120

export const metadata: Metadata = {
  title: "Panel Discussion",
  description:
    "An expert panel discussion on cutting-edge cybersecurity topics at DIU_CYBERCON 2026 — open for attendance registration. Topic and panelists announced as confirmed.",
}

export default function PanelEventPage() {
  return <EventDetailPage slug="panel" />
}
