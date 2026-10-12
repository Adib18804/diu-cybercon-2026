// =============================================================================
// Marquee — seamless horizontal scroll primitive
//   · Renders the children track twice; keyframe translates exactly -50%
//   · Optional edge fade mask + pause-on-hover
//   · Animated track is aria-hidden; provide `ariaLabel` for the static
//     screen-reader text alternative
// =============================================================================

import * as React from "react"

import { cn } from "@/lib/utils"

export interface MarqueeProps {
  children: React.ReactNode
  /** Animation speed — 40s loop (normal) or 20s loop (fast). */
  speed?: "normal" | "fast"
  /** Pause the loop while hovered. */
  pauseOnHover?: boolean
  /** Fade the left/right edges into the background. */
  fadeEdges?: boolean
  /** Static text announced to screen readers (animated track is hidden). */
  ariaLabel?: string
  className?: string
}

export function Marquee({
  children,
  speed = "normal",
  pauseOnHover = false,
  fadeEdges = false,
  ariaLabel,
  className,
}: MarqueeProps) {
  const track = (
    <div
      className={cn(
        "flex w-max items-center",
        speed === "fast" ? "animate-marquee-fast" : "animate-marquee",
        pauseOnHover && "group-hover:[animation-play-state:paused]",
      )}
    >
      {/* Two identical copies — keyframe travels exactly half the track */}
      <div className="flex shrink-0 items-center">{children}</div>
      <div className="flex shrink-0 items-center" aria-hidden="true">
        {children}
      </div>
    </div>
  )

  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden",
        fadeEdges &&
          "[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]",
        className,
      )}
    >
      <div aria-hidden={ariaLabel ? "true" : undefined}>{track}</div>
      {ariaLabel ? <span className="sr-only">{ariaLabel}</span> : null}
    </div>
  )
}
