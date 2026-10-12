// =============================================================================
// Events Index — /events
// The hub for all six event modules. Reads live module data + deadlines from
// the database (Part 22 — nothing fabricated), links to every module detail
// page, and explains the registration flow end to end.
// =============================================================================

import { ArrowRight, CalendarDays, FileText, ListChecks, MailCheck, MapPin, UserPlus } from "lucide-react"
import type { Metadata, Route } from "next"
import Link from "next/link"

import {
  eventAccentClasses,
  eventBadgeType,
  registrationState,
  REGISTRATION_STATE_CLASS,
  REGISTRATION_STATE_LABEL,
} from "@/components/events"
import { dayLabel, formatISODateShort, participationLabel } from "@/components/home/helpers"
import { moduleIconComponent } from "@/components/home/icons"
import { EmptyState, PageHeader } from "@/components/layout"
import { EventTypeBadge, Reveal, SectionHeading } from "@/components/ui"
import { EVENT_DATES, VENUE } from "@/lib/constants"
import { prisma } from "@/lib/db"

export const revalidate = 120

export const metadata: Metadata = {
  title: "Events",
  description:
    "Explore the six flagship event modules of DIU CyberCon 2026 — CTF, Project Showcasing, Poster Presentation, Trace & Route, Panel Discussion, and Hands-on Activities.",
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getEvents() {
  try {
    return await prisma.event.findMany({
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        iconName: true,
        shortDescription: true,
        isTeamEvent: true,
        minTeamSize: true,
        maxTeamSize: true,
        registrationDeadline: true,
        eventDay: true,
        status: true,
        registrationOpen: true,
      },
    })
  } catch {
    return []
  }
}

// ─── Static content ───────────────────────────────────────────────────────────

