// =============================================================================
// EventDetailPage — shared server component for /events/{slug}
// Database-driven module detail page: facts, rules, eligibility, prizes,
// timetable, and module-specific extras (CTF domains, workshop seats, panel).
// Honest fallbacks everywhere — never invented content (Part 22).
// =============================================================================

import { EventStatus } from "@prisma/client"
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Clock,
  Info,
  MapPin,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import type { ReactNode } from "react"

import {
  eventAccentClasses,
  eventBadgeType,
  registrationState,
  REGISTRATION_STATE_CLASS,
  REGISTRATION_STATE_LABEL,
} from "./helpers"

import { dayLabel, formatISODateShort, participationLabel } from "@/components/home/helpers"
import { moduleIconComponent } from "@/components/home/icons"
import { EmptyState, PageHeader } from "@/components/layout"
import { EventTypeBadge, Reveal, SeatCounter, SectionHeading, TerminalWindow } from "@/components/ui"
import { CTF_DOMAINS } from "@/lib/constants"
import { prisma } from "@/lib/db"

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getEventDetail(slug: string) {
  try {
    const event = await prisma.event.findUnique({ where: { slug } })
    if (!event) {
      return null
    }

    const [schedule, related, workshops, panels] = await Promise.all([
      prisma.scheduleItem.findMany({
        where: { eventId: event.id },
        orderBy: [{ day: "asc" }, { startTime: "asc" }],
      }),
      prisma.event.findMany({
        where: {
          id: { not: event.id },
          status: { not: EventStatus.DRAFT },
          type: { in: ["CTF", "INNOVATION_SYMPOSIUM", "PANEL_DISCUSSION", "HANDS_ON"] },
        },
        orderBy: { displayOrder: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          iconName: true,
          shortDescription: true,
          eventDay: true,
          type: true,
          isTeamEvent: true,
          minTeamSize: true,
          maxTeamSize: true,
        },
      }),
      slug === "workshops"
        ? prisma.workshop.findMany({
            where: {
              status: {
                in: [EventStatus.OPEN, EventStatus.CLOSED, EventStatus.COMPLETED],
              },
            },
            orderBy: [{ date: "asc" }, { displayOrder: "asc" }],
          })
        : Promise.resolve([]),
      slug === "panel"
        ? prisma.panel.findMany({
            where: {
              status: {
                in: [EventStatus.OPEN, EventStatus.CLOSED, EventStatus.COMPLETED],
              },
            },
            orderBy: { displayOrder: "asc" },
            select: {
              id: true,
              topic: true,
              description: true,
              sessionDate: true,
              startTime: true,
              endTime: true,
              venue: true,
            },
          })
        : Promise.resolve([]),
    ])

    return { event, schedule, related, workshops, panels }
  } catch {
    return null
  }
}

// ─── Small building blocks ────────────────────────────────────────────────────

function MetaTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-panel p-4">
      <div className="flex items-center gap-2 text-text-faint">
        {icon}
        <p className="font-mono text-[0.6875rem] uppercase tracking-widest">{label}</p>
      </div>
      <p className="mt-2 text-sm font-bold text-text-primary">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-text-muted">{sub}</p>}
    </div>
  )
}

function DetailPanel({
  icon,
  title,
  body,
}: {
  icon: ReactNode
  title: string
  body: string | null
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-bg-panel p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-elevated">
          {icon}
        </div>
        <h3 className="font-display text-sm font-bold text-text-primary">{title}</h3>
      </div>
      {body ? (
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-text-muted">
          {body
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line, i) => (
              <p key={i}>{line}</p>
            ))}
        </div>
      ) : (
        <p className="mt-3 text-sm italic text-text-faint">
          To be announced — published here once confirmed and approved.
        </p>
      )}
    </div>
  )
}

