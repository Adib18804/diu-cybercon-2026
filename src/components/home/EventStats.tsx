import { CalendarDays, Layers } from "lucide-react"

import type { HomeStats } from "./types"

import { StatCard } from "@/components/ui"
import { Reveal } from "@/components/ui/Reveal"
import { SectionHeading } from "@/components/ui/SectionHeading"

export interface EventStatsProps {
  stats: HomeStats
}

function EventStats({ stats }: EventStatsProps) {
  return (
    <section className="section pt-0">
      <div className="section-inner">
        <Reveal>
          <SectionHeading
            label="// By the Numbers"
            title="One stage, national reach"
            description="A focused 2026 program built around competition and cybersecurity innovation."
          />
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <StatCard
            value={stats.moduleCount}
            label="Events"
            description="CTF · Innovation Symposium · Panel · Workshops"
            icon={<Layers className="h-5 w-5" aria-hidden="true" />}
            accent="cyan"
            animateDelay={0}
          />
          <StatCard
            value={stats.dayCount}
            label="Event Days"
            description="12 Dec 2026 · Library Zone · Student Lounge · Shadinota Shommelon Kendro · ICH"
            icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
            accent="violet"
            animateDelay={0.1}
          />
        </div>
      </div>
    </section>
  )
}

export { EventStats }
