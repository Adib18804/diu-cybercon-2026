import { ArrowRight, CalendarDays, MapPin, Trophy, Users } from "lucide-react"
import Link from "next/link"

import { formatISODateShort } from "./helpers"
import type { HomeEvent } from "./types"

import { TerminalWindow } from "@/components/ui"
import { Reveal } from "@/components/ui/Reveal"
import { SectionHeading } from "@/components/ui/SectionHeading"
import { CTF_DOMAINS } from "@/lib/constants"


// =============================================================================
// ModuleFeatures — Sections 07 + 08
// Deep feature panels for the two flagship modules: CTF and Trace & Route.
// Content comes from the database — never invented (Part 22). Prize fields
// render "To be announced" until the organiser publishes them.
// =============================================================================

export interface ModuleFeaturesProps {
  ctf: HomeEvent | null
  traceRoute: HomeEvent | null
}

function findEvent(events: (HomeEvent | null)[]): HomeEvent | null {
  return events.find((e): e is HomeEvent => e !== null) ?? null
}

function ModuleFeatures({ ctf, traceRoute }: ModuleFeaturesProps) {
  const ctfEvent = findEvent([ctf])
  const trEvent = findEvent([traceRoute])

  if (!ctfEvent && !trEvent) {return null}

  return (
    <section className="section pt-0">
      <div className="section-inner flex flex-col gap-16 md:gap-24">
        {/* ══ 07 — Capture The Flag ══════════════════════════════════════ */}
        {ctfEvent && (
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <span className="badge-cyan mb-5">
                Flagship · {ctfEvent.registrationOpen ? "Registration Open" : "Registration Closed"}
              </span>
              <SectionHeading
                label="// Featured Module — Day 01"
                title={ctfEvent.name}
                description={ctfEvent.shortDescription}
              />

              <p className="mt-5 max-w-xl text-sm leading-relaxed text-text-muted">
                {ctfEvent.fullDescription}
              </p>

              {/* Fact strip */}
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-bg-panel p-3">
                  <Users className="mb-2 h-4 w-4 text-cyan" aria-hidden="true" />
                  <p className="font-mono text-xs text-text-faint uppercase tracking-wider">
                    Team size
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-text-primary">
                    {ctfEvent.minTeamSize ?? 2}–{ctfEvent.maxTeamSize ?? 5} members
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-bg-panel p-3">
                  <CalendarDays className="mb-2 h-4 w-4 text-cyan" aria-hidden="true" />
                  <p className="font-mono text-xs text-text-faint uppercase tracking-wider">
                    Deadline
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-text-primary">
                    {formatISODateShort(ctfEvent.registrationDeadline)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-bg-panel p-3">
                  <Trophy className="mb-2 h-4 w-4 text-cyan" aria-hidden="true" />
                  <p className="font-mono text-xs text-text-faint uppercase tracking-wider">
                    Prizes
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-text-primary">
                    {ctfEvent.prizes || "To be announced"}
                  </p>
                </div>
              </div>

              {ctfEvent.venue && (
                <p className="mt-5 flex items-center gap-2 font-mono text-xs text-text-muted">
                  <MapPin className="h-3.5 w-3.5 text-cyan" aria-hidden="true" />
                  {ctfEvent.venue}
                </p>
              )}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/events/ctf" className="btn-primary gap-2">
                  CTF Details
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/register" className="btn-secondary">
                  Register a Team
                </Link>
              </div>
            </Reveal>

            {/* Domain terminal */}
            <Reveal from="right" delay={0.15}>
              <TerminalWindow title="ctf@cybercon: ~/domains">
                <p className="text-text-muted">
                  <span className="text-neon">$</span> cat domains.txt
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {CTF_DOMAINS.map((domain, i) => (
                    <li key={domain} className="flex items-center gap-3">
                      <span className="text-text-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-cyan">{domain}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-text-muted">
                  <span className="text-neon">$</span> echo $FORMAT
                </p>
                <p className="mt-1 pl-4 text-text-primary">
                  Online prelims → on-site finals
                </p>
              </TerminalWindow>
            </Reveal>
          </div>
        )}

        {/* ══ 08 — Trace & Route ═════════════════════════════════════════ */}
        {trEvent && (
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            {/* Visual — route path */}
            <Reveal from="left" className="order-2 lg:order-1">
              <div className="rounded-xl border border-neon/20 bg-bg-panel p-6 md:p-8">
                <p className="section-label text-neon">{"// network map"}</p>
                <div className="mt-4 flex flex-col gap-3 font-mono text-xs">
                  {[
                    { node: "you", label: "192.168.10.24", accent: "text-text-faint" },
                    { node: "gateway", label: "192.168.10.1", accent: "text-text-muted" },
                    { node: "isp-edge", label: "103.108.144.1", accent: "text-text-muted" },
                    { node: "target", label: "10.20.0.14 — ???", accent: "text-neon" },
                  ].map((hop, i) => (
                    <div key={hop.node} className="flex items-center gap-3">
                      <span className="w-16 text-neon">{i + 1} hop</span>
                      <span className="w-20 text-text-faint">{hop.node}</span>
                      <span className={hop.accent}>{hop.label}</span>
                    </div>
                  ))}
                  <p className="mt-2 border-t border-border pt-3 text-text-muted">
                    <span className="text-neon">$</span> tracert --find-the-path
                    <span className="ml-1 inline-block h-3.5 w-2 animate-cursor-blink bg-neon align-middle motion-reduce:animate-none" />
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal className="order-1 lg:order-2">
              <span className="badge-neon mb-5">
                {trEvent.registrationOpen ? "Registration Open" : "Registration Closed"}
              </span>
              <SectionHeading
                label="// Featured Module — Day 02"
                title={trEvent.name}
                description={trEvent.shortDescription}
              />

              <p className="mt-5 max-w-xl text-sm leading-relaxed text-text-muted">
                {trEvent.fullDescription}
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-bg-panel p-3">
                  <Users className="mb-2 h-4 w-4 text-neon" aria-hidden="true" />
                  <p className="font-mono text-xs text-text-faint uppercase tracking-wider">
                    Format
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-text-primary">Solo</p>
                </div>
                <div className="rounded-lg border border-border bg-bg-panel p-3">
                  <CalendarDays className="mb-2 h-4 w-4 text-neon" aria-hidden="true" />
                  <p className="font-mono text-xs text-text-faint uppercase tracking-wider">
                    Deadline
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-text-primary">
                    {formatISODateShort(trEvent.registrationDeadline)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-bg-panel p-3">
                  <Trophy className="mb-2 h-4 w-4 text-neon" aria-hidden="true" />
                  <p className="font-mono text-xs text-text-faint uppercase tracking-wider">
                    Prizes
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-text-primary">
                    {trEvent.prizes || "To be announced"}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/events/trace-route" className="btn-neon gap-2">
                  Trace &amp; Route Details
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/register" className="btn-secondary">
                  Register Solo
                </Link>
              </div>
            </Reveal>
          </div>
        )}
      </div>
    </section>
  )
}

export { ModuleFeatures }
