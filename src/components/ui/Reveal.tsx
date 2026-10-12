"use client"

import { motion, useReducedMotion } from "framer-motion"
import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// Reveal — scroll-triggered entrance wrapper
// =============================================================================
// Wraps any content and fades/slides it into view on first intersection.
// Respects prefers-reduced-motion (renders static when motion is reduced).
//
// The motion wrapper is always a <div> — drop it inside a grid/flex cell so
// the wrapper becomes the cell itself (never wrap a grid with it).
// =============================================================================

export interface RevealProps {
  children: React.ReactNode
  /** Direction the content travels from */
  from?: "up" | "down" | "left" | "right" | "none"
  /** Delay in seconds before the animation starts */
  delay?: number
  /** Animation duration in seconds */
  duration?: number
  /** Extra distance (px) the content travels */
  distance?: number
  /** Run only once (default) or on every entry */
  once?: boolean
  /** How much of the element must be visible to trigger (0–1) */
  threshold?: number
  className?: string
}

const DIRECTION_VECTORS: Record<
  "up" | "down" | "left" | "right" | "none",
  { x: number; y: number }
> = {
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
  none: { x: 0, y: 0 },
}

function Reveal({
  children,
  from = "up",
  delay = 0,
  duration = 0.7,
  distance = 24,
  once = true,
  threshold = 0.15,
  className,
}: RevealProps) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  const dir = DIRECTION_VECTORS[from]

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, x: dir.x * distance, y: dir.y * distance }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount: threshold }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

export { Reveal }
