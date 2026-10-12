// =============================================================================
// Sponsors — /sponsors
// Public sponsorship page: packages and the benefits matrix come from the
// official proposal (never invented extras). Confirmed 2026 sponsors render
// from the database with an honest empty state. The application form posts to
// /api/sponsors/apply — rate limited and server-validated.
// =============================================================================

import {
  Check,
  ClipboardCheck,
  Handshake,
  Minus,
  Send,
  Sparkles,
  Target,
  Users,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { SponsorApplicationForm } from "./SponsorApplicationForm"

import { EmptyState, PageHeader } from "@/components/layout"
import { Reveal, SectionHeading } from "@/components/ui"
import { LEGACY_2025, SPONSOR_BENEFITS, SPONSOR_TIERS } from "@/lib/constants"
import { prisma } from "@/lib/db"

export const revalidate = 300

export const metadata: Metadata = {
  title: "Sponsors & Partnership",
  description:
    "Sponsorship packages for DIU CyberCon 2026 — Title, Platinum, Gold and custom partnerships. Reach hundreds of teams, universities and industry leaders.",
}

// =============================================================================
// Data access
// =============================================================================

interface ConfirmedSponsor {
  id: string
  name: string
  tier: string
  logoKey: string
}

async function getSponsors(): Promise<ConfirmedSponsor[]> {
  try {
    return await prisma.sponsor.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, tier: true, logoKey: true },
    })
  } catch {
    return []
  }
}

// =============================================================================
// Static configuration
// =============================================================================

const TIER_ORDER = ["TITLE", "PLATINUM", "GOLD", "CUSTOM"] as const

const TIER_ACCENT = {
  TITLE: { text: "text-amber", border: "border-amber/30 hover:border-amber/60", badge: "badge-amber" },
  PLATINUM: { text: "text-text-primary", border: "border-border hover:border-text-muted/40", badge: "badge-muted" },
  GOLD: { text: "text-amber", border: "border-amber/20 hover:border-amber/40", badge: "badge-amber" },
  CUSTOM: { text: "text-cyan", border: "border-cyan/20 hover:border-cyan/40", badge: "badge-cyan" },
} as const

const APPLICATION_STEPS = [
  {
    icon: Send,
    title: "Submit your application",
    description:
      "Complete the form below with your organization details and preferred package. It takes about two minutes.",
  },
  {
    icon: ClipboardCheck,
    title: "Team review & contact",
    description:
      "The sponsorship team reviews your application and contacts you to discuss benefits and arrangements.",
  },
  {
    icon: Handshake,
    title: "Confirm the arrangement",
    description:
      "Finalize the package and complete the agreed sponsorship. All sponsorships are subject to organizer approval.",
  },
  {
    icon: Sparkles,
    title: "Logo & materials go live",
    description:
      "Your logo is published on the website, event banner, and the agreed collateral as the event approaches.",
  },
] as const

function tierLabel(tier: string): string {
  const known = SPONSOR_TIERS[tier as keyof typeof SPONSOR_TIERS]
  if (known) {
    return known.label
  }
  return tier
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ")
}

// =============================================================================
// Page
// =============================================================================

