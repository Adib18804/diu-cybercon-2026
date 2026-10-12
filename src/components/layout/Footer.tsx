import { Mail, MapPin } from "lucide-react"
import Link from "next/link"

import { accentDotClass } from "./accent-classes"

import {
  APP_EMAIL,
  APP_NAME,
  APP_TAGLINE,
  APP_YEAR,
  NAV_EVENT_LINKS,
  NAV_LINKS,
  ORGANIZER,
  SPONSOR_TIERS,
  VENUE,
} from "@/lib/constants"
import { cn } from "@/lib/utils"


// =============================================================================
// Footer — server component
//   · sponsorship CTA band
//   · brand + events + explore + contact columns
//   · copyright bar
// No fabricated content — only verified facts from constants (Part 22).
// =============================================================================

const EXPLORE_LINKS = NAV_LINKS.filter((link) => link.href !== "/events")

const COMPANY_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Announcements", href: "/announcements" },
  { label: "Partners", href: "/partners" },
  { label: "Contact", href: "/contact" },
] as const

const BRAND_TEXT = APP_NAME.replace(/\s*\d{4}\s*$/, "")
const BRAND_YEAR = String(APP_NAME.match(/\d{4}/)?.[0] ?? "")

export function Footer() {
  return (
    <footer className="relative z-content border-t border-border bg-bg-surface/60">
      <div className="container py-12 lg:py-16">
        {/* Sponsorship CTA */}
        <div className="mb-12 flex flex-col items-start gap-4 rounded-lg border border-amber/25 bg-amber/5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-amber">
              Sponsorship Opportunities
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Partner with Bangladesh&apos;s national cybersecurity platform —
              packages from {SPONSOR_TIERS.GOLD.priceDisplay}.
            </p>
          </div>
          <Link href="/sponsors" className="btn-secondary shrink-0 justify-center">
            Become a Sponsor
          </Link>
        </div>

        {/* Columns */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.3fr]">
          {/* Brand */}
          <div>
            <Link
              href="/"
              className="flex items-center gap-2.5"
              aria-label={`${APP_NAME} — Home`}
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-md border border-cyan/40 bg-cyan/5 font-mono text-sm font-bold text-cyan"
                aria-hidden="true"
              >
                &gt;_
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-display text-sm font-bold uppercase tracking-tight text-text-primary">
                  {BRAND_TEXT}
                </span>
                <span className="mt-0.5 font-mono text-[0.55rem] font-semibold tracking-[0.3em] text-cyan">
                  {BRAND_YEAR}
                </span>
              </span>
            </Link>

            <p className="mt-4 font-mono text-xs uppercase tracking-widest text-cyan">
              {APP_TAGLINE}
            </p>

            <p className="mt-3 max-w-xs text-sm leading-relaxed text-text-muted">
              Bangladesh&apos;s flagship national cybersecurity conference,
              competition, and talent platform.
            </p>

            <p className="mt-4 text-xs leading-relaxed text-text-faint">
              Organized by {ORGANIZER.name},
              <br />
              {ORGANIZER.university}.
            </p>
          </div>

          {/* Events */}
          <div>
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-text-faint">
              Events
            </p>
            <ul className="flex flex-col gap-2.5">
              {NAV_EVENT_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group flex items-center gap-2.5 text-sm text-text-muted transition-colors duration-150 hover:text-text-primary"
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full opacity-70 transition-opacity duration-150 group-hover:opacity-100",
                        accentDotClass(item.accent),
                      )}
                      aria-hidden="true"
                    />
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/events"
                  className="text-sm font-medium text-cyan transition-colors duration-150 hover:text-cyan-400"
                >
                  All Events →
                </Link>
              </li>
            </ul>
          </div>

          {/* Explore */}
          <div>
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-text-faint">
              Explore
            </p>
            <ul className="flex flex-col gap-2.5">
              {EXPLORE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-muted transition-colors duration-150 hover:text-text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              {COMPANY_LINKS.slice(0, 2).map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-muted transition-colors duration-150 hover:text-text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-text-faint">
              Contact
            </p>
            <ul className="flex flex-col gap-3">
              <li>
                <a
                  href={`mailto:${APP_EMAIL}`}
                  className="flex items-center gap-2.5 text-sm text-text-muted transition-colors duration-150 hover:text-cyan"
                >
                  <Mail className="h-4 w-4 shrink-0 text-text-faint" aria-hidden="true" />
                  {APP_EMAIL}
                </a>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-text-muted">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-faint" aria-hidden="true" />
                <span>
                  {VENUE.name}
                  <br />
                  <span className="text-text-faint">{VENUE.address}</span>
                </span>
              </li>
            </ul>

            <div className="mt-5 flex flex-col gap-2">
              <Link
                href="/contact"
                className="text-sm text-text-muted transition-colors duration-150 hover:text-text-primary"
              >
                Contact Us →
              </Link>
              <Link
                href="/partners"
                className="text-sm text-text-muted transition-colors duration-150 hover:text-text-primary"
              >
                Our Partners →
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-center text-xs text-text-faint sm:text-left">
            © {APP_YEAR} {ORGANIZER.name}, {ORGANIZER.university}. All rights
            reserved.
          </p>
          <p className="font-mono text-xs uppercase tracking-widest text-text-faint">
            {APP_TAGLINE}
          </p>
        </div>
      </div>
    </footer>
  )
}
