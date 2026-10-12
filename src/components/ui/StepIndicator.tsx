"use client"

import { motion } from "framer-motion"
import { Check } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// StepIndicator — registration wizard progress bar
// Supports horizontal (desktop) and vertical (mobile) orientations
// =============================================================================

export type StepStatus = "complete" | "current" | "upcoming" | "error"

export interface Step {
  id: string
  label: string
  description?: string
  status: StepStatus
  optional?: boolean
}

export interface StepIndicatorProps {
  steps: Step[]
  orientation?: "horizontal" | "vertical"
  variant?: "default" | "compact" | "minimal"
  className?: string
  /** Current step index (0-based) — used to calculate progress line fill */
  currentIndex: number
}

const statusConfig: Record<
  StepStatus,
  {
    circleClass: string
    labelClass: string
    icon: (index: number) => React.ReactNode
  }
> = {
  complete: {
    circleClass: "bg-cyan border-cyan shadow-glow-cyan-sm",
    labelClass:  "text-text-muted",
    icon:        () => <Check size={14} strokeWidth={3} className="text-bg-deep" />,
  },
  current: {
    circleClass: "bg-bg-panel border-cyan shadow-glow-cyan",
    labelClass:  "text-text-primary font-semibold",
    icon:        (i) => (
      <span className="font-mono text-xs font-bold text-cyan">{i + 1}</span>
    ),
  },
  upcoming: {
    circleClass: "bg-bg-elevated border-border",
    labelClass:  "text-text-faint",
    icon:        (i) => (
      <span className="font-mono text-xs text-text-faint">{i + 1}</span>
    ),
  },
  error: {
    circleClass: "bg-pink/10 border-pink shadow-glow-pink",
    labelClass:  "text-pink",
    icon:        () => (
      <span className="font-mono text-xs font-bold text-pink">!</span>
    ),
  },
}

function StepIndicator({
  steps,
  orientation = "horizontal",
  variant = "default",
  className,
  currentIndex,
}: StepIndicatorProps) {

  if (orientation === "vertical") {
    return (
      <VerticalStepIndicator
        steps={steps}
        currentIndex={currentIndex}
        variant={variant}
        className={className}
      />
    )
  }

  return (
    <HorizontalStepIndicator
      steps={steps}
      currentIndex={currentIndex}
      variant={variant}
      className={className}
    />
  )
}

// ─── Horizontal (desktop default) ────────────────────────────────────────────

