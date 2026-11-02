// =============================================================================
// Hands-on Activities Module — /events/workshops
// =============================================================================

import type { Metadata } from "next"

import { EventDetailPage } from "@/components/events"

export const revalidate = 120

export const metadata: Metadata = {
  title: "Hands-on Activities",
  description:
    "Practical cybersecurity workshops led by industry professionals at DIU_CYBERCON 2026. Limited seats per activity — register early. Schedule announced as confirmed.",
}

export default function WorkshopsEventPage() {
  return <EventDetailPage slug="workshops" />
}