const SKILL_BADGE: Record<string, string> = {
  BEGINNER: "badge-neon",
  INTERMEDIATE: "badge-cyan",
  ADVANCED: "badge-pink",
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export interface EventDetailPageProps {
  slug: string
}

async function EventDetailPage({ slug }: EventDetailPageProps) {
  const data = await getEventDetail(slug)

  if (!data) {
    return (
      <section className="section">
        <div className="section-inner">
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6" aria-hidden="true" />}
            label="Unavailable"
            title="Module details could not be loaded"
            description="This module's details are not available right now. Please check the events hub or try again shortly."
            action={
              <Link href="/events" className="btn-secondary">
                All Modules
              </Link>
            }
          />
        </div>
      </section>
    )
  }

  const { event, schedule, related, workshops, panels } = data
  const accent = eventAccentClasses(slug)
  const Icon = moduleIconComponent(event.iconName)
  const badgeType = eventBadgeType(event.type, event.isTeamEvent)
  const regState = registrationState(event.status, event.registrationOpen)
  const canRegister = regState === "open"
  const deadlineIso = event.registrationDeadline?.toISOString() ?? null
  const paragraphs = event.fullDescription
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  const teamSub =
    event.isTeamEvent && event.minTeamSize && event.maxTeamSize
      ? `Teams of ${event.minTeamSize}–${event.maxTeamSize}`
      : undefined
  const feeLabel = event.type === "CTF"
    ? `Preliminary free · Final ${event.registrationFee.toString()} BDT per team`
    : Number(event.registrationFee) === 0
      ? "Free entry"
      : `${event.registrationFee.toString()} BDT per person`

  return (
    <>
      <PageHeader
        label={`// Module · ${dayLabel(event.eventDay)}`}
        title={event.name}
        description={event.shortDescription}
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Events", href: "/events" },
          { label: event.name },
        ]}
        actions={
          <>
            {canRegister ? (
              <Link href="/register" className="btn-primary gap-2">
                Register Now
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <span className="btn-secondary cursor-not-allowed opacity-50">
                {REGISTRATION_STATE_LABEL[regState]}
              </span>
            )}
            <Link href="/events" className="btn-secondary">
              All Modules
            </Link>
          </>
        }
      />

      {/* ── Notice when registration is not open ─────────────────────── */}
      {regState !== "open" && (
        <section className="pt-10">
          <div className="section-inner">
            <Reveal>
              <div className="flex items-start gap-3 rounded-lg border border-border bg-bg-panel/70 px-5 py-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-text-muted">
                  {regState === "soon" && (
                    <>
                      Registration for this module opens soon. Watch the{" "}
                      <Link href="/announcements" className="text-cyan hover:underline">
                        announcements page
                      </Link>{" "}
                      for the opening date.
                    </>
                  )}
                  {regState === "closed" && (
                    <>
                      Registration for this module is currently closed. Check the{" "}
                      <Link href="/announcements" className="text-cyan hover:underline">
                        announcements page
                      </Link>{" "}
                      for updates.
                    </>
                  )}
                  {regState === "completed" && (
                    <>
                      This module has concluded. Browse the{" "}
                      <Link href="/gallery" className="text-cyan hover:underline">
                        event gallery
                      </Link>{" "}
                      for highlights.
                    </>
                  )}
                </p>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── Facts + About ────────────────────────────────────────────── */}
      <section className="section">
        <div className="section-inner">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-14">
            <div>
              <Reveal>
                <SectionHeading label="// Overview" title="About this module" size="sm" />
              </Reveal>

              <Reveal delay={0.08}>
                <div className="mt-6 space-y-4">
                  {paragraphs.map((para, i) => (
                    <p key={i} className="text-sm leading-relaxed text-text-muted">
                      {para}
                    </p>
                  ))}
                </div>
              </Reveal>

              <Reveal delay={0.12}>
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <EventTypeBadge type={badgeType} />
                  <span className={accent.badge}>{dayLabel(event.eventDay)}</span>
                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[0.6875rem] font-bold uppercase tracking-wider ${
                      REGISTRATION_STATE_CLASS[regState]
                    }`}
                  >
                    {regState === "open" && (
                      <span className="live-dot" aria-hidden="true" />
                    )}
                    {REGISTRATION_STATE_LABEL[regState]}
                  </span>
                </div>
              </Reveal>
            </div>

            {/* Quick facts */}
            <Reveal delay={0.1}>
              <div className="rounded-xl border border-border bg-bg-panel/60 p-5 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${accent.border} ${accent.iconBg}`}
                  >
                    <Icon className={`h-5 w-5 ${accent.text}`} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-display text-sm font-bold text-text-primary">
                      {event.name}
                    </p>
                    <p className="font-mono text-[0.6875rem] uppercase tracking-widest text-text-faint">
                      {dayLabel(event.eventDay)} · DIU_CYBERCON 2026
                    </p>
                  </div>
                </div>

                <dl className="mt-5 space-y-3 border-t border-border pt-5">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-xs text-text-faint">Format</dt>
                    <dd className="text-right text-xs font-medium text-text-primary">
                      {participationLabel(
                        event.type,
                        event.isTeamEvent,
                        event.minTeamSize,
                        event.maxTeamSize,
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-xs text-text-faint">Registration deadline</dt>
                    <dd className="text-right text-xs font-medium text-text-primary">
                      {formatISODateShort(deadlineIso)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-xs text-text-faint">Venue</dt>
                    <dd className="text-right text-xs font-medium text-text-primary">
                      {event.venue ?? "To be announced"}
                    </dd>
                  </div>
                </dl>

                {canRegister && (
                  <Link href="/register" className="btn-primary mt-5 w-full justify-center gap-2">
                    Register Now
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </Reveal>
          </div>

          {/* Fact tiles */}
          <Reveal delay={0.05}>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <MetaTile
                icon={<Users className="h-3.5 w-3.5" aria-hidden="true" />}
                label="Participation"
                value={participationLabel(
                  event.type,
                  event.isTeamEvent,
                  event.minTeamSize,
                  event.maxTeamSize,
                )}
                sub={teamSub}
              />
              <MetaTile
                icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />}
                label="Registration deadline"
                value={formatISODateShort(deadlineIso)}
              />
              <MetaTile
                icon={<Clock className="h-3.5 w-3.5" aria-hidden="true" />}
                label="Event day"
                value={dayLabel(event.eventDay)}
                sub={
                  event.startDate
                    ? formatISODateShort(event.startDate.toISOString())
                    : "Date to be announced"
                }
              />
              <MetaTile
                icon={<MapPin className="h-3.5 w-3.5" aria-hidden="true" />}
                label="Venue"
                value={event.venue ?? "To be announced"}
              />
              <MetaTile
                icon={<Info className="h-3.5 w-3.5" aria-hidden="true" />}
                label="Fee"
                value={feeLabel}
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Rules / Eligibility / Prizes ─────────────────────────────── */}
      <section className="section pt-0">
        <div className="section-inner">
          <Reveal>
            <SectionHeading
              label="// Participation details"
              title="Rules, eligibility & prizes"
              size="sm"
              description="Only confirmed, organizer-approved details are published here."
            />
          </Reveal>

          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <Reveal delay={0.05}>
              <DetailPanel
                icon={<ClipboardList className="h-4 w-4 text-cyan" aria-hidden="true" />}
                title="Rules of participation"
                body={event.rules}
              />
            </Reveal>
            <Reveal delay={0.1}>
              <DetailPanel
                icon={<UserCheck className="h-4 w-4 text-neon" aria-hidden="true" />}
                title="Eligibility"
                body={event.eligibility}
              />
            </Reveal>
            <Reveal delay={0.15}>
              <DetailPanel
                icon={<Trophy className="h-4 w-4 text-amber" aria-hidden="true" />}
                title={event.prizes ? "Participant giveaways" : "Recognition"}
                body={event.prizes}
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── CTF challenge domains ────────────────────────────────────── */}
      {slug === "ctf" && (
        <section className="section pt-0">
          <div className="section-inner">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
              <Reveal>
                <SectionHeading
                  label="// Challenge domains"
                  title="Eight domains, one scoreboard"
                  size="sm"
                  description="Preliminary and final rounds draw challenges from the same domain set. Difficulty scales as the competition progresses."
                />
              </Reveal>
              <Reveal delay={0.1}>
                <TerminalWindow title="ctf@cybercon: ~/domains">
                  <p className="text-text-muted">
                    <span className="text-neon">$</span> cat domains.txt
                  </p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {CTF_DOMAINS.map((domain, i) => (
                      <li key={domain} className="flex items-center gap-3">
                        <span className="text-text-faint">{String(i + 1).padStart(2, "0")}</span>
                        <span className="text-cyan">{domain}</span>
                      </li>
                    ))}
                  </ul>
                </TerminalWindow>
              </Reveal>
            </div>
          </div>
        </section>
      )}

      {/* ── Workshops (Hands-on Activities) ──────────────────────────── */}
      {slug === "workshops" && (
        <section className="section pt-0">
          <div className="section-inner">
            <Reveal>
              <SectionHeading
                label="// Hands-on activities"
                title={workshops.length > 0 ? "Practical workshops" : "Workshop schedule"}
                size="sm"
                description="Every activity has its own capacity and registration deadline. Seats update in real time."
              />
            </Reveal>

            {workshops.length > 0 ? (
              <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
                {workshops.map((workshop, index) => {
                  const seatsLeft = Math.max(workshop.totalSeats - workshop.registeredCount, 0)
                  const deadlinePassed = workshop.registrationDeadline.getTime() < Date.now()
                  const workshopOpen =
                    workshop.status === "OPEN" && seatsLeft > 0 && !deadlinePassed

                  return (
                    <Reveal key={workshop.id} delay={index * 0.06}>
                      <div className="flex h-full flex-col rounded-xl border border-border bg-bg-panel p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={SKILL_BADGE[workshop.skillLevel] ?? "badge-muted"}>
                            {workshop.skillLevel}
                          </span>
                          <span className="badge-muted">
                            {formatISODateShort(workshop.date.toISOString())}
                          </span>
                        </div>

                        <h3 className="mt-3 font-display text-base font-bold tracking-tight text-text-primary">
                          {workshop.title}
                        </h3>
                        <p className="mt-1 text-xs text-text-muted">
                          Led by <span className="font-medium text-text-primary">{workshop.instructorName}</span>
                          {" · "}
                          {workshop.instructorOrg}
                        </p>

                        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-text-muted">
                          {workshop.description}
                        </p>

                        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-text-faint">Schedule</dt>
                            <dd className="text-right font-medium text-text-primary">
                              {workshop.startTime} – {workshop.endTime}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-text-faint">Venue</dt>
                            <dd className="text-right font-medium text-text-primary">
                              {workshop.venue}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-text-faint">Registration deadline</dt>
                            <dd className="text-right font-medium text-text-primary">
                              {formatISODateShort(workshop.registrationDeadline.toISOString())}
                            </dd>
                          </div>
                        </dl>

                        <div className="mt-4">
                          <SeatCounter
                            total={workshop.totalSeats}
                            remaining={seatsLeft}
                            size="sm"
                            showBar
                          />
                        </div>

                        <div className="mt-auto pt-4">
                          {workshopOpen ? (
                            <Link href="/register" className="btn-secondary w-full justify-center">
                              Reserve a Seat
                            </Link>
                          ) : (
                            <p className="text-center font-mono text-[0.6875rem] uppercase tracking-wider text-text-faint">
                              {seatsLeft === 0 ? "Fully booked" : "Registration closed"}
                            </p>
                          )}
                        </div>
                      </div>
                    </Reveal>
                  )
                })}
              </div>
            ) : (
              <Reveal delay={0.08}>
                <div className="mt-8">
                  <EmptyState
                    icon={<Info className="h-6 w-6" aria-hidden="true" />}
                    label="To Be Announced"
                    title="Workshop schedule is being finalized"
                    description="Activities, instructors, and timings are published here only after official confirmation. Check announcements for openings."
                    action={
                      <Link href="/announcements" className="btn-secondary">
                        View Announcements
                      </Link>
                    }
                  />
                </div>
              </Reveal>
            )}
          </div>
        </section>
      )}

      {/* ── Panel Discussion ─────────────────────────────────────────── */}
      {slug === "panel" && (
        <section className="section pt-0">
          <div className="section-inner">
            <Reveal>
              <SectionHeading
                label="// Panel session"
                title={panels.length > 0 ? "Sessions & topics" : "Panel topic and lineup"}
                size="sm"
                description="Topic, moderator, and panelists are announced as confirmations are received."
              />
            </Reveal>

            {panels.length > 0 ? (
              <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
                {panels.map((panel, index) => (
                  <Reveal key={panel.id} delay={index * 0.06}>
                    <div className="flex h-full flex-col rounded-xl border border-border bg-bg-panel p-5">
                      <h3 className="font-display text-base font-bold tracking-tight text-text-primary">
                        {panel.topic}
                      </h3>
                      {panel.description && (
                        <p className="mt-2 text-sm leading-relaxed text-text-muted">
                          {panel.description}
                        </p>
                      )}
                      <dl className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-text-faint">Date</dt>
                          <dd className="text-right font-medium text-text-primary">
                            {formatISODateShort(panel.sessionDate?.toISOString() ?? null)}
                          </dd>
                        </div>
                        {(panel.startTime || panel.endTime) && (
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-text-faint">Time</dt>
                            <dd className="text-right font-medium text-text-primary">
                              {panel.startTime ?? "—"} – {panel.endTime ?? "—"}
                            </dd>
                          </div>
                        )}
                        {panel.venue && (
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-text-faint">Venue</dt>
                            <dd className="text-right font-medium text-text-primary">
                              {panel.venue}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </Reveal>
                ))}
              </div>
            ) : (
              <Reveal delay={0.08}>
                <div className="mt-8">
                  <EmptyState
                    icon={<Users className="h-6 w-6" aria-hidden="true" />}
                    label="To Be Announced"
                    title="Panel topic and panelists coming soon"
                    description="We publish panel details only after official confirmation. Confirmed speakers appear on the speakers page."
                    action={
                      <Link href="/speakers" className="btn-secondary">
                        Speakers Page
                      </Link>
                    }
                  />
                </div>
              </Reveal>
            )}
          </div>
        </section>
      )}

      {/* ── Timetable for this module ────────────────────────────────── */}
      <section className="section pt-0">
        <div className="section-inner">
          <Reveal>
            <SectionHeading
              label="// Timetable"
              title="Module schedule"
              size="sm"
              action={
                <Link href="/schedule" className="btn-secondary">
                  Full Schedule
                </Link>
              }
            />
          </Reveal>

          {schedule.length > 0 ? (
            <div className="mt-8 flex flex-col gap-3">
              {schedule.map((item) => (
                <Reveal key={item.id} delay={0.04}>
                  <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg-panel p-4 sm:flex-row sm:items-center sm:gap-5">
                    <span className="w-16 shrink-0 font-mono text-xs text-text-faint">
                      Day {String(item.day).padStart(2, "0")}
                    </span>
                    <span className="w-32 shrink-0 font-mono text-xs text-cyan">
                      {item.startTime} – {item.endTime}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-text-primary">{item.title}</p>
                      {item.venue && (
                        <p className="mt-0.5 text-xs text-text-muted">{item.venue}</p>
                      )}
                    </div>
                    {item.isHighlight && <span className="badge-amber shrink-0">Highlight</span>}
                  </div>
                </Reveal>
              ))}
            </div>
          ) : (
            <Reveal delay={0.06}>
              <div className="mt-8 rounded-xl border border-dashed border-border bg-bg-panel/50 px-6 py-10 text-center">
                <p className="font-mono text-[0.6875rem] uppercase tracking-widest text-text-faint">
                  To Be Announced
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-muted">
                  The detailed timetable for this module will be published closer to
                  the event. Check the full schedule page for confirmed sessions.
                </p>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* ── Related modules ──────────────────────────────────────────── */}
      {related.length > 0 && (
        <section className="section pt-0">
          <div className="section-inner">
            <Reveal>
              <SectionHeading label="// More modules" title="Explore other events" size="sm" />
            </Reveal>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((rel, index) => {
                const relAccent = eventAccentClasses(rel.slug)
                const RelIcon = moduleIconComponent(rel.iconName)

                return (
                  <Reveal key={rel.id} delay={index * 0.05}>
                    <Link
                      href={`/events/${rel.slug}` as Route}
                      className="group flex h-full items-start gap-4 rounded-xl border border-border bg-bg-panel p-4 transition-all duration-400 hover:-translate-y-0.5 hover:border-cyan/40 hover:shadow-card-hover"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${relAccent.border} ${relAccent.iconBg}`}
                      >
                        <RelIcon className={`h-5 w-5 ${relAccent.text}`} aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-text-primary group-hover:text-cyan">
                          {rel.name}
                        </p>
                        <p className="mt-0.5 font-mono text-[0.6875rem] uppercase tracking-wider text-text-faint">
                          {dayLabel(rel.eventDay)} ·{" "}
                          {participationLabel(
                            rel.type,
                            rel.isTeamEvent,
                            rel.minTeamSize,
                            rel.maxTeamSize,
                          )}
                        </p>
                      </div>
                      <ArrowRight
                        className="ml-auto mt-1 h-4 w-4 shrink-0 text-text-faint transition-transform duration-250 group-hover:translate-x-0.5 group-hover:text-cyan"
                        aria-hidden="true"
                      />
                    </Link>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="pb-20 pt-4 md:pb-24">
        <div className="section-inner">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-cyan/25 bg-bg-panel px-6 py-10 text-center md:px-12 md:py-12">
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-radial-cyan opacity-40"
                aria-hidden="true"
              />
              <div className="relative">
                <p className="section-label justify-center">{"// Get started"}</p>
                <h2 className="mx-auto mt-3 max-w-2xl font-display text-section-h3 font-bold tracking-tight text-text-primary text-balance">
                  {canRegister
                    ? "Secure your spot in this module"
                    : "Explore the full event program"}
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
                  {canRegister
                    ? "Registration takes a few minutes — create your account, complete your profile, and confirm your module."
                    : "Explore CyberCon events across three days and see what is open for registration right now."}
                </p>
                <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  {canRegister && (
                    <Link href="/register" className="btn-primary gap-2">
                      Register Now
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  )}
                  <Link
                    href="/events"
                    className={canRegister ? "btn-secondary" : "btn-primary"}
                  >
                    Browse All Modules
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

export { EventDetailPage }
