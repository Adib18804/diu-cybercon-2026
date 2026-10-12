import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// SectionHeading — consistent section label / title / description block
// =============================================================================
// Server component (no hooks). Pair with <Reveal> when scroll animation is
// wanted — sections own their reveal behaviour.
// =============================================================================

export interface SectionHeadingProps {
  /** Small mono label rendered above the title (e.g. "// Event Modules") */
  label?: string
  /** Section title — plain string or rich node */
  title: React.ReactNode
  /** Supporting paragraph under the title */
  description?: React.ReactNode
  /** Text alignment */
  align?: "left" | "center"
  /** Title size preset */
  size?: "sm" | "md" | "lg"
  /** Optional element rendered to the right of the heading (desktop) */
  action?: React.ReactNode
  className?: string
}

const titleSizeClasses = {
  sm: "text-2xl md:text-3xl",
  md: "text-3xl md:text-4xl lg:text-5xl",
  lg: "text-4xl md:text-5xl lg:text-6xl",
}

function SectionHeading({
  label,
  title,
  description,
  align = "left",
  size = "md",
  action,
  className,
}: SectionHeadingProps) {
  const centered = align === "center"

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        action && !centered && "md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className={cn("flex flex-col gap-3", centered && "items-center text-center")}>
        {label && (
          <span
            className={cn(
              "section-label font-mono text-xs uppercase tracking-widest text-cyan",
              centered && "justify-center",
            )}
          >
            {label}
          </span>
        )}

        <h2
          className={cn(
            "font-display font-bold tracking-tight text-text-primary text-balance",
            titleSizeClasses[size],
          )}
        >
          {title}
        </h2>

        {description && (
          <p
            className={cn(
              "max-w-2xl text-text-muted leading-relaxed",
              centered && "mx-auto",
            )}
          >
            {description}
          </p>
        )}
      </div>

      {action && <div className={cn("shrink-0", centered && "self-center")}>{action}</div>}
    </div>
  )
}

export { SectionHeading }
