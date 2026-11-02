import { ArrowRight, ShieldCheck, Terminal, Users } from "lucide-react"
import Link from "next/link"

import { CountdownTimer } from "@/components/ui"
import { Reveal } from "@/components/ui/Reveal"

// =============================================================================
// FinalCta — Section 21
// Closing registration drive: countdown + primary CTA. Part 28 — the path to
// registration is unmistakable.
// =============================================================================

export interface FinalCtaProps {
  countdownTarget: string
  registrationOpen: boolean
}

function FinalCta({ countdownTarget, registrationOpen }: FinalCtaProps) {
  const facts = [
    { icon: Terminal, text: "2 flagship events · 3 days" },
    { icon: Users, text: "CTF teams of up to 4" },
    { icon: ShieldCheck, text: "Open to students nationwide" },
  ]

  return (
    <section className="section pt-0" id="register">
      <div className="section-inner">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-cyan/20 bg-bg-panel shadow-glow-cyan-sm">
            {/* Grid backdrop */}
            <div className="pointer-events-none absolute inset-0 bg-grid-overlay bg-grid-60" aria-hidden="true" />
            {/* Corner accents */}
            <span className="pointer-events-none absolute left-4 top-4 h-5 w-5 border-l-2 border-t-2 border-cyan/70" aria-hidden="true" />
            <span className="pointer-events-none absolute right-4 top-4 h-5 w-5 border-r-2 border-t-2 border-cyan/70" aria-hidden="true" />
            <span className="pointer-events-none absolute bottom-4 left-4 h-5 w-5 border-b-2 border-l-2 border-cyan/70" aria-hidden="true" />
            <span className="pointer-events-none absolute bottom-4 right-4 h-5 w-5 border-b-2 border-r-2 border-cyan/70" aria-hidden="true" />

            <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 py-14 text-center md:py-20">
              <p className="section-label justify-center">
                {registrationOpen ? "Registration Open · Limited Seats" : "Registration Closed"}
              </p>

              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-text-primary text-balance md:text-5xl">
                Ready to <span className="text-gradient-cyan">learn, secure</span> and defend?
              </h2>

              <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-muted md:text-base">
                Join Bangladesh&apos;s flagship national cybersecurity conference — compete across
                six modules, meet the community, and put your skills on the national stage.
              </p>

              {/* Countdown */}
              <div className="mt-10 flex w-full justify-center overflow-hidden">
                <CountdownTimer
                  target={countdownTarget}
                  size="lg"
                  className="origin-center scale-[0.8] sm:scale-95 md:scale-100"
                />
              </div>

              {/* Facts */}
              <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
                {facts.map((fact) => (
                  <li
                    key={fact.text}
                    className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-text-muted"
                  >
                    <fact.icon className="h-3.5 w-3.5 text-cyan" aria-hidden="true" />
                    {fact.text}
                  </li>
                ))}
              </ul>

              {/* CTAs */}
              <div className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
                {registrationOpen ? (
                  <Link
                    href="/register"
                    className="btn-primary w-full justify-center gap-2 px-8 py-3.5 text-sm sm:w-auto"
                  >
                    Register Now
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="btn-secondary w-full cursor-not-allowed justify-center px-8 py-3.5 text-sm opacity-60 sm:w-auto">
                    Registration Closed
                  </span>
                )}
                <Link
                  href="/events"
                  className="btn-secondary w-full justify-center px-8 py-3.5 text-sm sm:w-auto"
                >
                  Explore Events
                </Link>
              </div>

              <p className="mt-6 font-mono text-[0.65rem] uppercase tracking-widest text-text-faint">
                Main event · 12 December 2026 · Daffodil Smart City, Savar
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export { FinalCta }
