// =============================================================================
// About — /about
// The story, mission and organisers behind DIU_CYBERCON 2026.
// All facts come from constants + site settings — nothing invented (Part 22).
// =============================================================================

import {
  Building2,
  CalendarDays,
  GraduationCap,
  MapPin,
  Rocket,
  ShieldCheck,
  ShieldHalf,
  Sparkles,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { formatISODateShort } from "@/components/home"
import { PageHeader } from "@/components/layout"
import { Reveal } from "@/components/ui/Reveal"
import { SectionHeading } from "@/components/ui/SectionHeading"
import {
  EVENT_DATES,
  EVENT_MODULES,
  LEGACY_2025,
  ORGANIZER,
  VENUE,
} from "@/lib/constants"
import { prisma } from "@/lib/db"

export const revalidate = 300

export const metadata: Metadata = {
  title: "About",
  description:
    "About DIU_CYBERCON 2026 and the Cyber Security Club, Department of CSE, Daffodil International University.",
}

const VALUES = [
  {
    icon: GraduationCap,
    title: "Learn",
    text: "Hands-on activities, flagship competitions and expert sessions that turn curiosity into real, usable skill.",
  },
  {
    icon: ShieldCheck,
    title: "Secure",
    text: "A platform built with real security discipline — participant data is private by design, verified and never exposed.",
  },
  {
    icon: ShieldHalf,
    title: "Defend",
    text: "A national pipeline connecting students, universities and industry to protect what matters in cyberspace.",
  },
] as const

const MODULE_LIST = Object.values(EVENT_MODULES)

async function getAboutData() {
  const settings = await prisma.siteSetting
    .findMany()
    .catch(() => [] as { key: string; value: string }[])
  const map = new Map(settings.map((s) => [s.key, s.value]))
  const str = (key: string, fallback: string) => map.get(key)?.trim() || fallback

  return {
    heroDescription: str(
      "hero.description",
      "Bangladesh's flagship national cybersecurity conference, competition, and talent platform.",
    ),
    organizerName: str("organizer.name", `${ORGANIZER.name}, ${ORGANIZER.university}`),
    organizerShort: str("organizer.shortName", ORGANIZER.shortName),
    contactEmail: str("contact.email", "info@diucybercon.com"),
  }
}

export default async function AboutPage() {
  const data = await getAboutData()

  return (
    <>
      <PageHeader
        label="// About"
        title="One national stage for cyber talent"
        description={data.heroDescription}
        crumbs={[{ label: "Home", href: "/" }, { label: "About" }]}
        actions={
          <>
            <Link href="/events" className="btn-primary">
              Explore the event program
            </Link>
            <Link href="/contact" className="btn-secondary">
              Contact the team
            </Link>
          </>
        }
      />

      {/* ── Mission — LEARN · SECURE · DEFEND ─────────────────────────────── */}
      <section className="section">
        <div className="section-inner">
          <Reveal>
            <SectionHeading
              label="// Mission"
              title="Learn. Secure. Defend."
              description="Everything at CyberCon 2026 is built around three ideas — the same words on our banner."
            />
          </Reveal>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {VALUES.map((value, index) => (
              <Reveal key={value.title} delay={index * 0.1}>
                <div className="flex h-full flex-col rounded-xl border border-border bg-bg-panel p-6 transition-all duration-400 hover:-translate-y-1 hover:border-cyan/40 hover:shadow-card-hover">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/5">
                    <value.icon className="h-5 w-5 text-cyan" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-text-primary">
                    {value.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">
                    {value.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Event at a glance ─────────────────────────────────────────────── */}
      <section className="section pt-0">
        <div className="section-inner">
          <Reveal>
            <SectionHeading
              label="// The Event"
              title="Three days, six modules, one mission"
              description="An online preliminary round, then two full on-site days at Daffodil Smart City."
            />
          </Reveal>

          <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
            {/* Dates + venue */}
            <Reveal>
              <div className="flex h-full flex-col gap-5 rounded-xl border border-border bg-bg-panel p-6">
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
                  <div className="flex flex-col gap-3">
                    {[EVENT_DATES.day1, EVENT_DATES.day2, EVENT_DATES.day3].map(
                      (day) => (
                        <div key={day.date}>
                          <p className="font-mono text-xs uppercase tracking-widest text-cyan">
                            {day.label} · {formatISODateShort(day.date)}
                          </p>
                          <p className="mt-0.5 text-sm text-text-muted">
                            {day.description}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 border-t border-border pt-5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-bold text-text-primary">
                      {VENUE.name}
                    </p>
                    <p className="mt-0.5 text-sm text-text-muted">{VENUE.address}</p>
                    <Link
                      href="/venue"
                      className="mt-2 inline-block font-mono text-xs text-cyan hover:underline"
                    >
                      Venue & directions →
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Modules */}
            <Reveal delay={0.1}>
              <div className="h-full rounded-xl border border-border bg-bg-panel p-6">
                <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-text-faint">
                  The six modules
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {MODULE_LIST.map((module) => (
                    <Link
                      key={module.slug}
                      href={module.href}
                      className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-deep/40 px-4 py-3 transition-colors duration-250 hover:border-cyan/40"
                    >
                      <span className="text-sm font-bold text-text-primary group-hover:text-cyan">
                        {module.name}
                      </span>
                      <span className="font-mono text-[0.6rem] uppercase tracking-wider text-text-faint">
                        Day {String(module.day).padStart(2, "0")}
                      </span>
                    </Link>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-text-muted">
                  Participation formats vary per event — solo, teams of up to 4,
                  open attendance or limited-seat hands-on sessions.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Legacy 2025 — clearly labelled historical data ────────────────── */}
      <section className="section pt-0">
        <div className="section-inner">
          <Reveal>
            <SectionHeading
              label={`// CyberCon ${LEGACY_2025.year} — The Foundation`}
              title="Built on proven momentum"
              description="Historical figures from the previous edition — clearly labelled, never mixed with 2026 projections."
            />
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: "Participating teams", value: LEGACY_2025.teams },
                { label: "Universities", value: LEGACY_2025.universities },
                { label: "Colleges & schools", value: LEGACY_2025.colleges + LEGACY_2025.schools },
                { label: "Professional orgs", value: LEGACY_2025.professionals },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-border bg-bg-panel p-5 text-center"
                >
                  <p className="font-display text-3xl font-extrabold tracking-tight text-cyan">
                    {stat.value}
                  </p>
                  <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-wider text-text-faint">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center font-mono text-[0.65rem] uppercase tracking-wider text-text-faint">
              CyberCon {LEGACY_2025.year} edition · historical data
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Organiser ─────────────────────────────────────────────────────── */}
      <section className="section pt-0">
        <div className="section-inner">
          <Reveal>
            <div className="rounded-xl border border-cyan/20 bg-bg-panel p-6 md:p-8">
              <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-center">
                <div>
                  <p className="section-label">{"// Organised By"}</p>
                  <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-text-primary text-balance">
                    {data.organizerName}
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-muted">
                    DIU_CYBERCON is organised by the {data.organizerShort} —
                    a student-led community at Daffodil International University
                    dedicated to cybersecurity education, competitions and
                    industry connection. The club has run national-scale cyber
                    events, and CyberCon 2026 continues that work on a bigger
                    stage.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <a
                      href={ORGANIZER.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary gap-2"
                    >
                      <Building2 className="h-4 w-4" aria-hidden="true" />
                      University Website
                    </a>
                    <a href={`mailto:${data.contactEmail}`} className="btn-ghost justify-center">
                      {data.contactEmail}
                    </a>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {[
                    { icon: Sparkles, text: "Student-led, national-scale event" },
                    { icon: Rocket, text: "Six competition & learning modules" },
                    { icon: ShieldCheck, text: "Privacy-first participant platform" },
                  ].map((row) => (
                    <div
                      key={row.text}
                      className="flex items-center gap-3 rounded-lg border border-border bg-bg-deep/40 px-4 py-3"
                    >
                      <row.icon className="h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
                      <span className="text-sm text-text-muted">{row.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
