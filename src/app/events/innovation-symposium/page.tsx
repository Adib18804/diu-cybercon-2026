// Innovation Symposium — combined project and poster presentations.

import type { Metadata } from "next"

import { EventDetailPage } from "@/components/events"

export const revalidate = 120

export const metadata: Metadata = {
  title: "Innovation Symposium",
  description:
    "Present an original cybersecurity project or research idea at the DIU_CYBERCON 2026 Innovation Symposium. Teams of up to three choose a domain and submit an idea summary.",
}

export default function InnovationSymposiumPage() {
  return <EventDetailPage slug="innovation-symposium" />
}
