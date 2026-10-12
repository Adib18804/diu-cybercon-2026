import { ExternalLink, Mic } from "lucide-react"
import Link from "next/link"

import type { HomeSpeaker } from "./types"

import { Reveal } from "@/components/ui/Reveal"
import { SectionHeading } from "@/components/ui/SectionHeading"


// =============================================================================
// SpeakersPreview — Section 13
// Shows confirmed, visible speakers from the database. When none are confirmed
// yet, an honest "To Be Announced" state is shown — never invented names
// (Part 22).
// =============================================================================

export interface SpeakersPreviewProps {
  speakers: HomeSpeaker[]
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}

function SpeakersPreview({ speakers }: SpeakersPreviewProps) {
  return (
    <section className="section pt-0" id="speakers">
      <div className="section-inner">
        <Reveal>
          <SectionHeading
            label="// Speakers & Panelists"
            title={speakers.length > 0 ? "Voices of CyberCon 2026" : "The lineup is being assembled"}
            description={
              speakers.length > 0
                ? "Industry leaders, researchers and practitioners sharing the stage."
                : "Speaker and panelist announcements will be published here as confirmations are received."
            }
            action={
              <Link href="/speakers" className="btn-secondary">
                All Speakers
              </Link>
            }
          />
        </Reveal>

        {speakers.length > 0 ? (
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {speakers.map((speaker, index) => (
              <Reveal key={speaker.id} delay={index * 0.08}>
                <div className="group flex h-full flex-col rounded-xl border border-border bg-bg-panel p-5 transition-all duration-400 hover:-translate-y-1 hover:border-cyan/40 hover:shadow-card-hover">
                  {/* Avatar — initials (photos are added later by admin) */}
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/5 font-display text-xl font-bold text-cyan">
                    {initials(speaker.name)}
                  </div>

                  <h3 className="mt-4 font-display text-base font-bold tracking-tight text-text-primary">
                    {speaker.name}
                  </h3>
                  <p className="mt-1 text-xs text-text-muted">
                    {speaker.title}
                  </p>
                  <p className="mt-0.5 font-mono text-[0.6875rem] uppercase tracking-wider text-text-faint">
                    {speaker.organization}
                  </p>

                  {speaker.expertise.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {speaker.expertise.slice(0, 3).map((tag) => (
                        <span key={tag} className="badge-muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {speaker.linkedinUrl && (
                    <a
                      href={speaker.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-auto flex items-center gap-1.5 pt-4 font-mono text-xs text-cyan hover:underline"
                    >
                      LinkedIn
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal delay={0.1}>
            <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed border-border bg-bg-panel/50 px-6 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/5">
                <Mic className="h-6 w-6 text-cyan" aria-hidden="true" />
              </div>
              <p className="section-label mt-5 mb-0 justify-center">To Be Announced</p>
              <h3 className="mt-2 font-display text-xl font-bold text-text-primary">
                Speakers & panelists coming soon
              </h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-text-muted">
                We publish speaker profiles only after official confirmation.
                Check the speakers page for updates as the event approaches.
              </p>
              <Link href="/speakers" className="btn-secondary mt-6">
                Visit Speakers Page
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  )
}

export { SpeakersPreview }
