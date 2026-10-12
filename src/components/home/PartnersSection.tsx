import { Building2 } from "lucide-react"
import Link from "next/link"

import type { HomePartner } from "./types"

import { Reveal } from "@/components/ui/Reveal"
import { SectionHeading } from "@/components/ui/SectionHeading"


// =============================================================================
// PartnersSection — Section 16
// Partner organizations from the database; honest placeholder otherwise.
// =============================================================================

export interface PartnersSectionProps {
  partners: HomePartner[]
}

function PartnersSection({ partners }: PartnersSectionProps) {
  return (
    <section className="section pt-0" id="partners">
      <div className="section-inner">
        <Reveal>
          <SectionHeading
            label="// Partners"
            title="Backed by the community"
            description="Universities, clubs and organisations supporting the national cyber talent stage."
            size="sm"
          />
        </Reveal>

        {partners.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {partners.map((partner) => (
              <div
                key={partner.id}
                className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-bg-panel p-4 text-center transition-colors duration-250 hover:border-violet/30"
              >
                {partner.logoKey?.startsWith("http") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={partner.logoKey}
                    alt={partner.name}
                    className="h-8 w-auto object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span className="font-display text-xs font-bold text-text-primary">
                    {partner.name}
                  </span>
                )}
                <span className="font-mono text-[0.6rem] uppercase tracking-wider text-text-faint">
                  {partner.category}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Reveal delay={0.05}>
            <div className="mt-8 flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-border bg-bg-panel/50 p-5">
              <Building2 className="h-5 w-5 shrink-0 text-violet" aria-hidden="true" />
              <p className="flex-1 text-sm leading-relaxed text-text-muted">
                <span className="font-bold text-text-primary">
                  Partner organisations will be listed here
                </span>{" "}
                as collaborations are confirmed.
              </p>
              <Link
                href="/contact"
                className="font-mono text-xs font-bold uppercase tracking-wider text-cyan hover:underline"
              >
                Partner with us →
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  )
}

export { PartnersSection }
