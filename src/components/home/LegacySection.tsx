import { Building2, GraduationCap, Newspaper, School, Users, Briefcase } from "lucide-react"

import type { HomeStats } from "./types"

import { Reveal } from "@/components/ui/Reveal"
import { SectionHeading } from "@/components/ui/SectionHeading"
import { LEGACY_2025 } from "@/lib/constants"


// =============================================================================
// LegacySection — Section 17
// Facts from the 2025 edition, clearly labelled as historical (Part 22:
// only numbers provided by the organisers are shown — nothing is invented).
// =============================================================================

export interface LegacySectionProps {
  stats: HomeStats
}

function LegacySection({ stats }: LegacySectionProps) {
  const universities = stats.universities2025 ?? LEGACY_2025.universities
  const colleges = stats.colleges2025 ?? LEGACY_2025.colleges
  const schools = stats.schools2025 ?? LEGACY_2025.schools
  const professionals = stats.professionals2025 ?? LEGACY_2025.professionals
  const teams = stats.teams2025 ?? LEGACY_2025.teams

  const breakdown = [
    {
      key: "universities",
      icon: GraduationCap,
      value: universities,
      label: "Universities",
      accent: "text-cyan border-cyan/20 bg-cyan/5",
    },
    {
      key: "colleges",
      icon: School,
      value: colleges,
      label: "Colleges",
      accent: "text-violet border-violet/20 bg-violet/5",
    },
    {
      key: "schools",
      icon: School,
      value: schools,
      label: "Schools",
      accent: "text-pink border-pink/20 bg-pink/5",
    },
    {
      key: "professionals",
      icon: Briefcase,
      value: professionals,
      label: "Professionals",
      accent: "text-amber border-amber/20 bg-amber/5",
    },
  ]

  return (
    <section className="section pt-0" id="legacy">
      <div className="section-inner">
        <Reveal>
          <SectionHeading
            label={`// CyberCon ${LEGACY_2025.year} — The Foundation`}
            title="Built on proven momentum"
            description="The 2025 edition set the national benchmark — CyberCon 2026 builds on it."
          />
        </Reveal>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          {/* Headline figure */}
          <Reveal>
            <div className="flex h-full flex-col justify-between rounded-xl border border-border bg-bg-panel p-6 shadow-glass">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="section-label">Participants · 2025</p>
                  <p className="mt-3 font-display text-5xl font-extrabold leading-none text-cyan md:text-6xl">
                    {teams}
                    <span className="ml-2 text-2xl text-text-muted md:text-3xl">teams</span>
                  </p>
                </div>
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan/20 bg-cyan/5 text-cyan"
                  aria-hidden="true"
                >
                  <Users className="h-5 w-5" />
                </span>
              </div>

              <div className="mt-6 space-y-2">
                <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-text-faint">
                  <Newspaper className="h-3.5 w-3.5" aria-hidden="true" />
                  Covered by
                </p>
                <div className="flex flex-wrap gap-2">
                  {LEGACY_2025.mediaTypes.map((media) => (
                    <span key={media} className="badge-muted text-[0.65rem]">
                      {media}
                    </span>
                  ))}
                </div>
              </div>

              <p className="mt-6 border-t border-border pt-4 font-mono text-[0.65rem] uppercase tracking-widest text-text-faint">
                Historical data · CyberCon {LEGACY_2025.year} edition
              </p>
            </div>
          </Reveal>

          {/* Org breakdown */}
          <Reveal delay={0.1}>
            <div className="flex h-full flex-col rounded-xl border border-border bg-bg-panel p-6">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-violet" aria-hidden="true" />
                <p className="font-mono text-xs font-bold uppercase tracking-widest text-text-muted">
                  {universities + colleges + schools + professionals} organizations represented
                </p>
              </div>

              <div className="mt-5 grid flex-1 grid-cols-2 gap-3">
                {breakdown.map((item) => (
                  <div
                    key={item.key}
                    className={`flex flex-col justify-center rounded-lg border p-4 ${item.accent}`}
                  >
                    <item.icon className="mb-2 h-4 w-4 opacity-70" aria-hidden="true" />
                    <p className="font-display text-2xl font-extrabold leading-none">
                      {item.value}
                    </p>
                    <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-widest text-text-muted">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

export { LegacySection }
