// =============================================================================
// Speakers — /speakers
// Server component. Speaker profiles are database-driven and only rendered
// once an admin marks them visible (isVisible). Published panels appear with
// their panelist line-up. When nothing is confirmed yet, an honest
// "To Be Announced" state is shown — never invented names or profiles (Part 22).
// =============================================================================

import {
  CalendarDays,
  Globe,
  Linkedin,
  MapPin,
  Mic,
  Twitter,
  UserPlus,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { formatISODateShort } from "@/components/home/helpers"
import { EmptyState, PageHeader } from "@/components/layout"
import { Reveal, SectionHeading } from "@/components/ui"
import { prisma } from "@/lib/db"

export const revalidate = 120

export const metadata: Metadata = {
  title: "Speakers & Panelists",
  description:
    "Meet the speakers, panelists and moderators of DIU CyberCon 2026 — profiles are published here as official confirmations are received.",
}

// =============================================================================
// Data access
// =============================================================================

interface SpeakerCard {
  id: string
  name: string
  title: string
  organization: string
  bio: string | null
  expertise: string[]
  photoKey: string | null
  linkedinUrl: string | null
  twitterUrl: string | null
  websiteUrl: string | null
}

async function getSpeakers(): Promise<SpeakerCard[]> {
  try {
    return await prisma.speaker.findMany({
      where: { isVisible: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        title: true,
        organization: true,
        bio: true,
        expertise: true,
        photoKey: true,
        linkedinUrl: true,
        twitterUrl: true,
        websiteUrl: true,
      },
    })
  } catch {
    return []
  }
}

interface PanelSession {
  id: string
  topic: string
  description: string | null
  sessionDate: Date | null
  startTime: string | null
  endTime: string | null
  venue: string | null
  panelists: {
    role: string | null
    speaker: { id: string; name: string; title: string; organization: string }
  }[]
}

async function getPanels(): Promise<PanelSession[]> {
  try {
    return await prisma.panel.findMany({
      where: { status: { not: "DRAFT" } },
      orderBy: [{ displayOrder: "asc" }],
      select: {
        id: true,
        topic: true,
        description: true,
        sessionDate: true,
        startTime: true,
        endTime: true,
        venue: true,
        panelists: {
          select: {
            role: true,
            speaker: {
              select: { id: true, name: true, title: true, organization: true },
            },
          },
        },
      },
    })
  } catch {
    return []
  }
}

// =============================================================================
// Helpers
// =============================================================================

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}

// =============================================================================
// Page
// =============================================================================

