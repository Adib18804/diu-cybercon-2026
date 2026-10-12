// =============================================================================
// Announcements — /announcements
// Organizer-published updates, newest first, pinned items promoted to the top.
// Only published announcements are ever visible (Part 22 — nothing invented;
// an honest empty state until the first update is released).
// =============================================================================

import { CalendarDays, Megaphone, Pin } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { formatISODateShort } from "@/components/home/helpers"
import { EmptyState, PageHeader } from "@/components/layout"
import { Reveal } from "@/components/ui"
import { prisma } from "@/lib/db"
import { cn } from "@/lib/utils"

export const revalidate = 60

export const metadata: Metadata = {
  title: "Announcements",
  description: "Official announcements and updates for DIU CyberCon 2026.",
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getAnnouncements() {
  try {
    return await prisma.announcement.findMany({
      where: { isPublished: true, deletedAt: null },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      take: 50,
      select: {
        id: true,
        title: true,
        content: true,
        isPinned: true,
        publishedAt: true,
      },
    })
  } catch {
    return []
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AnnouncementsPage() {
  const announcements = await getAnnouncements()

  return (
    <>
      <PageHeader
        label="// Latest Updates"
        title="Official announcements"
        description="Organizer-published updates about registration, the schedule, the venue, and everything in between — straight from the DIU CyberCon team."
        crumbs={[{ label: "Home", href: "/" }, { label: "Announcements" }]}
      />

      <section className="section">
        <div className="section-inner">
          {announcements.length === 0 ? (
            <EmptyState
              icon={<Megaphone className="h-6 w-6" aria-hidden="true" />}
              label="Nothing Published Yet"
              title="No announcements yet"
              description="Official updates will be published here as they are confirmed. In the meantime, explore the event modules or reach out to the organizing team."
              action={
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/events" className="btn-secondary">
                    Explore Modules
                  </Link>
                  <Link href="/contact" className="btn-secondary">
                    Contact the Team
                  </Link>
                </div>
              }
            />
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              {announcements.map((announcement, index) => (
                <Reveal key={announcement.id} delay={Math.min(index, 6) * 0.05}>
                  <article
                    className={cn(
                      "rounded-xl border bg-bg-panel p-6 md:p-8",
                      announcement.isPinned ? "border-amber/30" : "border-border",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      {announcement.isPinned && (
                        <span className="badge-amber inline-flex items-center gap-1.5">
                          <Pin className="h-3 w-3" aria-hidden="true" />
                          Pinned
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-text-faint">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {announcement.publishedAt
                          ? formatISODateShort(announcement.publishedAt.toISOString())
                          : "Recently"}
                      </span>
                    </div>

                    <h2 className="mt-3 font-display text-lg font-bold text-text-primary text-balance">
                      {announcement.title}
                    </h2>

                    <div className="mt-3 flex flex-col gap-3">
                      {announcement.content
                        .split(/\n\n+/)
                        .map((p) => p.trim())
                        .filter(Boolean)
                        .map((paragraph, i) => (
                          <p
                            key={i}
                            className="text-sm leading-relaxed text-text-muted whitespace-pre-line"
                          >
                            {paragraph}
                          </p>
                        ))}
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA strip ───────────────────────────────────────────────── */}
      <section className="pb-20 pt-4 md:pb-24">
        <div className="section-inner">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-cyan/25 bg-bg-panel px-6 py-10 text-center md:px-12 md:py-12">
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-radial-cyan opacity-40"
                aria-hidden="true"
              />
              <div className="relative">
                <p className="section-label justify-center">{"// Stay in the loop"}</p>
                <h2 className="mx-auto mt-3 max-w-2xl font-display text-section-h3 font-bold tracking-tight text-text-primary text-balance">
                  Don&apos;t miss a single update
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
                  Registration deadlines, schedule publications, and venue details all
                  land here first — or reach out to the organizing team directly.
                </p>
                <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link href="/contact" className="btn-primary">
                    Contact the Team
                  </Link>
                  <Link href="/schedule" className="btn-secondary">
                    View Schedule
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
