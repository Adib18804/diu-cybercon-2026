import type { MetadataRoute } from "next"

import { prisma } from "@/lib/db"

// =============================================================================
// Auto-generated sitemap — dynamic, database-aware.
// Rendered per-request (force-dynamic) so lastModified reflects live content:
// the latest published announcement / updated event drives the timestamp for
// the home + announcements entries. Falls back to the current time if the
// database is unavailable so crawlers always receive a valid sitemap.
// =============================================================================

export const dynamic = "force-dynamic"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.diucybercon.com"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // ── Live timestamps for dynamic pages (best-effort, never fatal) ─────────
  let contentUpdatedAt: Date = now
  let scheduleUpdatedAt: Date = now

  try {
    const [latestAnnouncement, latestEventUpdate] = await Promise.all([
      prisma.announcement.findFirst({
        where: { isPublished: true, deletedAt: null },
        orderBy: { publishedAt: "desc" },
        select: { publishedAt: true, updatedAt: true },
      }),
      prisma.event.findFirst({
        where: { status: { in: ["OPEN", "CLOSED", "COMPLETED"] } },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
    ])

    if (latestAnnouncement) {
      contentUpdatedAt = latestAnnouncement.publishedAt ?? latestAnnouncement.updatedAt
    }
    if (latestEventUpdate) {
      scheduleUpdatedAt = latestEventUpdate.updatedAt
    }
  } catch {
    // Database unavailable — fall back to `now` so the sitemap still serves.
  }

  // ── Static public pages ─────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: contentUpdatedAt,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/events`,
      lastModified: scheduleUpdatedAt,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/events/ctf`,
      lastModified: scheduleUpdatedAt,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/events/project-showcase`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/events/poster`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/events/trace-route`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/events/panel`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/events/workshops`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/schedule`,
      lastModified: scheduleUpdatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/speakers`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/sponsors`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/partners`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/gallery`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/announcements`,
      lastModified: contentUpdatedAt,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/faq`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/venue`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/register`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },
  ]

  return staticPages
}
