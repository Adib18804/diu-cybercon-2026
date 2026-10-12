"use client"

import { motion, useReducedMotion } from "framer-motion"
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  MapPin,
  ShieldCheck,
} from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { CountdownTimer, TypewriterText } from "@/components/ui"
import { cn } from "@/lib/utils"

// =============================================================================
// Hero — Section 03
// Countdown + typewriter + dual CTAs. Within 5 seconds a visitor must learn
// WHAT / WHEN / WHERE / WHICH EVENTS / HOW TO REGISTER (Part 28).
// =============================================================================

export interface HeroProps {
  title: string
  tagline: string
  description: string
  countdownTarget: string
  registrationOpen: boolean
  organizerName: string
  firstDeadlineLabel: string | null
}

function terminalLines(organizerName: string): { cmd: string; out: React.ReactNode }[] {
  return [
    {
      cmd: "whoami",
      out: <span className="text-text-primary">{organizerName}</span>,
    },
  {
    cmd: "cat event.dates",
    out: (
      <span className="flex flex-col gap-0.5">
        <span>
          <span className="text-neon">day-01</span> 24 Oct 2026 · online · CTF
          Preliminary Round
        </span>
        <span>
          <span className="text-cyan">day-02</span> 14 Nov 2026 · on-site · Main
          Event — 6 modules
        </span>
        <span>
          <span className="text-violet">day-03</span> 15 Nov 2026 · on-site · Finals
          · Panel · Closing
        </span>
      </span>
    ),
  },
    {
      cmd: "ls ./modules",
      out: (
        <span>
          ctf/ trace-route/ project-showcase/ poster/ panel/ workshops/
        </span>
      ),
    },
  ]
}

