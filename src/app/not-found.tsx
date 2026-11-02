import { Home, Search } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { BackButton } from "@/components/layout"

// =============================================================================
// 404 Not Found Page
// =============================================================================

export const metadata: Metadata = {
  title: "404 — Page Not Found",
  description: "The page you are looking for does not exist.",
  robots: { index: false, follow: false },
}

const QUICK_LINKS = [
  { href: "/events/ctf", label: "CTF" },
  { href: "/events/innovation-symposium", label: "Innovation Symposium" },
  { href: "/events/workshops", label: "Workshops" },
  { href: "/schedule", label: "Schedule" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/register", label: "Register" },
] as const

export default function NotFound() {
  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-16">
      {/* Background grid */}
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" />

      {/* Violet glow */}
      <div className="pointer-events-none absolute right-1/4 top-1/3 h-96 w-96 rounded-full bg-violet/5 blur-[80px]" />
      {/* Cyan glow */}
      <div className="pointer-events-none absolute bottom-1/3 left-1/4 h-64 w-64 rounded-full bg-cyan/5 blur-[80px]" />

      <div className="relative z-content w-full max-w-2xl text-center">
        {/* Large 404 */}
        <div className="relative mb-8 select-none">
          <p
            className="pointer-events-none font-display font-extrabold leading-none tracking-[-0.04em] text-text-faint/20 text-[clamp(8rem,20vw,16rem)]"
            aria-hidden="true"
          >
            404
          </p>
          {/* Overlay text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-lg border border-border bg-bg-deep px-6 py-2">
              <p className="font-mono text-xs uppercase tracking-widest text-cyan">
                Signal Lost
              </p>
            </div>
          </div>
        </div>

        {/* Heading */}
        <h1 className="mb-4 font-display text-section-h2 font-bold tracking-tight text-text-primary">
          Page Not Found
        </h1>

        {/* Description */}
        <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-text-muted">
          The route you requested doesn&apos;t exist or has been moved. Check
          the URL or navigate back to safety.
        </p>

        {/* Terminal snippet */}
        <div className="mx-auto mb-10 max-w-sm rounded-md border border-border bg-bg-panel p-4 text-left font-mono text-xs">
          <div className="mb-3 flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-pink/60" />
            <span className="h-3 w-3 rounded-full bg-amber/60" />
            <span className="h-3 w-3 rounded-full bg-neon/60" />
          </div>
          <span className="text-cyan">$</span>{" "}
          <span className="text-text-muted">traceroute diucybercon.com/???</span>
          <br />
          <span className="text-pink">✗</span>{" "}
          <span className="text-text-faint">Destination unreachable</span>
          <br />
          <span className="text-amber">!</span>{" "}
          <span className="text-text-faint">No route to host</span>
          <br />
          <span className="text-neon">→</span>{" "}
          <span className="text-text-muted">Rerouting to known nodes...</span>
          <span className="animate-cursor-blink" />
        </div>

        {/* Actions */}
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="btn-primary flex items-center justify-center gap-2">
            <Home className="h-4 w-4" />
            Return Home
          </Link>

          <Link href="/events" className="btn-secondary flex items-center justify-center gap-2">
            <Search className="h-4 w-4" />
            View Events
          </Link>

          <BackButton className="btn-ghost justify-center" />
        </div>

        {/* Quick links */}
        <div className="mt-12 border-t border-border pt-8">
          <p className="mb-4 font-mono text-xs uppercase tracking-widest text-text-faint">
            Known Routes
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-border px-3 py-1 font-mono text-xs text-text-muted transition-all duration-250 hover:border-cyan/40 hover:bg-cyan/5 hover:text-cyan"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
