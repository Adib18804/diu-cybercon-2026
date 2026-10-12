// =============================================================================
// Poster Presentation Module — /events/poster
// =============================================================================

import type { Metadata } from "next"

import { EventDetailPage } from "@/components/events"

export const revalidate = 120

export const metadata: Metadata = {
  title: "Poster Presentation",
  description:
    "Present your cybersecurity research through an academic-style poster at DIU CyberCon 2026. Approved posters are displayed on-site and published publicly.",
}

export default function PosterEventPage() {
  return <EventDetailPage slug="poster" />
}