function HorizontalStepIndicator({
  steps,
  currentIndex,
  variant,
  className,
}: {
  steps: Step[]
  currentIndex: number
  variant: "default" | "compact" | "minimal"
  className?: string
}) {
  const isCompact = variant === "compact" || variant === "minimal"

  return (
    <nav
      aria-label="Progress"
      className={cn("w-full", className)}
    >
      <ol className="flex items-start w-full">
        {steps.map((step, index) => {
          const config = statusConfig[step.status]
          const isLast = index === steps.length - 1
          const connectorFilled =
            index < currentIndex || step.status === "complete"

          return (
            <li
              key={step.id}
              className={cn(
                "flex items-start",
                isLast ? "flex-none" : "flex-1",
              )}
              aria-current={step.status === "current" ? "step" : undefined}
            >
              {/* Step + connector */}
              <div className="flex flex-col items-center w-full">
                {/* Circle row */}
                <div className="flex items-center w-full">
                  {/* Circle */}
                  <div className="flex flex-col items-center">
                    <motion.div
                      className={cn(
                        "flex items-center justify-center rounded-full border-2 shrink-0 transition-all duration-400",
                        "[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
                        isCompact ? "w-7 h-7" : "w-9 h-9",
                        config.circleClass,
                      )}
                      animate={
                        step.status === "current"
                          ? { scale: [1, 1.05, 1] }
                          : { scale: 1 }
                      }
                      transition={{ duration: 0.6, repeat: step.status === "current" ? Infinity : 0, repeatDelay: 2 }}
                    >
                      {config.icon(index)}
                    </motion.div>
                  </div>

                  {/* Connector line */}
                  {!isLast && (
                    <div className="flex-1 h-0.5 mx-2 bg-border rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-cyan rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: connectorFilled ? "100%" : "0%" }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                  )}
                </div>

                {/* Label */}
                {variant !== "minimal" && (
                  <div className="mt-2 text-center max-w-[80px]">
                    <p
                      className={cn(
                        "text-xs leading-tight transition-colors duration-250",
                        config.labelClass,
                      )}
                    >
                      {step.label}
                    </p>
                    {step.optional && (
                      <p className="text-[0.6rem] text-text-faint mt-0.5 font-mono">
                        Optional
                      </p>
                    )}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {/* Current step description */}
      {variant === "default" && (
        <div className="mt-4 text-center">
          <p className="font-mono text-xs text-text-muted uppercase tracking-widest">
            Step {currentIndex + 1} of {steps.length}
            {steps[currentIndex]?.description && (
              <> &mdash; {steps[currentIndex]?.description}</>
            )}
          </p>
        </div>
      )}
    </nav>
  )
}

// ─── Vertical (mobile / sidebar) ─────────────────────────────────────────────

function VerticalStepIndicator({
  steps,
  currentIndex,
  variant,
  className,
}: {
  steps: Step[]
  currentIndex: number
  variant: "default" | "compact" | "minimal"
  className?: string
}) {
  return (
    <nav aria-label="Progress" className={cn("w-full", className)}>
      <ol className="space-y-0">
        {steps.map((step, index) => {
          const config = statusConfig[step.status]
          const isLast = index === steps.length - 1
          const connectorFilled =
            index < currentIndex || step.status === "complete"

          return (
            <li
              key={step.id}
              className="relative flex gap-4"
              aria-current={step.status === "current" ? "step" : undefined}
            >
              {/* Left column: circle + connector */}
              <div className="flex flex-col items-center">
                <motion.div
                  className={cn(
                    "flex items-center justify-center rounded-full border-2 shrink-0 z-10",
                    "transition-all duration-400 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
                    "w-8 h-8",
                    config.circleClass,
                  )}
                >
                  {config.icon(index)}
                </motion.div>

                {/* Vertical connector */}
                {!isLast && (
                  <div className="w-0.5 flex-1 my-1 bg-border rounded-full overflow-hidden min-h-[2rem]">
                    <motion.div
                      className="w-full bg-cyan rounded-full"
                      initial={{ height: "0%" }}
                      animate={{ height: connectorFilled ? "100%" : "0%" }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                )}
              </div>

              {/* Right column: label + description */}
              <div className={cn("pb-6", isLast && "pb-0", "pt-1 min-w-0")}>
                <p
                  className={cn(
                    "text-sm leading-tight transition-colors duration-250",
                    config.labelClass,
                  )}
                >
                  {step.label}
                  {step.optional && (
                    <span className="ml-2 font-mono text-[0.625rem] text-text-faint uppercase tracking-wider">
                      Optional
                    </span>
                  )}
                </p>
                {variant === "default" && step.description && (
                  <p className="mt-0.5 text-xs text-text-faint leading-relaxed">
                    {step.description}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// ─── MiniStepBar — compact top progress bar (used in mobile wizard header) ───

export interface MiniStepBarProps {
  total: number
  current: number
  className?: string
}

function MiniStepBar({ total, current, className }: MiniStepBarProps) {
  return (
    <div
      className={cn("flex gap-1.5 w-full", className)}
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Step ${current} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          className={cn(
            "flex-1 h-1 rounded-full",
            i < current ? "bg-cyan" : "bg-border",
          )}
          animate={{
            opacity: i < current ? 1 : 0.4,
          }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
        />
      ))}
    </div>
  )
}

export { StepIndicator, MiniStepBar }