export default async function SpeakersPage() {
  const [speakers, panels] = await Promise.all([getSpeakers(), getPanels()])
  const hasConfirmed = speakers.length > 0

  return (
    <>
      <PageHeader
        label="// Speakers & Panelists"
        title={hasConfirmed ? "Voices of CyberCon 2026" : "The lineup is being assembled"}
        description={
          hasConfirmed
            ? "Industry leaders, researchers and practitioners sharing the stage at DIU CyberCon 2026."
            : "Speaker and panelist announcements are published here as official confirmations are received — never before."
        }
        crumbs={[{ label: "Home", href: "/" }, { label: "Speakers" }]}
        actions={
          <>
            <Link href="/events" className="btn-secondary">
              Explore the Program
            </Link>
            <Link href="/contact" className="btn-primary">
              Suggest a Speaker
            </Link>
          </>
        }
      />

      {/* ── Confirmed speakers ─────────────────────────────────────────── */}
      <section className="section">
        <div className="section-inner">
          {hasConfirmed ? (
            <>
              <Reveal>
                <SectionHeading
                  label="// Confirmed Speakers"
                  title="On the CyberCon stage"
                  description="Profiles are published only after official confirmation."
                />
              </Reveal>

              <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {speakers.map((speaker, index) => {
                  const hasPhoto = speaker.photoKey?.startsWith("http") ?? false
                  return (
                    <Reveal key={speaker.id} delay={index * 0.06}>
                      <article className="group flex h-full flex-col rounded-xl border border-border bg-bg-panel p-5 transition-all duration-400 hover:-translate-y-1 hover:border-cyan/40 hover:shadow-card-hover">
                        {hasPhoto ? (
                          // Admin-uploaded absolute URL — plain img is intentional
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={speaker.photoKey ?? ""}
                            alt={speaker.name}
                            className="h-16 w-16 rounded-xl border border-cyan/30 object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/5 font-display text-xl font-bold text-cyan">
                            {initials(speaker.name)}
                          </div>
                        )}

                        <h3 className="mt-4 font-display text-base font-bold tracking-tight text-text-primary">
                          {speaker.name}
                        </h3>
                        <p className="mt-1 text-xs text-text-muted">{speaker.title}</p>
                        <p className="mt-0.5 font-mono text-[0.6875rem] uppercase tracking-wider text-text-faint">
                          {speaker.organization}
                        </p>

                        {speaker.bio && (
                          <p className="mt-3 line-clamp-4 text-xs leading-relaxed text-text-muted">
                            {speaker.bio}
                          </p>
                        )}

                        {speaker.expertise.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {speaker.expertise.slice(0, 3).map((tag) => (
                              <span key={tag} className="badge-muted">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {(speaker.linkedinUrl ||
                          speaker.twitterUrl ||
                          speaker.websiteUrl) && (
                          <div className="mt-auto flex items-center gap-3 pt-4">
                            {speaker.linkedinUrl && (
                              <a
                                href={speaker.linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${speaker.name} on LinkedIn`}
                                className="text-text-faint transition-colors duration-150 hover:text-cyan"
                              >
                                <Linkedin className="h-4 w-4" aria-hidden="true" />
                              </a>
                            )}
                            {speaker.twitterUrl && (
                              <a
                                href={speaker.twitterUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${speaker.name} on X`}
                                className="text-text-faint transition-colors duration-150 hover:text-cyan"
                              >
                                <Twitter className="h-4 w-4" aria-hidden="true" />
                              </a>
                            )}
                            {speaker.websiteUrl && (
                              <a
                                href={speaker.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${speaker.name} website`}
                                className="text-text-faint transition-colors duration-150 hover:text-cyan"
                              >
                                <Globe className="h-4 w-4" aria-hidden="true" />
                              </a>
                            )}
                          </div>
                        )}
                      </article>
                    </Reveal>
                  )
                })}
              </div>
            </>
          ) : (
            <Reveal>
              <EmptyState
                icon={<Mic className="h-6 w-6" aria-hidden="true" />}
                label="To Be Announced"
                title="Speakers & panelists coming soon"
                description="We publish speaker profiles only after official confirmation. As the event approaches, confirmed speakers and panelists will appear here and on the announcements board."
                action={
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Link href="/announcements" className="btn-secondary">
                      Get Updates
                    </Link>
                    <Link href="/contact" className="btn-primary">
                      Suggest a Speaker
                    </Link>
                  </div>
                }
              />
            </Reveal>
          )}
        </div>
      </section>

      {/* ── Panel sessions (rendered only once panels are published) ───── */}
      {panels.length > 0 && (
        <section className="section pt-0">
          <div className="section-inner">
            <Reveal>
              <SectionHeading
                label="// Panel Discussions"
                title="Expert panels, real conversations"
                description="Published panel sessions with their confirmed line-up."
              />
            </Reveal>

            <div className="mt-10 space-y-5">
              {panels.map((panel, index) => (
                <Reveal key={panel.id} delay={index * 0.06}>
                  <article className="rounded-xl border border-border bg-bg-panel p-6 md:p-8">
                    <h3 className="font-display text-lg font-bold tracking-tight text-text-primary">
                      {panel.topic}
                    </h3>

                    {(panel.sessionDate ||
                      panel.startTime ||
                      panel.venue) && (
                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs text-text-muted">
                        {panel.sessionDate && (
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 text-cyan" aria-hidden="true" />
                            {formatISODateShort(panel.sessionDate.toISOString())}
                          </span>
                        )}
                        {panel.startTime && (
                          <span>
                            {panel.startTime}
                            {panel.endTime ? ` – ${panel.endTime}` : ""}
                          </span>
                        )}
                        {panel.venue && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-cyan" aria-hidden="true" />
                            {panel.venue}
                          </span>
                        )}
                      </div>
                    )}

                    {panel.description && (
                      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-text-muted">
                        {panel.description}
                      </p>
                    )}

                    {panel.panelists.length > 0 && (
                      <div className="mt-5 flex flex-wrap gap-3">
                        {panel.panelists.map((entry) => (
                          <div
                            key={entry.speaker.id}
                            className="flex items-center gap-3 rounded-lg border border-border bg-bg-elevated px-4 py-2.5"
                          >
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/5 font-display text-xs font-bold text-cyan">
                              {initials(entry.speaker.name)}
                            </span>
                            <span>
                              <span className="block text-sm font-medium text-text-primary">
                                {entry.speaker.name}
                              </span>
                              <span className="block text-[0.6875rem] text-text-faint">
                                {entry.role ?? entry.speaker.title}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Speaking CTA ──────────────────────────────────────────────── */}
      <section className="section pt-0">
        <div className="section-inner">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border border-border bg-bg-panel p-8 md:p-12">
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-radial-cyan opacity-40"
                aria-hidden="true"
              />
              <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                <div>
                  <p className="section-label">{"// Share your expertise"}</p>
                  <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
                    Want to speak at CyberCon 2026?
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
                    We welcome session proposals from security researchers,
                    industry practitioners and academics. Tell us your topic and
                    the team will follow up.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-3">
                  <Link href="/contact" className="btn-primary gap-2">
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    Propose a Session
                  </Link>
                  <Link href="/events" className="btn-secondary">
                    Explore the Program
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
