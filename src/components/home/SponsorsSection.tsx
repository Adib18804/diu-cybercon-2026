import { Check, Handshake, Minus } from "lucide-react"
import Link from "next/link"

import type { HomeSponsor } from "./types"

import { Reveal } from "@/components/ui/Reveal"
import { SectionHeading } from "@/components/ui/SectionHeading"
import { SPONSOR_BENEFITS, SPONSOR_TIERS } from "@/lib/constants"


// =============================================================================
// SponsorsSection — Section 15
// Tier packages + benefits matrix (from the official proposal — no invented
// extras). Actual 2026 sponsor logos render from the database only.
// =============================================================================

export interface SponsorsSectionProps {
  sponsors: HomeSponsor[]
}

const TIER_ORDER = ["TITLE", "PLATINUM", "GOLD", "CUSTOM"] as const

const TIER_ACCENT = {
  TITLE: { text: "text-amber", border: "border-amber/30 hover:border-amber/60", badge: "badge-amber" },
  PLATINUM: { text: "text-text-primary", border: "border-border hover:border-text-muted/40", badge: "badge-muted" },
  GOLD: { text: "text-amber", border: "border-amber/20 hover:border-amber/40", badge: "badge-amber" },
  CUSTOM: { text: "text-cyan", border: "border-cyan/20 hover:border-cyan/40", badge: "badge-cyan" },
} as const

function tierConfig(key: string) {
  return SPONSOR_TIERS[key as keyof typeof SPONSOR_TIERS]
}

function tierAccent(key: string) {
  return TIER_ACCENT[key as keyof typeof TIER_ACCENT] ?? TIER_ACCENT.CUSTOM
}

function SponsorsSection({ sponsors }: SponsorsSectionProps) {
  return (
    <section className="section pt-0" id="sponsors">
      <div className="section-inner">
        <Reveal>
          <SectionHeading
            label="// Sponsors"
            title="Partner with Bangladesh's cyber talent pipeline"
            description="Reach hundreds of teams, universities and industry leaders. Three partnership tiers plus flexible custom packages."
            action={
              <Link href="/sponsor-portal" className="btn-primary">
                Become a Sponsor
              </Link>
            }
          />
        </Reveal>

        {/* ── Confirmed sponsors (database-driven, honest empty state) ──── */}
        {sponsors.length > 0 ? (
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
                  {sponsor.tier} sponsor
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Reveal delay={0.05}>
            <div className="mt-10 flex items-center gap-4 rounded-lg border border-dashed border-border bg-bg-panel/50 p-5">
              <Handshake className="h-5 w-5 shrink-0 text-amber" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-text-muted">
                <span className="font-bold text-text-primary">
                  2026 sponsor partners will be announced soon.
                </span>{" "}
                Sponsorship packages are open — see the tiers below and start an
                application.
              </p>
            </div>
          </Reveal>
        )}

        {/* ── Tier cards ────────────────────────────────────────────────── */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TIER_ORDER.map((key, index) => {
            const tier = tierConfig(key)
            const accent = tierAccent(key)
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
                  {tier.priceBDT !== null && (
                    <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-wider text-text-faint">
                      BDT · negotiable benefits
                    </p>
                  )}
                  {tier.priceBDT === null && (
                    <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-wider text-text-faint">
                      Tailored to your goals
                    </p>
                  )}
                </div>
              </Reveal>
            )
          })}
        </div>

        {/* ── Benefits matrix ───────────────────────────────────────────── */}
        <Reveal delay={0.1}>
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

        <Reveal delay={0.12}>
          <p className="mt-4 text-center font-mono text-xs text-text-faint">
            Pricing and benefits per the official sponsorship proposal ·{" "}
            <Link href="/sponsors" className="text-cyan hover:underline">
              full sponsorship details
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  )
}

export { SponsorsSection }
