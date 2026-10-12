// =============================================================================
// Project Showcasing Module — /events/project-showcase
// =============================================================================

import type { Metadata } from "next"

import { EventDetailPage } from "@/components/events"

export const revalidate = 120

export const metadata: Metadata = {
  title: "Project Showcasing",
  description:
    "Present your cybersecurity project to industry experts and academic judges at DIU CyberCon 2026. Approved submissions are published in the public showcase.",
}

export default function ProjectShowcaseEventPage() {
  return <EventDetailPage slug="project-showcase" />
}
