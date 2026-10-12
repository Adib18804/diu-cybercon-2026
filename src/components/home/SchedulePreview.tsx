"use client"

import { CalendarDays, Clock, MapPin } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import * as React from "react"

import type { HomeEvent, HomeScheduleItem } from "./types"

import { Tabs } from "@/components/ui"
import { Reveal } from "@/components/ui/Reveal"
import { SectionHeading } from "@/components/ui/SectionHeading"
import { EVENT_DATES } from "@/lib/constants"
import { cn } from "@/lib/utils"


// =============================================================================
// SchedulePreview — Section 14
// Three-day tabs. Shows published schedule items from the database; otherwise
// falls back to the official per-day programme outline (never invented).
// =============================================================================

export interface SchedulePreviewProps {
  schedule: HomeScheduleItem[]
  events: HomeEvent[]
}

const DAYS = [
  { value: "day1", label: "Day 01 — 24 Oct", sub: "Online", date: EVENT_DATES.day1 },
  { value: "day2", label: "Day 02 — 14 Nov", sub: "On-site", date: EVENT_DATES.day2 },
  { value: "day3", label: "Day 03 — 15 Nov", sub: "On-site", date: EVENT_DATES.day3 },
] as const

const TYPE_BADGE: Record<string, string> = {
  SESSION: "badge-cyan",
  COMPETITION: "badge-neon",
  CEREMONY: "badge-amber",
  BREAK: "badge-muted",
}

function SchedulePreview({ schedule, events }: SchedulePreviewProps) {
  const [activeDay, setActiveDay] = React.useState<string>("day2")

  const tabs = DAYS.map((day) => ({
    value: day.value,
    label: (
      <span className="flex items-center gap-2">
        <span>{day.label}</span>
        <span className="hidden font-mono text-[0.6rem] uppercase tracking-wider opacity-60 sm:inline">
          {day.sub}
        </span>
      </span>
    ),
  }))

  const activeDayNumber = activeDay === "day1" ? 1 : activeDay === "day3" ? 3 : 2
  const activeConfig = DAYS.find((d) => d.value === activeDay) ?? DAYS[1]
  const dayItems = schedule
    .filter((item) => item.day === activeDayNumber)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const dayEvents = events.filter((event) => event.eventDay === activeDayNumber)

  return (
    <section className="section pt-0" id="schedule">
      <div className="section-inner">
        <Reveal>
          <SectionHeading
            label="// Schedule"
            title="Three days, one mission"
            description="Online preliminaries on 24 October, then two full on-site days at Daffodil Smart City."
            action={
              <Link href="/schedule" className="btn-secondary">
                Full Schedule
              </Link>
            }
          />
        </Reveal>

        <Reveal delay={0.1} className="mt-10">
          <Tabs
            tabs={tabs}
            value={activeDay}
            onChange={setActiveDay}
            variant="pill"
            layoutId="home-schedule-tabs"
          >
            <div className="rounded-xl border border-border bg-bg-panel p-6 md:p-8">
              {dayItems.length > 0 ? (
                /* ── Published schedule items ─────────────────────────── */
                <ol className="flex flex-col">
                  {dayItems.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        "relative flex flex-col gap-2 border-l border-border pb-8 pl-6 last:pb-0",
                        item.isHighlight && "border-l-cyan",
                      )}
                    >
                      {/* Node dot */}
                      <span
                        className={cn(
                          "absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-bg-panel bg-text-faint",
                          item.isHighlight && "bg-cyan shadow-glow-cyan-sm",
                        )}
                        aria-hidden="true"
                      />

                      <div className="flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-cyan">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {item.startTime} – {item.endTime}
                        </span>
                        <span className={TYPE_BADGE[item.type] ?? "badge-muted"}>
                          {item.type}
                        </span>
                        {item.isHighlight && (
                          <span className="badge-amber">Highlight</span>
                        )}
                      </div>

                      <h3 className="font-display text-base font-bold tracking-tight text-text-primary">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="max-w-2xl text-sm leading-relaxed text-text-muted">
                          {item.description}
                        </p>
                      )}
                      {item.venue && (
                        <p className="flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-text-faint">
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          {item.venue}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                /* ── Honest fallback — official outline only ──────────── */
                <div className="flex flex-col gap-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/5">
                      <CalendarDays className="h-5 w-5 text-cyan" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-mono text-xs uppercase tracking-widest text-cyan">
                        {activeConfig.date.label}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-text-muted">
                        {activeConfig.date.description}
                      </p>
                    </div>
                  </div>

                  {dayEvents.length > 0 && (
                    <div>
                      <p className="mb-3 font-mono text-[0.6875rem] uppercase tracking-wider text-text-faint">
                        Modules on this day
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {dayEvents.map((event) => (
                          <Link
                            key={event.id}
                            href={`/events/${event.slug}` as Route}
                            className="badge-cyan transition-colors hover:bg-cyan/20"
                          >
                            {event.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="border-t border-border pt-4 font-mono text-xs text-text-faint">
                    {"// Detailed timetable — to be announced"}
                  </p>
                </div>
              )}
            </div>
          </Tabs>
        </Reveal>
      </div>
    </section>
  )
}

export { SchedulePreview }
