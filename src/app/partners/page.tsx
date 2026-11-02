// =============================================================================
// Partners — /partners
// Partner organizations are database-driven (Partner model) and grouped by
// category. Nothing renders until a partner is confirmed by the team — an
// honest "To Be Announced" state is shown otherwise (Part 22).
// =============================================================================

import { ArrowRight, Briefcase, Cpu, GraduationCap, Handshake, Megaphone } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { EmptyState, PageHeader } from "@/components/layout"
import { Reveal, SectionHeading } from "@/components/ui"
import { prisma } from "@/lib/db"

export const revalidate = 300

export const metadata: Metadata = {
  title: "Partners",
  description:
    "Partner organizations of DIU_CYBERCON 2026 — academic, technical, media and industry partners announced as agreements are confirmed.",
}

// =============================================================================
// Data access
// =============================================================================

interface PartnerCard {
  id: string
  name: string
  category: string
  logoKey: string
  websiteUrl: string | null
}

async function getPartners(): Promise<PartnerCard[]> {
  try {
    return await prisma.partner.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        category: true,
        logoKey: true,
        websiteUrl: true,
      },
    })
  } catch {
    return []
  }
}

// =============================================================================
// Static configuration
// =============================================================================

const CATEGORY_ORDER = ["Academic", "Technical", "Media", "Industry"] as const

const CATEGORY_META: Record<
  string,
  { icon: typeof GraduationCap; description: string }
> = {
  Academic: {
    icon: GraduationCap,
    description:
      "Universities, colleges and educational institutions collaborating with the event.",
  },
  Technical: {
    icon: Cpu,
    description:
      "Platforms, tools and technical communities supporting the competition program.",
  },
  Media: {
    icon: Megaphone,
    description: "Press, broadcast and online media partners covering the event.",
  },
  Industry: {
    icon: Briefcase,
    description:
      "Companies and industry bodies engaging with the cybersecurity community.",
  },
}

// =============================================================================
// Page
// =============================================================================

export default async function PartnersPage() {
  const partners = await getPartners()

  // Group confirmed partners by category (known categories first, in order).
  const groups = new Map<string, PartnerCard[]>()
  for (const partner of partners) {
    const existing = groups.get(partner.category) ?? []
    existing.push(partner)
    groups.set(partner.category, existing)
  }
  const orderedCategories = [
    ...CATEGORY_ORDER.filter((category) => groups.has(category)),
    ...Array.from(groups.keys()).filter(
      (category) => !(CATEGORY_ORDER as readonly string[]).includes(category),
    ),
  ]

  return (
    <>
      <PageHeader
        label="// Partners"
        title="Our partners"
        description="Institutions, platforms and media organizations partnering with DIU_CYBERCON 2026 — announced here as agreements are confirmed."
        crumbs={[{ label: "Home", href: "/" }, { label: "Partners" }]}
        actions={
          <>
            <Link href="/sponsors" className="btn-primary">
              Become a Partner
            </Link>
            <Link href="/contact" className="btn-secondary">
              Talk to the Team
            </Link>
          </>
        }
      />

      {/* ── Confirmed partners (grouped by category) ───────────────────── */}
      <section className="section pt-8">
        <div className="section-inner">
          {partners.length > 0 ? (
            <div className="space-y-12">
              {orderedCategories.map((category) => {
                const meta = CATEGORY_META[category]
                const entries = groups.get(category) ?? []
                return (
                  <div key={category}>
                    <Reveal>
                      <div className="flex items-center gap-3">
                        {meta && (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/5">
                            <meta.icon className="h-5 w-5 text-cyan" aria-hidden="true" />
                          </div>
                        )}
                        <div>
                          <h2 className="font-display text-xl font-bold tracking-tight text-text-primary">
                            {category} Partners
                          </h2>
                          {meta && (
                            <p className="text-sm text-text-muted">{meta.description}</p>
                          )}
                        </div>
                      </div>
                    </Reveal>
                    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                      {entries.map((partner, index) => (
                        <Reveal key={partner.id} delay={index * 0.05}>
                          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-border bg-bg-panel p-5 text-center transition-colors duration-250 hover:border-cyan/30">
                            {partner.logoKey.startsWith("http") ? (
                              // Admin-uploaded absolute URL — plain img is intentional
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={partner.logoKey}
                                alt={partner.name}
                                className="h-10 w-auto object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <span className="font-display text-sm font-bold text-text-primary">
                                {partner.name}
                              </span>
                            )}
                            {partner.websiteUrl && (
                              <a
                                href={partner.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-[0.6rem] uppercase tracking-wider text-cyan hover:underline"
                              >
                                Visit website →
                              </a>
                            )}
                          </div>
                        </Reveal>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Reveal>
              <EmptyState
                icon={<Handshake className="h-6 w-6" aria-hidden="true" />}
                label="To Be Announced"
                title="Partner organizations will be announced soon"
                description="We publish partner organizations only after official confirmation. As agreements are finalized, our academic, technical, media and industry partners will appear here."
                action={
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Link href="/sponsors" className="btn-primary">
                      Partnership Opportunities
                    </Link>
                    <Link href="/contact" className="btn-secondary">
                      Contact the Team
                    </Link>
                  </div>
                }
              />
            </Reveal>
          )}
        </div>
      </section>

      {/* ── Partnership categories ─────────────────────────────────────── */}
      <section className="section pt-0">
        <div className="section-inner">
          <Reveal>
            <SectionHeading
              label="// Partnership types"
              title="How organizations partner with us"
              description="Every partnership is tailored with the organizing team — these are the categories we work with."
            />
          </Reveal>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { key: "Academic", icon: GraduationCap },
                { key: "Technical", icon: Cpu },
                { key: "Media", icon: Megaphone },
                { key: "Industry", icon: Briefcase },
              ] as const
            ).map((category, index) => (
              <Reveal key={category.key} delay={index * 0.07}>
                <div className="flex h-full flex-col rounded-xl border border-border bg-bg-panel p-6 transition-all duration-400 hover:-translate-y-1 hover:border-cyan/40 hover:shadow-card-hover">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-violet/30 bg-violet/5">
                    <category.icon className="h-5 w-5 text-violet" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-bold tracking-tight text-text-primary">
                    {category.key} Partners
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">
                    {CATEGORY_META[category.key]?.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Partnership CTA ───────────────────────────────────────────── */}
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
                  <p className="section-label">{"// Partner with us"}</p>
                  <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
                    Interested in partnering with CyberCon 2026?
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
                    Sponsorship packages and custom partnership arrangements are
                    open. Start an application or reach out to the team to
                    discuss how we can work together.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-3">
                  <Link href="/sponsors" className="btn-primary gap-2">
                    Sponsorship Packages
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link href="/contact" className="btn-secondary">
                    Contact the Team
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
