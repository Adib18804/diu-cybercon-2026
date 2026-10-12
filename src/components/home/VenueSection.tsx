import { CalendarDays, MapPin, Navigation } from "lucide-react"
import Link from "next/link"

import { Reveal } from "@/components/ui/Reveal"
import { SectionHeading } from "@/components/ui/SectionHeading"
import { EVENT_DATES } from "@/lib/constants"

// =============================================================================
// VenueSection — Section 19
// Venue card + embedded map. Falls back to a generated Google Maps query URL
// when the admin-configured embed URL is empty.
// =============================================================================

export interface VenueSectionProps {
  name: string
  address: string
  /** Admin-configured embed URL — empty string falls back to a Maps query */
  mapEmbedUrl: string
}

function VenueSection({ name, address, mapEmbedUrl }: VenueSectionProps) {
  const query = encodeURIComponent(`${name}, ${address}`)
  const embedSrc =
    mapEmbedUrl.trim().length > 0
      ? mapEmbedUrl
      : `https://www.google.com/maps?q=${query}&output=embed`
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${query}`

  const travelNotes = [
    { label: "From Dhaka city", value: "~40–60 min via Dhaka–Aricha Highway (N5)" },
    { label: "Nearest landmark", value: "Daffodil Smart City campus gate, Birulia" },
    { label: "On-site days", value: `${EVENT_DATES.day2.label} · ${EVENT_DATES.day3.label}` },
  ]

  return (
    <section className="section pt-0" id="venue">
      <div className="section-inner">
        <Reveal>
          <SectionHeading
            label="// Venue & Campus"
            title="Where the mission happens"
            description={`${EVENT_DATES.day1.label} online · ${EVENT_DATES.day2.label} & ${EVENT_DATES.day3.label} on-site`}
            action={
              <Link href="/venue" className="btn-secondary text-sm">
                Venue Details
              </Link>
            }
          />
        </Reveal>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
          {/* Info card */}
          <Reveal>
            <div className="flex h-full flex-col rounded-xl border border-border bg-bg-panel p-6">
              <span
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-neon/20 bg-neon/5 text-neon"
                aria-hidden="true"
              >
                <MapPin className="h-5 w-5" />
              </span>

              <h3 className="font-display text-xl font-bold tracking-tight text-text-primary">
                {name}
              </h3>
              <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-text-muted">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-faint" aria-hidden="true" />
                {address}
              </p>

              <dl className="mt-6 flex-1 space-y-3">
                {travelNotes.map((note) => (
                  <div key={note.label} className="border-t border-border pt-3">
                    <dt className="font-mono text-[0.6rem] uppercase tracking-widest text-text-faint">
                      {note.label}
                    </dt>
                    <dd className="mt-1 text-sm text-text-muted">{note.value}</dd>
                  </div>
                ))}
              </dl>

              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-6 justify-center gap-2 text-sm"
              >
                <Navigation className="h-4 w-4" aria-hidden="true" />
                Get Directions
              </a>
            </div>
          </Reveal>

          {/* Map */}
          <Reveal delay={0.1}>
            <div className="relative h-full min-h-[320px] overflow-hidden rounded-xl border border-border bg-bg-panel">
              <iframe
                src={embedSrc}
                title={`Map — ${name}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
              {/* Corner accents */}
              <span className="pointer-events-none absolute left-3 top-3 h-4 w-4 border-l-2 border-t-2 border-cyan/60" aria-hidden="true" />
              <span className="pointer-events-none absolute right-3 top-3 h-4 w-4 border-r-2 border-t-2 border-cyan/60" aria-hidden="true" />
              <span className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 border-b-2 border-l-2 border-cyan/60" aria-hidden="true" />
              <span className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 border-b-2 border-r-2 border-cyan/60" aria-hidden="true" />
            </div>
          </Reveal>
        </div>

        <p className="mt-4 flex items-center justify-center gap-2 font-mono text-[0.65rem] uppercase tracking-widest text-text-faint">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          CTF prelims online · All other modules on-campus
        </p>
      </div>
    </section>
  )
}

export { VenueSection }
