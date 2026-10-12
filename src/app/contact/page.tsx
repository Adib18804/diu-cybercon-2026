// =============================================================================
// Contact — /contact
// Server component. Contact channels are rendered from database-backed site
// settings (admin-editable) with safe constants as fallback. The form itself
// is a client component that posts to /api/contact (rate limited + honeypot).
// =============================================================================

import { Building2, HelpCircle, Mail, MapPin, Phone, Send } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { ContactForm } from "./ContactForm"

import { PageHeader } from "@/components/layout"
import { Reveal } from "@/components/ui"
import { APP_EMAIL, ORGANIZER, VENUE } from "@/lib/constants"
import { prisma } from "@/lib/db"

export const revalidate = 300

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the DIU CyberCon 2026 organizing team — questions, registration help, partnership ideas, and media inquiries.",
}

interface ContactChannels {
  email: string
  phone: string
  organizerName: string
  organizerWebsite: string
  facebook: string
  linkedin: string
  twitter: string
  youtube: string
}

async function getContactChannels(): Promise<ContactChannels> {
  const defaults: ContactChannels = {
    email: APP_EMAIL,
    phone: "",
    organizerName: `${ORGANIZER.name}, ${ORGANIZER.university}`,
    organizerWebsite: ORGANIZER.website,
    facebook: "",
    linkedin: "",
    twitter: "",
    youtube: "",
  }

  try {
    const rows = await prisma.siteSetting.findMany()
    const map = new Map(rows.map((row) => [row.key, row.value]))
    const str = (key: string, fallback: string): string => {
      const value = map.get(key)?.trim()
      return value && value.length > 0 ? value : fallback
    }

    return {
      email: str("contact.email", defaults.email),
      phone: str("contact.phone", defaults.phone),
      organizerName: str("organizer.name", defaults.organizerName),
      organizerWebsite: str("organizer.website", defaults.organizerWebsite),
      facebook: str("contact.facebook", ""),
      linkedin: str("contact.linkedin", ""),
      twitter: str("contact.twitter", ""),
      youtube: str("contact.youtube", ""),
    }
  } catch {
    return defaults
  }
}

const SOCIAL_LABELS: Record<keyof Pick<ContactChannels, "facebook" | "linkedin" | "twitter" | "youtube">, string> = {
  facebook: "Facebook",
  linkedin: "LinkedIn",
  twitter: "X / Twitter",
  youtube: "YouTube",
}

export default async function ContactPage() {
  const channels = await getContactChannels()

  const socials = (["facebook", "linkedin", "twitter", "youtube"] as const)
    .map((key) => ({ key, label: SOCIAL_LABELS[key], href: channels[key] }))
    .filter((entry) => entry.href.length > 0)

  return (
    <>
      <PageHeader
        label="// Contact"
        title="Talk to the organizing team"
        description="Questions about registration, the competition modules, sponsorship, or media — send us a message and the team will get back to you."
        crumbs={[{ label: "Home", href: "/" }, { label: "Contact" }]}
      />

      <section className="section">
        <div className="section-inner">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-12">
            {/* ── Left: channels ─────────────────────────────────────── */}
            <Reveal>
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-bg-panel p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/5">
                      <Mail className="h-5 w-5 text-cyan" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-[0.6875rem] uppercase tracking-widest text-text-faint">
                        Email
                      </p>
                      <a
                        href={`mailto:${channels.email}`}
                        className="mt-1 block break-all text-sm font-medium text-text-primary transition-colors duration-150 hover:text-cyan"
                      >
                        {channels.email}
                      </a>
                      <p className="mt-1 text-xs leading-relaxed text-text-muted">
                        The fastest channel for registration and ticket issues.
                      </p>
                    </div>
                  </div>
                </div>

                {channels.phone.length > 0 && (
                  <div className="rounded-xl border border-border bg-bg-panel p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-neon/30 bg-neon/5">
                        <Phone className="h-5 w-5 text-neon" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-[0.6875rem] uppercase tracking-widest text-text-faint">
                          Phone
                        </p>
                        <a
                          href={`tel:${channels.phone.replace(/\s+/g, "")}`}
                          className="mt-1 block text-sm font-medium text-text-primary transition-colors duration-150 hover:text-neon"
                        >
                          {channels.phone}
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-border bg-bg-panel p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-violet/30 bg-violet/5">
                      <Building2 className="h-5 w-5 text-violet" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-[0.6875rem] uppercase tracking-widest text-text-faint">
                        Organizer
                      </p>
                      <p className="mt-1 text-sm font-medium text-text-primary">
                        {channels.organizerName}
                      </p>
                      <a
                        href={channels.organizerWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs text-cyan hover:underline"
                      >
                        University Website →
                      </a>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-bg-panel p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-pink/30 bg-pink/5">
                      <MapPin className="h-5 w-5 text-pink" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-[0.6875rem] uppercase tracking-widest text-text-faint">
                        On-site venue
                      </p>
                      <p className="mt-1 text-sm font-medium text-text-primary">
                        {VENUE.name}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">{VENUE.address}</p>
                      <Link href="/venue" className="mt-1 inline-block text-xs text-cyan hover:underline">
                        Venue details & directions →
                      </Link>
                    </div>
                  </div>
                </div>

                {socials.length > 0 ? (
                  <div className="rounded-xl border border-border bg-bg-panel p-5">
                    <p className="font-mono text-[0.6875rem] uppercase tracking-widest text-text-faint">
                      Follow the event
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {socials.map((social) => (
                        <a
                          key={social.key}
                          href={social.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary !px-3 !py-1.5 text-xs"
                        >
                          {social.label}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-bg-panel/50 p-5">
                    <p className="font-mono text-[0.6875rem] uppercase tracking-widest text-text-faint">
                      Social channels — to be announced
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">
                      Official social pages will be published here once confirmed.
                    </p>
                  </div>
                )}
              </div>
            </Reveal>

            {/* ── Right: form ────────────────────────────────────────── */}
            <Reveal delay={0.1}>
              <ContactForm />
            </Reveal>
          </div>

          {/* ── Nudges ───────────────────────────────────────────────── */}
          <Reveal delay={0.15}>
            <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex items-start gap-4 rounded-xl border border-border bg-bg-panel/60 p-5">
                <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber" aria-hidden="true" />
                <div>
                  <h2 className="font-display text-sm font-bold text-text-primary">
                    Quick answers
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-text-muted">
                    Many common questions are already answered on the FAQ page —
                    registration, eligibility, team rules, and attendance.
                  </p>
                  <Link href="/faq" className="mt-2 inline-block text-sm text-cyan hover:underline">
                    Browse the FAQ →
                  </Link>
                </div>
              </div>

              <div className="flex items-start gap-4 rounded-xl border border-border bg-bg-panel/60 p-5">
                <Send className="mt-0.5 h-5 w-5 shrink-0 text-neon" aria-hidden="true" />
                <div>
                  <h2 className="font-display text-sm font-bold text-text-primary">
                    Partnership inquiries
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-text-muted">
                    Reach out through the sponsor application form to start a
                    partnership conversation with the team.
                  </p>
                  <Link href="/sponsors" className="mt-2 inline-block text-sm text-cyan hover:underline">
                    Sponsorship details →
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
