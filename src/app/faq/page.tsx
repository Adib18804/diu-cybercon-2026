// =============================================================================
// FAQ — /faq
// Answers to the most common questions, driven by the FAQ table.
// =============================================================================

import { Info } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { FaqList, type FaqItem } from "./FaqList"

import { EmptyState, PageHeader } from "@/components/layout"
import { prisma } from "@/lib/db"

export const revalidate = 300

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about DIU CyberCon 2026 registration, events, and participation.",
}

// ─── Data ─────────────────────────────────────────────────────────────────────

async function getFaqs(): Promise<FaqItem[]> {
  try {
    return await prisma.fAQ.findMany({
      where: { isPublished: true },
      orderBy: [{ displayOrder: "asc" }, { question: "asc" }],
      select: { id: true, question: true, answer: true, category: true },
    })
  } catch {
    return []
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FaqPage() {
  const faqs = await getFaqs()

  return (
    <>
      <PageHeader
        label="Support"
        title="Frequently Asked Questions"
        description="Quick answers about registration, event formats, eligibility, venue, and submissions at DIU CyberCon 2026."
        crumbs={[{ label: "Home", href: "/" }, { label: "FAQ" }]}
        actions={
          <>
            <Link href="/contact" className="btn-secondary">
              Talk to the Team
            </Link>
            <Link href="/register" className="btn-primary">
              Start Registration
            </Link>
          </>
        }
      />

      <section className="section">
        <div className="section-inner">
          {faqs.length === 0 ? (
            <EmptyState
              icon={<Info size={24} />}
              title="FAQ coming soon"
              description="Answers about registration, events, and participation will appear here shortly. In the meantime, reach out to the team directly — we are happy to help."
              action={
                <Link href="/contact" className="btn-primary">
                  Contact the Team
                </Link>
              }
            />
          ) : (
            <FaqList items={faqs} />
          )}
        </div>
      </section>

      {/* ── Still have questions ── */}
      <section className="section">
        <div className="section-inner">
          <div className="relative overflow-hidden rounded-xl border border-border bg-bg-panel p-8 md:p-12">
            <div
              className="absolute inset-0 bg-gradient-radial-cyan opacity-40"
              aria-hidden="true"
            />
            <div className="relative z-content max-w-2xl space-y-4">
              <span className="section-label">
                {"// Still have questions"}
              </span>
              <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary md:text-3xl">
                {"Didn't find what you're looking for?"}
              </h2>
              <p className="font-body text-sm leading-relaxed text-text-muted md:text-base">
                Send us a message and the organizing team will get back to
                you — or check the announcements for the latest updates on
                registration and the programme.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/contact" className="btn-primary">
                  Contact the Team
                </Link>
                <Link href="/announcements" className="btn-secondary">
                  Browse Announcements
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
