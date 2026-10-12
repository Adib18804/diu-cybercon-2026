"use client"

import { motion } from "framer-motion"
import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// Spinner — 3 sizes, 3 color variants
// Skeleton — shimmer loading placeholder
// ProgressBar — animated fill with label
// =============================================================================

// ─── Spinner ─────────────────────────────────────────────────────────────────

export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl"
export type SpinnerVariant = "cyan" | "neon" | "violet" | "muted"

const spinnerSizeClasses: Record<SpinnerSize, string> = {
  xs: "w-3 h-3 border",
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-2",
  xl: "w-12 h-12 border-[3px]",
}

const spinnerColorClasses: Record<SpinnerVariant, string> = {
  cyan:   "border-cyan/20 border-t-cyan",
  neon:   "border-neon/20 border-t-neon",
  violet: "border-violet/20 border-t-violet",
  muted:  "border-border border-t-text-muted",
}

export interface SpinnerProps {
  size?: SpinnerSize
  variant?: SpinnerVariant
  className?: string
  label?: string
}

function Spinner({
  size = "md",
  variant = "cyan",
  className,
  label = "Loading…",
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <span
        className={cn(
          "block rounded-full animate-spin shrink-0",
          spinnerSizeClasses[size],
          spinnerColorClasses[variant],
        )}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}

// ─── Full-page loading overlay ────────────────────────────────────────────────

function LoadingOverlay({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="fixed inset-0 z-modal flex flex-col items-center justify-center gap-4 bg-bg-deep/90 backdrop-blur-sm"
      role="status"
      aria-label={label}
    >
      <Spinner size="xl" variant="cyan" />
      <p className="font-mono text-xs text-text-muted uppercase tracking-widest animate-pulse">
        {label}
      </p>
    </div>
  )
}

// ─── Inline loading state ─────────────────────────────────────────────────────

function LoadingDots({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      role="status"
      aria-label="Loading"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-1.5 h-1.5 rounded-full bg-cyan"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut",
          }}
          aria-hidden="true"
        />
      ))}
      <span className="sr-only">Loading</span>
    </span>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number
  height?: string | number
  rounded?: "none" | "sm" | "md" | "lg" | "full"
  lines?: number
  animate?: boolean
}

const roundedClasses = {
  none: "rounded-none",
  sm:   "rounded-sm",
  md:   "rounded-md",
  lg:   "rounded-lg",
  full: "rounded-full",
}

function Skeleton({
  width,
  height,
  rounded = "md",
  lines,
  animate = true,
  className,
  style,
  ...props
}: SkeletonProps) {
  // Multi-line skeleton (for text blocks)
  if (lines && lines > 1) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine
            key={i}
            width={i === lines - 1 ? "75%" : "100%"}
            animate={animate}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "bg-bg-elevated relative overflow-hidden",
        roundedClasses[rounded],
        animate && "after:absolute after:inset-0 after:bg-shimmer-gradient after:bg-[length:200%_auto] after:animate-shimmer",
        className,
      )}
      style={{ width, height, ...style }}
      aria-hidden="true"
      {...props}
    />
  )
}

function SkeletonLine({
  width = "100%",
  animate = true,
}: {
  width?: string | number
  animate?: boolean
}) {
  return (
    <Skeleton
      width={width}
      height="1rem"
      rounded="sm"
      animate={animate}
    />
  )
}

// Preset skeleton compositions for common UI patterns

function SkeletonCard() {
  return (
    <div className="bg-bg-panel border border-border rounded-lg p-6 space-y-4" aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton width={48} height={48} rounded="lg" />
        <div className="flex-1 space-y-2">
          <Skeleton height="1rem" width="60%" />
          <Skeleton height="0.75rem" width="40%" />
        </div>
      </div>
      <Skeleton lines={3} />
      <div className="flex gap-2 pt-2">
        <Skeleton height="2rem" width={80} rounded="full" />
        <Skeleton height="2rem" width={60} rounded="full" />
      </div>
    </div>
  )
}

function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 border-b border-border">
        {[30, 20, 20, 15, 15].map((w, i) => (
          <Skeleton key={i} height="0.75rem" width={`${w}%`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3">
          {[30, 20, 20, 15, 15].map((w, j) => (
            <Skeleton key={j} height="0.875rem" width={`${w}%`} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────

export type ProgressVariant = "cyan" | "neon" | "violet" | "pink" | "amber"

export interface ProgressBarProps {
  value: number
  max?: number
  variant?: ProgressVariant
  size?: "sm" | "md" | "lg"
  label?: string
  showValue?: boolean
  animated?: boolean
  striped?: boolean
  className?: string
}

const progressColorClasses: Record<ProgressVariant, string> = {
  cyan:   "bg-cyan shadow-glow-cyan-sm",
  neon:   "bg-neon shadow-glow-neon-sm",
  violet: "bg-violet shadow-glow-violet-sm",
  pink:   "bg-pink",
  amber:  "bg-amber",
}

const progressSizeClasses = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
}

function ProgressBar({
  value,
  max = 100,
  variant = "cyan",
  size = "md",
  label,
  showValue = false,
  animated = true,
  striped = false,
  className,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {(label ?? showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="font-mono text-xs text-text-muted uppercase tracking-wider">
              {label}
            </span>
          )}
          {showValue && (
            <span className="font-mono text-xs text-text-muted tabular-nums">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}

      <div
        className={cn(
          "w-full rounded-full bg-bg-elevated overflow-hidden",
          progressSizeClasses[size],
        )}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? "Progress"}
      >
        <motion.div
          className={cn(
            "h-full rounded-full",
            progressColorClasses[variant],
            striped && [
              "bg-stripes",
              "bg-[length:1rem_1rem]",
              animated && "animate-[progress-stripes_1s_linear_infinite]",
            ],
          )}
          initial={animated ? { width: 0 } : { width: `${percentage}%` }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  )
}

// ─── Seat availability bar ────────────────────────────────────────────────────
// Specialized ProgressBar for workshop seat counters

function SeatProgressBar({
  total,
  remaining,
  className,
}: {
  total: number
  remaining: number
  className?: string
}) {
  const filled = total - remaining
  const percentage = (filled / total) * 100
  const variant: ProgressVariant =
    percentage >= 90 ? "pink" : percentage >= 70 ? "amber" : "cyan"

  return (
    <ProgressBar
      value={filled}
      max={total}
      variant={variant}
      size="sm"
      showValue={false}
      animated
      className={className}
    />
  )
}

export {
  Spinner,
  LoadingOverlay,
  LoadingDots,
  Skeleton,
  SkeletonLine,
  SkeletonCard,
  SkeletonTable,
  ProgressBar,
  SeatProgressBar,
}
