import Link from "next/link"

import type { HomeFaq } from "./types"

import { Accordion } from "@/components/ui"
import { Reveal } from "@/components/ui/Reveal"
import { SectionHeading } from "@/components/ui/SectionHeading"


// =============================================================================
// FaqPreview — Section 20
// First six published FAQs from the database, rendered in a cyber accordion.
// =============================================================================

export interface FaqPreviewProps {
  faqs: HomeFaq[]
}

const PREVIEW_COUNT = 6

function FaqPreview({ faqs }: FaqPreviewProps) {
  if (faqs.length === 0) {return null}

  const preview = faqs.slice(0, PREVIEW_COUNT)

  const items = preview.map((faq) => ({
    value: faq.id,
    trigger: faq.question,
    badge: faq.category,
    content: <p className="whitespace-pre-line">{faq.answer}</p>,
  }))

  return (
    <section className="section pt-0" id="faq">
      <div className="section-inner">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-12">
          <Reveal>
            <div className="lg:sticky lg:top-24">
              <SectionHeading
                label="// FAQ"
                title="Questions, answered"
                description="Everything participants ask before registering — team rules, deadlines, eligibility and more."
                align="left"
              />
              <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link href="/faq" className="btn-secondary justify-center text-sm">
                  View All FAQs
                </Link>
                <Link href="/contact" className="btn-ghost justify-center text-sm">
                  Ask a Question
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <Accordion items={items} variant="cyber" iconStyle="plus-minus" type="single" />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

export { FaqPreview }
