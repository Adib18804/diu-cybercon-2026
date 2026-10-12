// =============================================================================
// Venue — /venue
// Everything about the on-site home of DIU CyberCon 2026: Daffodil Smart City
// (DSC), Birulia, Savar. Static facts only — no embedded third-party frames.
// =============================================================================

import {
  ArrowRight,
  CalendarDays,
  ExternalLink,
  GraduationCap,
  Info,
  MapPin,
  Navigation,
  QrCode,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { formatISODateShort } from "@/components/home/helpers"
import { PageHeader } from "@/components/layout"
import { Reveal } from "@/components/ui"
import { EVENT_DATES, VENUE } from "@/lib/constants"

export const metadata: Metadata = {
  title: "Venue",
  description:
    "Daffodil Smart City (DSC), Birulia, Savar, Dhaka-1216 — the home of DIU CyberCon 2026.",
}

// ─── Static content ───────────────────────────────────────────────────────────

const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=Daffodil+Smart+City%2C+Birulia%2C+Savar%2C+Dhaka"

const KEY_DATES = [
  { ...EVENT_DATES.day1, onsite: false },
  { ...EVENT_DATES.day2, onsite: true },
  { ...EVENT_DATES.day3, onsite: true },
] as const

const ARRIVAL_CHECKLIST = [
  {
    icon: QrCode,
    title: "Your digital QR pass",
    description:
      "Every registered participant receives a QR code with their Registration ID — find it in your participant dashboard and keep it ready at the registration desk.",
  },
  {
    icon: GraduationCap,
    title: "Student ID or photo ID",
    description:
      "Bring the original document you uploaded during registration. Verification happens at check-in on arrival.",
  },
  {
    icon: CalendarDays,
    title: "Arrive for your modules",
    description:
      "On-site modules run across Day 02 (14 Nov) and Day 03 (15 Nov). Check the schedule page for confirmed session times as they are published.",
  },
] as const

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VenuePage() {
  return (
    <>
      <PageHeader
        label="// Venue"
        title="Daffodil Smart City (DSC)"
        description="The on-site programme — Day 02 and Day 03 — takes place at Daffodil International University's flagship campus at Birulia, Savar. Day 01 is fully online."
        crumbs={[{ label: "Home", href: "/" }, { label: "Venue" }]}
        actions={
          <>
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary gap-2"
            >
              Open in Google Maps
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link href="/schedule" className="btn-secondary">
              View Schedule
            </Link>
          </>
        }
      />

      <section className="section">
        <div className="section-inner">
          <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-14">
            {/* ── Main column ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-6">
              {/* Address */}
              <Reveal>
                <div className="rounded-xl border border-border bg-bg-panel p-6 md:p-8">
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/5">
                      <MapPin className="h-5 w-5 text-cyan" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="section-label">{"// Address"}</p>
                      <h2 className="mt-2 font-display text-lg font-bold text-text-primary">
                        {VENUE.name}
                      </h2>
                      <p className="mt-1 text-sm leading-relaxed text-text-muted">
                        {VENUE.address}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>

              {/* Getting there */}
              <Reveal delay={0.06}>
                <div className="rounded-xl border border-border bg-bg-panel p-6 md:p-8">
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-violet/30 bg-violet/5">
                      <Navigation className="h-5 w-5 text-violet" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="section-label">{"// Getting there"}</p>
                      <h2 className="mt-2 font-display text-lg font-bold text-text-primary">
                        Reaching Daffodil Smart City
                      </h2>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-col gap-3 text-sm leading-relaxed text-text-muted">
                    <p>
                      Daffodil Smart City sits at Birulia, Savar — northwest of Dhaka,
                      on the far side of the Turag River. From central Dhaka, head
                      northwest along the Dhaka–Savar corridor via Amin Bazar and
                      cross towards Birulia.
                    </p>
                    <p>
                      Ride-hailing services and CNG are the simplest options from
                      inside Dhaka — ask for &ldquo;Daffodil Smart City,
                      Birulia&rdquo;. The campus is marked on all major map apps.
                    </p>
                  </div>
                  <div className="mt-6">
                    <a
                      href={MAPS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary gap-2"
                    >
                      Get Directions
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </Reveal>

              {/* Arrival checklist */}
              <Reveal delay={0.12}>
                <div className="rounded-xl border border-border bg-bg-panel p-6 md:p-8">
                  <p className="section-label">{"// On arrival"}</p>
                  <h2 className="mt-2 font-display text-lg font-bold text-text-primary">
                    What to bring and check in
                  </h2>
                  <ul className="mt-6 flex flex-col gap-5">
                    {ARRIVAL_CHECKLIST.map((item) => (
                      <li key={item.title} className="flex items-start gap-4">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neon/30 bg-neon/5">
                          <item.icon className="h-4 w-4 text-neon" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-text-primary">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-sm leading-relaxed text-text-muted">
                            {item.description}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>

              {/* Campus map note */}
              <Reveal delay={0.18}>
                <div className="flex items-start gap-3 rounded-xl border border-cyan/25 bg-cyan/5 p-5">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
                  <p className="text-sm leading-relaxed text-text-muted">
                    A detailed campus map, gate instructions, and parking notes will be
                    published on the{" "}
                    <Link
                      href="/announcements"
                      className="text-cyan underline-offset-4 hover:underline"
                    >
                      announcements page
                    </Link>{" "}
                    closer to the event.
                  </p>
                </div>
              </Reveal>
            </div>

            {/* ── Sidebar ─────────────────────────────────────────────── */}
            <div className="flex flex-col gap-6">
              <Reveal delay={0.08}>
                <div className="rounded-xl border border-border bg-bg-panel p-6">
                  <p className="section-label">{"// Event days"}</p>
                  <ul className="mt-4 flex flex-col gap-4">
                    {KEY_DATES.map((d) => (
                      <li
                        key={d.label}
                        className="flex items-start justify-between gap-4 border-b border-border/60 pb-4 last:border-0 last:pb-0"
                      >
                        <div>
                          <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-cyan">
                            {d.label}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-text-primary">
                            {formatISODateShort(d.date)}
                          </p>
                        </div>
                        <span
                          className={
                            d.onsite
                              ? "badge-cyan shrink-0"
                              : "badge-muted shrink-0"
                          }
                        >
                          {d.onsite ? "On-site" : "Online"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>

              <Reveal delay={0.14}>
                <div className="rounded-xl border border-border bg-bg-panel p-6">
                  <p className="section-label">{"// Quick links"}</p>
                  <ul className="mt-4 flex flex-col gap-3">
                    {[
                      { href: "/schedule" as const, label: "Full Schedule" },
                      { href: "/events" as const, label: "Event Modules" },
                      { href: "/register" as const, label: "Register Now" },
                      { href: "/faq" as const, label: "FAQ" },
                      { href: "/contact" as const, label: "Contact the Team" },
                    ].map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="group flex items-center justify-between rounded-lg border border-border bg-bg-deep/40 px-4 py-3 transition-colors duration-250 hover:border-cyan/40"
                        >
                          <span className="text-sm text-text-muted group-hover:text-text-primary">
                            {link.label}
                          </span>
                          <ArrowRight
                            className="h-4 w-4 text-text-faint transition-transform duration-250 group-hover:translate-x-0.5 group-hover:text-cyan"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
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
                <p className="section-label justify-center">{"// See you there"}</p>
                <h2 className="mx-auto mt-3 max-w-2xl font-display text-section-h3 font-bold tracking-tight text-text-primary text-balance">
                  Ready to join us at DSC?
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
                  Register for your modules, then check the schedule to plan your two
                  on-site days at Daffodil Smart City.
                </p>
                <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link href="/register" className="btn-primary gap-2">
                    Register Now
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link href="/schedule" className="btn-secondary">
                    View Schedule
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