function Hero({
  title,
  tagline,
  description,
  countdownTarget,
  registrationOpen,
  organizerName,
  firstDeadlineLabel,
}: HeroProps) {
  const prefersReducedMotion = useReducedMotion()

  // Split "DIU CyberCon 2026" → ["DIU", "CyberCon", "2026"] so the year can
  // carry the gradient treatment.
  const titleParts = title.trim().split(/\s+/)
  const yearPart = titleParts.length > 1 ? titleParts[titleParts.length - 1] : null
  const leadPart = yearPart ? titleParts.slice(0, -1).join(" ") : title

  const fade = (delay: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
        }

  return (
    <section className="relative overflow-hidden">
      {/* Local ambient glow */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(0,229,255,0.35), rgba(124,58,237,0.18), transparent)",
        }}
        aria-hidden="true"
      />

      <div className="section-inner relative z-content">
        <div className="grid items-center gap-12 pb-10 pt-12 md:pt-16 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          {/* ── Left column — the 5-second pitch ─────────────────────────── */}
          <div className="flex flex-col items-start">
            {/* Status chips */}
            <motion.div
              {...fade(0)}
              className="mb-6 flex flex-wrap items-center gap-2"
            >
              {registrationOpen && (
                <span className="badge-neon gap-2">
                  <span className="live-dot" aria-hidden="true" />
                  Registration Open
                </span>
              )}
              <span className="badge-cyan">National Cybersecurity Conference</span>
              <span className="badge-muted">3 Days · 6 Events</span>
            </motion.div>

            {/* Title */}
            <motion.h1
              {...fade(0.08)}
              className="font-display font-extrabold tracking-tight text-text-primary text-hero-xl"
            >
              {leadPart}{" "}
              {yearPart && <span className="text-gradient-cyan">{yearPart}</span>}
            </motion.h1>

            {/* Typewriter tagline */}
            <motion.div
              {...fade(0.16)}
              className="mt-5 flex items-center gap-3 font-mono text-sm text-neon md:text-base"
            >
              <span className="text-text-faint" aria-hidden="true">
                $
              </span>
              <TypewriterText
                text={`> ${tagline.toLowerCase()}`}
                speed={40}
                delay={600}
                className="text-neon"
              />
            </motion.div>

            {/* Description */}
            <motion.p
              {...fade(0.24)}
              className="mt-6 max-w-xl text-base leading-relaxed text-text-muted md:text-lg"
            >
              {description}
            </motion.p>

            {/* Meta facts — when / where / register */}
            <motion.dl
              {...fade(0.32)}
              className="mt-8 flex flex-col gap-3"
            >
              <div className="flex items-start gap-3">
                <CalendarDays
                  className="mt-0.5 h-4 w-4 shrink-0 text-cyan"
                  aria-hidden="true"
                />
                <div>
                  <dt className="sr-only">Dates</dt>
                  <dd className="font-mono text-sm text-text-primary">
                    24 Oct 2026 <span className="text-text-faint">· online CTF prelims</span>
                    <br />
                    14–15 Nov 2026 <span className="text-text-faint">· on-site main event</span>
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin
                  className="mt-0.5 h-4 w-4 shrink-0 text-cyan"
                  aria-hidden="true"
                />
                <div>
                  <dt className="sr-only">Venue</dt>
                  <dd className="font-mono text-sm text-text-primary">
                    Daffodil Smart City (DSC){" "}
                    <span className="text-text-faint">· Birulia, Savar, Dhaka</span>
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-cyan"
                  aria-hidden="true"
                />
                <div>
                  <dt className="sr-only">How to join</dt>
                  <dd className="font-mono text-sm text-text-primary">
                    Register online{" "}
                    <span className="text-text-faint">
                      {firstDeadlineLabel
                        ? `· first deadline ${firstDeadlineLabel}`
                        : "· seats limited per module"}
                    </span>
                  </dd>
                </div>
              </div>
            </motion.dl>

            {/* CTAs */}
            <motion.div
              {...fade(0.4)}
              className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Link
                href="/register"
                className="btn-primary gap-2 px-6 py-3 text-sm"
              >
                {registrationOpen ? "Register Now" : "View Registration"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/events"
                className="btn-secondary gap-2 px-6 py-3 text-sm"
              >
                Explore Events
              </Link>
            </motion.div>
          </div>

          {/* ── Right column — terminal ───────────────────────────────────── */}
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 32 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="terminal-window shadow-md">
              <div className="terminal-header">
                <span className="terminal-dot bg-pink/60" aria-hidden="true" />
                <span className="terminal-dot bg-amber/60" aria-hidden="true" />
                <span className="terminal-dot bg-neon/60" aria-hidden="true" />
                <span className="terminal-title">cybercon@diu:~/event</span>
              </div>
              <div className="terminal-body flex flex-col gap-4 p-5 text-[0.8125rem]">
                {terminalLines(organizerName).map((line) => (
                  <div key={line.cmd} className="flex flex-col gap-1.5">
                    <span className="text-text-muted">
                      <span className="text-neon">$</span> {line.cmd}
                    </span>
                    <span className="pl-4">{line.out}</span>
                  </div>
                ))}

                {/* Registration status — typewriter close */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-text-muted">
                    <span className="text-neon">$</span> ./register --status
                  </span>
                  <span className="flex items-center gap-2 pl-4">
                    <span
                      className={cn(
                        "live-dot",
                        !registrationOpen && "bg-amber",
                      )}
                      aria-hidden="true"
                    />
                    <TypewriterText
                      text={
                        registrationOpen
                          ? "registration is open — secure your seat"
                          : "registration opens soon — stay tuned"
                      }
                      speed={38}
                      delay={2200}
                      showCursor={registrationOpen}
                      className="text-text-primary"
                    />
                  </span>
                </div>
              </div>
            </div>

            {/* Decorative corner accent */}
            <div
              className="pointer-events-none absolute -right-3 -top-3 h-20 w-20 rounded-tr-2xl border-r-2 border-t-2 border-cyan/30"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-3 -left-3 h-20 w-20 rounded-bl-2xl border-b-2 border-l-2 border-violet/30"
              aria-hidden="true"
            />
          </motion.div>
        </div>

        {/* ── Countdown strip ────────────────────────────────────────────── */}
        <motion.div
          {...fade(0.5)}
          className="flex flex-col items-center gap-4 border-t border-border/60 py-10"
        >
          <p className="section-label mb-0 justify-center">
            Countdown to the main event · 14 Nov 2026 · 09:00 AM
          </p>
          <div className="flex w-full justify-center overflow-hidden">
            <CountdownTimer
              target={countdownTarget}
              size="hero"
              className="origin-center scale-[0.72] sm:scale-90 md:scale-100"
            />
          </div>
        </motion.div>

        {/* Scroll hint */}
        <div className="flex justify-center pb-6" aria-hidden="true">
          <ChevronDown className="h-5 w-5 animate-bounce text-text-faint motion-reduce:animate-none" />
        </div>
      </div>
    </section>
  )
}

export { Hero }
