import {
  Flag,
  GraduationCap,
  Lock,
  ShieldCheck,
} from "lucide-react"

import { TerminalWindow } from "@/components/ui"
import { Reveal } from "@/components/ui/Reveal"
import { SectionHeading } from "@/components/ui/SectionHeading"
import { EVENT_DATES, ORGANIZER, VENUE } from "@/lib/constants"

// =============================================================================
// EventIntro — Section 04
// What DIU CyberCon 2026 is, who runs it, and the three-day shape.
// =============================================================================

export interface EventIntroProps {
  description: string
  organizerName: string
}

const PILLARS = [
  {
    icon: GraduationCap,
    title: "Learn",
    text: "Talks, panels and hands-on labs led by industry professionals.",
    accent: "text-cyan",
  },
  {
    icon: Flag,
    title: "Compete",
    text: "Six national events — from CTF to project showcases with published results.",
    accent: "text-neon",
  },
  {
    icon: Lock,
    title: "Secure",
    text: "Real-world offensive and defensive security challenges.",
    accent: "text-violet",
  },
  {
    icon: ShieldCheck,
    title: "Defend",
    text: "Build the talent pipeline Bangladesh's cyber defence needs.",
    accent: "text-amber",
  },
] as const

function EventIntro({ description, organizerName }: EventIntroProps) {
  return (
    <section className="section" id="about">
      <div className="section-inner">
        <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          {/* ── Left — copy + pillars ─────────────────────────────────────── */}
          <Reveal>
            <SectionHeading
              label="// About the Event"
              title="A national stage built for cyber talent"
              description={description}
            />

            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-text-muted">
              Organised by the {ORGANIZER.name}, DIU CyberCon connects
              university, college and school teams, professionals, and industry
              leaders across three days of competition, learning and
              collaboration — starting with online CTF preliminaries and
              culminating in the on-site finals at {VENUE.name}.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {PILLARS.map((pillar) => (
                <div
                  key={pillar.title}
                  className="flex items-start gap-3 rounded-lg border border-border bg-bg-panel p-4 transition-colors duration-250 hover:border-cyan/30"
                >
                  <pillar.icon
                    className={`mt-0.5 h-5 w-5 shrink-0 ${pillar.accent}`}
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-text-primary">
                      {pillar.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">
                      {pillar.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          {/* ── Right — event.config terminal ─────────────────────────────── */}
          <Reveal from="right" delay={0.15}>
            <TerminalWindow title="cybercon@diu: ~/about" animate>
              <div className="flex flex-col gap-2.5 text-[0.8125rem]">
                <p className="text-text-muted">
                  <span className="text-neon">$</span> cybercon --info
                </p>
                <dl className="flex flex-col gap-2 pl-4">
                  {[
                    ["event", "DIU CyberCon 2026"],
                    ["tagline", "LEARN · SECURE · DEFEND"],
                    ["organizer", ORGANIZER.shortName + " — Department of CSE, DIU"],
                    ["format", "Online prelims + 2 on-site days"],
                    ["dates", "24 Oct · 14–15 Nov 2026"],
                    ["venue", VENUE.shortAddress],
                    ["modules", "6 national events"],
                  ].map(([key, value]) => (
                    <div key={key} className="flex gap-3">
                      <dt className="w-20 shrink-0 text-text-faint">{key}</dt>
                      <dd className="text-text-primary">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-text-muted">
                  <span className="text-neon">$</span> cat ./days/plan
                </p>
                <div className="flex flex-col gap-1.5 pl-4">
                  {[EVENT_DATES.day1, EVENT_DATES.day2, EVENT_DATES.day3].map(
                    (day) => (
                      <p key={day.date} className="text-text-muted">
                        <span className="text-cyan">{day.label}</span>{" "}
                        — {day.description}
                      </p>
                    ),
                  )}
                </div>
                <p className="flex items-center gap-2 pt-1 text-text-primary">
                  <span className="text-neon" aria-hidden="true">●</span>
                  <span className="text-text-faint">
                    hosted by {organizerName.length > 60 ? ORGANIZER.shortName : organizerName}
                  </span>
                </p>
              </div>
            </TerminalWindow>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

export { EventIntro }
