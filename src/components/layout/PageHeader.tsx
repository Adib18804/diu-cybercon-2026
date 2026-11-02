import { Breadcrumb } from "@/components/ui"
import { Reveal } from "@/components/ui/Reveal"

// =============================================================================
// PageHeader — interior page hero (server component)
// Consistent label + title + description + actions + breadcrumb for all
// content pages. Renders inside the global navbar/main/footer shell.
// =============================================================================

export interface PageHeaderProps {
  label: string
  title: string
  description?: string
  crumbs?: { label: string; href?: string }[]
  actions?: React.ReactNode
  children?: React.ReactNode
}

function PageHeader({
  label,
  title,
  description,
  crumbs,
  actions,
  children,
}: PageHeaderProps) {
  return (
    <header className="relative overflow-hidden border-b border-border/60">
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -top-24 left-1/4 h-[320px] w-[640px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(225, 29, 72,0.35), rgba(190, 18, 60,0.15), transparent)",
        }}
        aria-hidden="true"
      />

      <div className="section-inner relative z-content py-12 md:py-16">
        {crumbs && crumbs.length > 0 && (
          <Breadcrumb
            items={crumbs}
            className="mb-6 font-mono text-[0.6875rem] uppercase tracking-wider text-text-faint"
          />
        )}

        <Reveal>
          <p className="section-label">{label}</p>
          <h1 className="mt-3 max-w-3xl font-display text-section-h2 font-bold tracking-tight text-text-primary text-balance">
            {title}
          </h1>
          {description && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-muted">
              {description}
            </p>
          )}
          {actions && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">{actions}</div>
          )}
          {children}
        </Reveal>
      </div>
    </header>
  )
}

export { PageHeader }