const REGISTRATION_STEPS = [
  {
    icon: UserPlus,
    title: "Create your account",
    description:
      "Sign up with your email — a single account covers every module you register for this year.",
  },
  {
    icon: MailCheck,
    title: "Verify your email",
    description:
      "Click the verification link sent to your inbox to activate your participant account.",
  },
  {
    icon: FileText,
    title: "Complete your profile",
    description:
      "Add your institution details and upload your student ID for team verification.",
  },
  {
    icon: ListChecks,
    title: "Register for modules",
    description:
      "Pick one or more modules — team, solo, or open attendance — and submit your registration.",
  },
] as const

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function EventsPage() {
  const events = await getEvents()
  const keyDates = [EVENT_DATES.day1, EVENT_DATES.day2, EVENT_DATES.day3]

  return (
    <>
      <PageHeader
        label="// Event Modules"
        title="Six modules. One national stage."
        description="Every module is registered separately — compete in the CTF, present your research, prove your networking skills, or attend the program. Pick one or stack several across the three days."
        crumbs={[{ label: "Home", href: "/" }, { label: "Events" }]}
        actions={
          <>
            <Link href="/register" className="btn-primary gap-2">
              Register Now
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/schedule" className="btn-secondary">
              View Schedule
            </Link>
          </>
        }
      />

      {/* ── Key dates strip ─────────────────────────────────────────── */}
      <section className="border-b border-border/60">
        <div className="section-inner py-8">
          <div className="grid gap-4 md:grid-cols-3">
            {keyDates.map((day) => (
              <div
                key={day.label}
                className="flex items-start gap-4 rounded-xl border border-border bg-bg-panel p-5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/5">
                  <CalendarDays className="h-5 w-5 text-cyan" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-cyan">
                    {day.label}
                  </p>
                  <p className="mt-1 font-display text-base font-bold text-text-primary">
                    {formatISODateShort(day.date)}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">
                    {day.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-5 flex flex-wrap items-center gap-2 font-mono text-xs text-text-muted">
            <MapPin className="h-3.5 w-3.5 text-cyan" aria-hidden="true" />
            On-site program — {VENUE.name}, {VENUE.address}
            <Link href="/venue" className="text-cyan underline-offset-4 hover:underline">
              Venue details →
            </Link>
          </p>
        </div>
      </section>

      {/* ── Module cards ────────────────────────────────────────────── */}
      <section className="section" id="modules">
        <div className="section-inner">
          <Reveal>
            <SectionHeading
              label="// Choose your track"
              title="Every module, registered separately"
              description="Registration status, formats, and deadlines below are pulled live from the official event register — never placeholders."
            />
          </Reveal>

          {events.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                icon={<CalendarDays className="h-6 w-6" aria-hidden="true" />}
                label="Being Finalized"
                title="Event modules are being finalized"
                description="The full module lineup will appear here as soon as it is confirmed. Meanwhile, the FAQ and schedule pages are a good place to get ready."
                action={
                  <Link href="/contact" className="btn-secondary">
                    Contact the Organizing Team
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {events.map((event, index) => {
                const Icon = moduleIconComponent(event.iconName)
                const accent = eventAccentClasses(event.slug)
                const state = registrationState(event.status, event.registrationOpen)
                const canRegister = state === "open"

                return (
                  <Reveal key={event.id} delay={index * 0.06} className="h-full">
                    <article className="flex h-full flex-col rounded-xl border border-border bg-bg-panel p-6 transition-all duration-400 hover:-translate-y-1 hover:border-cyan/40 hover:shadow-card-hover">
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`flex h-11 w-11 items-center justify-center rounded-lg border ${accent.border} ${accent.iconBg}`}
                        >
                          <Icon className={`h-5 w-5 ${accent.text}`} aria-hidden="true" />
                        </span>
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[0.6875rem] font-medium uppercase tracking-wider ${REGISTRATION_STATE_CLASS[state]}`}
                        >
                          {canRegister && <span className="live-dot" aria-hidden="true" />}
                          {REGISTRATION_STATE_LABEL[state]}
                        </span>
                      </div>

                      <h3 className="mt-4 font-display text-lg font-bold text-text-primary">
                        {event.name}
                      </h3>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <EventTypeBadge
                          type={eventBadgeType(event.type, event.isTeamEvent)}
                        />
                        <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-text-faint">
                          {dayLabel(event.eventDay)}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-relaxed text-text-muted">
                        {event.shortDescription}
                      </p>

                      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/60 pt-4">
                        <div>
                          <dt className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                            Format
                          </dt>
                          <dd className="mt-0.5 text-xs font-semibold text-text-primary">
                            {participationLabel(
                              event.type,
                              event.isTeamEvent,
                              event.minTeamSize,
                              event.maxTeamSize,
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                            Deadline
                          </dt>
                          <dd className="mt-0.5 text-xs font-semibold text-text-primary">
                            {event.registrationDeadline
                              ? formatISODateShort(event.registrationDeadline.toISOString())
                              : "To be announced"}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row">
                        <Link
                          href={`/events/${event.slug}` as Route}
                          className="btn-secondary flex-1 justify-center"
                        >
                          Module Details
                        </Link>
                        {canRegister && (
                          <Link href="/register" className="btn-primary flex-1 justify-center">
                            Register
                          </Link>
                        )}
                      </div>
                    </article>
                  </Reveal>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Registration flow ───────────────────────────────────────── */}
      <section className="section pt-0">
        <div className="section-inner">
          <Reveal>
            <SectionHeading
              label="// How registration works"
              title="Four steps to the starting line"
              description="One account, one profile, every module. Here is the full journey from sign-up to submission."
            />
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {REGISTRATION_STEPS.map((step, index) => (
              <Reveal key={step.title} delay={index * 0.08} className="h-full">
                <div className="flex h-full flex-col rounded-xl border border-border bg-bg-panel p-6">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/5 text-cyan">
                      <step.icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-text-faint">
                      Step {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-base font-bold text-text-primary">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="btn-primary gap-2">
              Start Registration
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/faq" className="btn-secondary">
              Registration FAQ
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────── */}
      <section className="pb-20 pt-4 md:pb-24">
        <div className="section-inner">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-cyan/25 bg-bg-panel px-6 py-10 text-center md:px-12 md:py-12">
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-radial-cyan opacity-40"
                aria-hidden="true"
              />
              <div className="relative">
                <p className="section-label justify-center">{"// Ready to compete"}</p>
                <h2 className="mx-auto mt-3 max-w-2xl font-display text-section-h3 font-bold tracking-tight text-text-primary text-balance">
                  Pick your module and register today
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
                  One account covers every module. Questions before signing up? The FAQ and
                  the organizing team are one click away.
                </p>
                <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link href="/register" className="btn-primary gap-2">
                    Register Now
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link href="/faq" className="btn-secondary">
                    Read the FAQ
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