export default async function SponsorsPage() {
  const sponsors = await getSponsors()

  return (
    <>
      <PageHeader
        label="// Sponsorship"
        title="Partner with Bangladesh's cyber talent pipeline"
        description="Reach hundreds of teams, universities and industry leaders at DIU CyberCon 2026. Three partnership tiers plus flexible custom packages — tailored with the organizing team."
        crumbs={[{ label: "Home", href: "/" }, { label: "Sponsors" }]}
        actions={
          <>
            <a href="#apply" className="btn-primary">
              Become a Sponsor
            </a>
            <Link href="/contact" className="btn-secondary">
              Talk to the Team
            </Link>
          </>
        }
      />

      {/* ── Confirmed sponsors (database-driven, honest empty state) ──── */}
      <section className="section pt-8">
        <div className="section-inner">
          {sponsors.length > 0 ? (
            <>
              <Reveal>
                <SectionHeading
                  label="// 2026 Sponsors"
                  title="Confirmed sponsor partners"
                  description="Organizations backing CyberCon 2026 — published as agreements are finalized."
                />
              </Reveal>
              <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {sponsors.map((sponsor) => (
                  <div
                    key={sponsor.id}
                    className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-bg-panel p-5 text-center transition-colors duration-250 hover:border-cyan/30"
                  >
                    {sponsor.logoKey.startsWith("http") ? (
                      // Admin-uploaded absolute URL — plain img is intentional
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sponsor.logoKey}
                        alt={sponsor.name}
                        className="h-10 w-auto object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <span className="font-display text-sm font-bold text-text-primary">
                        {sponsor.name}
                      </span>
                    )}
                    <span className="font-mono text-[0.6rem] uppercase tracking-wider text-text-faint">
                      {tierLabel(sponsor.tier)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <Reveal>
              <EmptyState
                icon={<Handshake className="h-6 w-6" aria-hidden="true" />}
                label="To Be Announced"
                title="2026 sponsor partners will be announced soon"
                description="Sponsorship packages are open. See the tiers and benefits below, then start an application — the team will contact you to discuss the arrangement."
                action={
                  <a href="#apply" className="btn-primary">
                    Start an Application
                  </a>
                }
              />
            </Reveal>
          )}
        </div>
      </section>

      {/* ── Why sponsor ───────────────────────────────────────────────── */}
      <section className="section pt-0">
        <div className="section-inner">
          <Reveal>
            <SectionHeading
              label="// Why partner"
              title="Put your brand in front of the next generation"
              description="CyberCon brings together student teams, universities and industry practitioners from across Bangladesh — on-site and online."
            />
          </Reveal>

          <div className="mt-10 grid grid-cols-2 gap-5 lg:grid-cols-4">
            {(
              [
                { value: String(LEGACY_2025.teams), label: "Registered teams" },
                { value: String(LEGACY_2025.totalOrgs), label: "Organizations represented" },
                { value: String(LEGACY_2025.universities), label: "Universities" },
                { value: String(LEGACY_2025.mediaTypes.length), label: "Media channels" },
              ] as const
            ).map((stat, index) => (
              <Reveal key={stat.label} delay={index * 0.06}>
                <div className="rounded-xl border border-border bg-bg-panel p-5 text-center transition-colors duration-250 hover:border-cyan/30">
                  <p className="font-display text-3xl font-bold tracking-tight text-cyan">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.2}>
            <p className="mt-4 text-center font-mono text-xs text-text-faint">
              Figures from the 2025 edition — historical participation data
            </p>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
            {(
              [
                {
                  icon: Target,
                  title: "Brand visibility",
                  description:
                    "Logo placement across the event banner, website, t-shirts, crest and gift boxes according to your package.",
                },
                {
                  icon: Users,
                  title: "Talent pipeline",
                  description:
                    "Direct access to emerging security talent from universities, colleges and schools across the country.",
                },
                {
                  icon: Sparkles,
                  title: "Media reach",
                  description:
                    "Mentions through event announcements and media coverage channels, per your package benefits.",
                },
              ] as const
            ).map((value, index) => (
              <Reveal key={value.title} delay={index * 0.08}>
                <div className="flex h-full flex-col rounded-xl border border-border bg-bg-panel p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/5">
                    <value.icon className="h-5 w-5 text-cyan" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-bold tracking-tight text-text-primary">
                    {value.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">
                    {value.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tier cards ────────────────────────────────────────────────── */}
      <section className="section pt-0" id="packages">
        <div className="section-inner">
          <Reveal>
            <SectionHeading
              label="// Packages"
              title="Choose the partnership that fits"
              description="Pricing and benefits per the official sponsorship proposal. Custom arrangements are welcome."
            />
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TIER_ORDER.map((key, index) => {
              const tier = SPONSOR_TIERS[key]
              const accent = TIER_ACCENT[key]
              return (
                <Reveal key={key} delay={index * 0.07}>
                  <div
                    className={`flex h-full flex-col rounded-xl border bg-bg-panel p-6 transition-all duration-400 hover:-translate-y-1 ${accent.border}`}
                  >
                    <span className={accent.badge}>{tier.tagline}</span>
                    <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-text-primary">
                      {tier.label}
                    </h3>
                    <p className={`mt-2 font-mono text-xl font-bold ${accent.text}`}>
                      {tier.priceDisplay}
                    </p>
                    {tier.priceBDT !== null ? (
                      <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-wider text-text-faint">
                        BDT · negotiable benefits
                      </p>
                    ) : (
                      <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-wider text-text-faint">
                        Tailored to your goals
                      </p>
                    )}
                    <a href="#apply" className="btn-secondary mt-6 !py-2 text-xs">
                      Apply for this package
                    </a>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Benefits matrix ───────────────────────────────────────────── */}
      <section className="section pt-0" id="benefits">
        <div className="section-inner">
          <Reveal>
            <SectionHeading
              label="// Benefits"
              title="What each package includes"
              description="Exactly as listed in the official sponsorship proposal — no hidden extras."
            />
          </Reveal>

          <Reveal delay={0.08}>
            <div className="mt-10 overflow-hidden rounded-xl border border-border bg-bg-panel">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <caption className="sr-only">
                    Sponsor benefits comparison across Title, Platinum and Gold tiers
                  </caption>
                  <thead>
                    <tr className="border-b border-border bg-bg-elevated">
                      <th
                        scope="col"
                        className="px-5 py-4 text-left font-mono text-xs uppercase tracking-widest text-text-muted"
                      >
                        Benefit
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-4 text-center font-mono text-xs uppercase tracking-widest text-amber"
                      >
                        Title
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-4 text-center font-mono text-xs uppercase tracking-widest text-text-primary"
                      >
                        Platinum
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-4 text-center font-mono text-xs uppercase tracking-widest text-amber"
                      >
                        Gold
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {SPONSOR_BENEFITS.map((row, i) => (
                      <tr
                        key={row.benefit}
                        className={`border-b border-border/60 last:border-0 ${i % 2 === 1 ? "" : "bg-bg-elevated/30"}`}
                      >
                        <th
                          scope="row"
                          className="px-5 py-3.5 text-left text-sm font-normal text-text-muted"
                        >
                          {row.benefit}
                        </th>
                        {([row.title, row.platinum, row.gold] as const).map(
                          (included, colIdx) => (
                            <td key={colIdx} className="px-4 py-3.5 text-center">
                              {included ? (
                                <Check
                                  className="mx-auto h-4 w-4 text-neon"
                                  aria-label="Included"
                                />
                              ) : (
                                <Minus
                                  className="mx-auto h-4 w-4 text-text-faint"
                                  aria-label="Not included"
                                />
                              )}
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section className="section pt-0">
        <div className="section-inner">
          <Reveal>
            <SectionHeading
              label="// How it works"
              title="From application to logo placement"
              description="A simple, transparent process managed by the sponsorship team."
            />
          </Reveal>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {APPLICATION_STEPS.map((step, index) => (
              <Reveal key={step.title} delay={index * 0.07}>
                <div className="flex h-full flex-col rounded-xl border border-border bg-bg-panel p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-violet/30 bg-violet/5">
                      <step.icon className="h-5 w-5 text-violet" aria-hidden="true" />
                    </div>
                    <span className="font-mono text-xs uppercase tracking-widest text-text-faint">
                      Step {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-base font-bold tracking-tight text-text-primary">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Application form ──────────────────────────────────────────── */}
      <section className="section pt-0" id="apply">
        <div className="section-inner">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-12">
            <Reveal>
              <div>
                <p className="section-label">{"// Become a sponsor"}</p>
                <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
                  Start your sponsorship application
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-text-muted">
                  Tell us about your organization and preferred package. The
                  sponsorship team reviews every application and follows up to
                  discuss the arrangement — all sponsorships are subject to
                  organizer approval.
                </p>

                <ul className="mt-6 space-y-3">
                  {(
                    [
                      "Response from the team within a few working days",
                      "Flexible custom packages for any budget",
                      "Logo and materials published after confirmation",
                    ] as const
                  ).map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm text-text-muted">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-neon" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>

                <div className="mt-8 rounded-xl border border-border bg-bg-panel/60 p-5">
                  <p className="font-mono text-[0.6875rem] uppercase tracking-widest text-text-faint">
                    Prefer email?
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-text-muted">
                    Send your details to the organizing team via the contact
                    page and mention sponsorship in your message.
                  </p>
                  <Link href="/contact" className="mt-2 inline-block text-sm text-cyan hover:underline">
                    Contact the team →
                  </Link>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <SponsorApplicationForm />
            </Reveal>
          </div>
        </div>
      </section>
    </>
  )
}
