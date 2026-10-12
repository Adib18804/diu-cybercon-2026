import { cn } from "@/lib/utils"

// =============================================================================
// EmptyState — honest "nothing published yet" panel (Part 22)
// Used wherever content is driven by the database and nothing is confirmed
// yet. Never fabricates placeholder content.
// =============================================================================

export interface EmptyStateProps {
  icon: React.ReactNode
  label?: string
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}

function EmptyState({
  icon,
  label = "To Be Announced",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-border bg-bg-panel/50 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/5 text-cyan">
        {icon}
      </div>
      <p className="section-label mt-5 mb-0 justify-center">{label}</p>
      <h3 className="mt-2 font-display text-xl font-bold text-text-primary text-balance">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-text-muted">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export { EmptyState }
