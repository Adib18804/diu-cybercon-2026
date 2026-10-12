import { Construction } from "lucide-react"
import Link from "next/link"

// =============================================================================
// ComingSoon — placeholder for routes delivered in later build phases.
// Honest placeholder: never fabricates content (Part 22).
// =============================================================================

interface ComingSoonProps {
  title: string
  description: string
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <section className="section">
      <div className="section-inner">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          {/* Icon */}
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/5 shadow-glow-cyan-sm">
            <Construction className="h-7 w-7 text-cyan" aria-hidden="true" />
          </div>

          {/* Label */}
          <p className="section-label justify-center">In Development</p>

          {/* Title */}
          <h1 className="mt-3 font-display text-section-h2 font-bold tracking-tight text-text-primary text-balance">
            {title}
          </h1>

          {/* Description */}
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-text-muted">
            {description}
          </p>

          {/* Actions */}
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href="/" className="btn-secondary justify-center">
              Back to Home
            </Link>
            <Link href="/events" className="btn-primary justify-center">
              Explore Events
            </Link>
            <Link href="/contact" className="btn-ghost justify-center">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
