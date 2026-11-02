// =============================================================================
// Schedule — /schedule
// The full three-day program. Session rows come live from the database
// (Part 22 — the timetable shows exactly what the organiser has published);
// confirmed event days always render, with honest TBA states in between.
// =============================================================================

import { ArrowRight, Clock, Info, MapPin } from "lucide-react"
import type { Metadata, Route } from "next"
import Link from "next/link"

import { formatISODateShort } from "@/components/home/helpers"
import { PageHeader } from "@/components/layout"
import { Reveal } from "@/components/ui"
import { EVENT_DATES } from "@/lib/constants"
import { prisma } from "@/lib/db"

export const revalidate = 120

export const metadata: Metadata = {
  title: "Schedule",
  description:
    "Full event schedule for DIU_CYBERCON 2026 — online prelims and onsite finals.",
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SCHEDULE_DAYS = [
  { day: 1, ...EVENT_DATES.day1 },
  { day: 2, ...EVENT_DATES.day2 },
  { day: 3, ...EVENT_DATES.day3 },
] as const

async function getScheduleItems() {
  try {
    return await prisma.scheduleItem.findMany({
      orderBy: [{ day: "asc" }, { startTime: "asc" }, { displayOrder: "asc" }],
      include: {
        event: { select: { name: true, slug: true } },
      },
    })
  } catch {
    return []
  }
}

const TYPE_BADGE: Record<string, string> = {
  COMPETITION: "badge-cyan",
  WORKSHOP: "badge-neon",
  SESSION: "badge-violet",
  CEREMONY: "badge-amber",
  BREAK: "badge-muted",
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SchedulePage() {
  const items = await getScheduleItems()
  const hasPublishedItems = items.length > 0

  return (
    <>
      <PageHeader
        label="// Program"
        title="Three days, one timeline"
        description="The online CTF preliminary round is on 24 October, followed by the on-site event at Daffodil Smart City on 12 December. Confirmed sessions appear here as they are published."
        crumbs={[{ label: "Home", href: "/" }, { label: "Schedule" }]}
        actions={
          <>
            <Link href="/register" className="btn-primary gap-2">
              Register Now
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/events" className="btn-secondary">
              Explore Modules
            </Link>
          </>
        }
      >
        <nav className="mt-8 flex flex-wrap gap-2" aria-label="Jump to day">
          {SCHEDULE_DAYS.map((d) => (
            <a
              key={d.day}
              href={`#day-${d.day}`}
              className="rounded-full border border-border px-4 py-1.5 font-mono text-xs text-text-muted transition-colors duration-250 hover:border-cyan/40 hover:bg-cyan/5 hover:text-cyan"
            >
              {d.label} · {formatISODateShort(d.date)}
            </a>
          ))}
        </nav>
      </PageHeader>

      <section className="section">
        <div className="section-inner">
          {!hasPublishedItems && (
            <Reveal>
              <div className="mb-14 flex items-start gap-3 rounded-xl border border-cyan/25 bg-cyan/5 p-5">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-text-muted">
                  The confirmed event days are listed below. The detailed session-level
                  timetable is being finalized and will be published here — watch the{" "}
                  <Link
                    href="/announcements"
                    className="text-cyan underline-offset-4 hover:underline"
                  >
                    announcements page
                  </Link>{" "}
                  for updates.
                </p>
              </div>
            </Reveal>
          )}

          <div className="flex flex-col gap-16">
            {SCHEDULE_DAYS.map((d) => {
              const dayItems = items.filter((item) => item.day === d.day)

              return (
                <div key={d.day} id={`day-${d.day}`} className="scroll-mt-24">
                  <Reveal>
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/5 font-display text-lg font-bold text-cyan">
                        {String(d.day).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-text-faint">
                          {d.label}
                        </p>
                        <h2 className="font-display text-xl font-bold text-text-primary">
                          {formatISODateShort(d.date)}
                        </h2>
                        <p className="mt-0.5 text-sm text-text-muted">{d.description}</p>
                      </div>
                    </div>
                  </Reveal>

                  {dayItems.length > 0 ? (
                    <ul className="mt-8">
                      {dayItems.map((item) => (
                        <li
                          key={item.id}
                          className="relative border-l border-border pb-8 pl-6 last:pb-0"
                        >
                          <span
                            className="absolute -left-[5px] top-1.5 h-[9px] w-[9px] rounded-full border-2 border-cyan bg-bg-deep"
                            aria-hidden="true"
                          />
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-cyan">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              {item.startTime} – {item.endTime}
                            </span>
                            <span className={TYPE_BADGE[item.type] ?? "badge-muted"}>
                              {item.type}
                            </span>
                            {item.isHighlight && <span className="badge-amber">Highlight</span>}
                          </div>
                          <h3 className="mt-2 font-display text-base font-bold text-text-primary">
                            {item.title}
                          </h3>
                          {item.description && (
                            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">
                              {item.description}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-4 font-mono text-[0.6875rem] uppercase tracking-wider text-text-faint">
                            {item.venue && (
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="h-3 w-3" aria-hidden="true" />
                                {item.venue}
                              </span>
                            )}
                            {item.event && (
                              <Link
                                href={`/events/${item.event.slug}` as Route}
                                className="text-cyan underline-offset-4 hover:underline"
                              >
                                {item.event.name} →
                              </Link>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Reveal delay={0.06}>
                      <div className="mt-8 rounded-xl border border-dashed border-border bg-bg-panel/50 px-6 py-10 text-center">
                        <p className="font-mono text-[0.6875rem] uppercase tracking-widest text-text-faint">
                          To Be Announced
                        </p>
                        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-muted">
                          The detailed timetable for this day will be published closer to
                          the event. Check back soon or follow the announcements page.
                        </p>
                      </div>
                    </Reveal>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────── */}
      <section className="pb-20 pt-4 md:pb-24">
        <div className="section-inner">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-cyan/25 bg-bg-panel px-6 py-10 text-center md:px-12 md:py-12">
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-radial-cyan opacity-40"
                aria-hidden="true"
              />
              <div className="relative">
                <p className="section-label justify-center">{"// Plan your three days"}</p>
                <h2 className="mx-auto mt-3 max-w-2xl font-display text-section-h3 font-bold tracking-tight text-text-primary text-balance">
                  Secure your seat before the program fills up
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
                  Registration covers the CTF, Innovation Symposium, Panel Discussion,
                  and hands-on workshops on 12 December.
                </p>
                <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link href="/register" className="btn-primary gap-2">
                    Register Now
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link href="/venue" className="btn-secondary">
                    Venue &amp; Directions
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
