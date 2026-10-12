import { Building2, CalendarDays, Layers, Users } from "lucide-react"

import type { HomeStats } from "./types"

import { StatCard } from "@/components/ui"
import { Reveal } from "@/components/ui/Reveal"
import { SectionHeading } from "@/components/ui/SectionHeading"
import { LEGACY_2025 } from "@/lib/constants"


// =============================================================================
// EventStats — Section 05
// Current-edition facts + clearly-labelled 2025 legacy numbers (Part 22).
// =============================================================================

export interface EventStatsProps {
  stats: HomeStats
}

function EventStats({ stats }: EventStatsProps) {
  const totalOrgs =
    (stats.universities2025 ?? 0) +
    (stats.colleges2025 ?? 0) +
    (stats.schools2025 ?? 0) +
    (stats.professionals2025 ?? 0)

  const orgBreakdown = [
    stats.universities2025 !== null ? `${stats.universities2025} universities` : null,
    stats.colleges2025 !== null ? `${stats.colleges2025} colleges` : null,
    stats.schools2025 !== null ? `${stats.schools2025} schools` : null,
    stats.professionals2025 !== null ? `${stats.professionals2025} professionals` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <section className="section pt-0">
      <div className="section-inner">
        <Reveal>
          <SectionHeading
            label="// By the Numbers"
            title="One stage, national reach"
            description="What CyberCon 2026 brings — and what the 2025 edition proved."
          />
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            value={stats.moduleCount}
            label="Event Modules"
            description="CTF, Trace & Route, Project, Poster, Panel, Hands-on"
            icon={<Layers className="h-5 w-5" aria-hidden="true" />}
            accent="cyan"
            animateDelay={0}
          />
          <StatCard
            value={stats.dayCount}
            label="Event Days"
            description="24 Oct online · 14–15 Nov on-site"
            icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
            accent="violet"
            animateDelay={0.1}
          />
          <StatCard
            value={stats.teams2025 ?? LEGACY_2025.teams}
            label="Teams · CyberCon 2025"
            description="Historical — last edition's participation"
            icon={<Users className="h-5 w-5" aria-hidden="true" />}
            accent="neon"
            animateDelay={0.2}
          />
          <StatCard
            value={totalOrgs || LEGACY_2025.totalOrgs}
            label="Organizations · 2025"
            description={orgBreakdown || "Universities, colleges, schools & professionals"}
            icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
            accent="amber"
            animateDelay={0.3}
          />
        </div>
      </div>
    </section>
  )
}

export { EventStats }
