import { ArrowRight } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"


import { accentForSlug, dayLabel, participationLabel } from "./helpers"
import { moduleIconComponent } from "./icons"
import type { HomeEvent } from "./types"

import { Reveal } from "@/components/ui/Reveal"
import { SectionHeading } from "@/components/ui/SectionHeading"

// =============================================================================
// ModulePreviews — Sections 09–12
// Richer preview cards for the remaining four modules.
// =============================================================================

export interface ModulePreviewsProps {
  events: HomeEvent[]
}

const ACCENT_TEXT: Record<string, string> = {
  cyan: "text-cyan",
  neon: "text-neon",
  violet: "text-violet",
  pink: "text-pink",
  amber: "text-amber",
}

const ACCENT_BORDER: Record<string, string> = {
  cyan: "hover:border-cyan/40",
  neon: "hover:border-neon/40",
  violet: "hover:border-violet/40",
  pink: "hover:border-pink/40",
  amber: "hover:border-amber/40",
}

function ModulePreviews({ events }: ModulePreviewsProps) {
  if (events.length === 0) {return null}

  return (
    <section className="section pt-0">
      <div className="section-inner">
        <Reveal>
          <SectionHeading
            label="// More Modules"
            title="Beyond the flags"
            description="Presentation, research, and hands-on tracks open across the on-site days."
          />
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {events.map((event, index) => {
            const Icon = moduleIconComponent(event.iconName)
            const accent = accentForSlug(event.slug)
            const accentText = ACCENT_TEXT[accent] ?? "text-cyan"

            return (
              <Reveal key={event.id} delay={index * 0.08}>
                <Link
                  href={`/events/${event.slug}` as Route}
                  className={`group flex h-full flex-col rounded-xl border border-border bg-bg-panel p-6 transition-all duration-400 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:shadow-card-hover ${ACCENT_BORDER[accent] ?? ""}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-lg border border-current/20 bg-current/5 ${accentText}`}
                      aria-hidden="true"
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="badge-muted">{dayLabel(event.eventDay)}</span>
                  </div>

                  <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-text-primary">
                    {event.name}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-text-muted">
                    {event.shortDescription}
                  </p>

                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                    <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-text-faint">
                      {participationLabel(
                        event.type,
                        event.isTeamEvent,
                        event.minTeamSize,
                        event.maxTeamSize,
                      )}
                      {event.registrationOpen && (
                        <span className="ml-2 text-neon">· open</span>
                      )}
                    </span>
                    <span
                      className={`flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider transition-transform duration-250 group-hover:translate-x-1 ${accentText}`}
                    >
                      Details
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export { ModulePreviews }
