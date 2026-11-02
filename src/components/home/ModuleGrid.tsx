import Link from "next/link"

import { accentForSlug, dayLabel, participationLabel } from "./helpers"
import { moduleIconComponent } from "./icons"
import type { HomeEvent } from "./types"

import { BentoCard } from "@/components/ui"
import { Reveal } from "@/components/ui/Reveal"
import { SectionHeading } from "@/components/ui/SectionHeading"


// =============================================================================
// ModuleGrid — Section 06
// Current flagship events as a bento grid, driven by the database.
// =============================================================================

export interface ModuleGridProps {
  events: HomeEvent[]
}

function ModuleGrid({ events }: ModuleGridProps) {
  return (
    <section className="section" id="modules">
      <div className="section-inner">
        <Reveal>
          <SectionHeading
            label="// Event Modules"
            title="Compete or innovate"
            description="Join the CTF, Innovation Symposium, Panel Discussion, or a hands-on workshop."
            action={
              <Link href="/events" className="btn-secondary">
                All Events
              </Link>
            }
          />
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event, index) => {
            const Icon = moduleIconComponent(event.iconName)
            const accent = accentForSlug(event.slug)

            return (
              <BentoCard
                key={event.id}
                title={event.name}
                description={event.shortDescription}
                icon={<Icon className="h-6 w-6" aria-hidden="true" />}
                accent={accent}
                badge={dayLabel(event.eventDay)}
                meta={[
                  participationLabel(
                    event.type,
                    event.isTeamEvent,
                    event.minTeamSize,
                    event.maxTeamSize,
                  ),
                  event.registrationOpen ? "Registration open" : "Registration closed",
                ].join(" · ")}
                href={`/events/${event.slug}`}
                animateDelay={index * 0.08}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}

export { ModuleGrid }
