"use client"

import { motion, useMotionValue, useSpring } from "framer-motion"
import { Loader2 } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// Button — all variants, sizes, loading state, magnetic hover
// =============================================================================

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "neon"
  | "violet"

export type ButtonSize = "sm" | "md" | "lg" | "icon"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  loadingText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  magnetic?: boolean
  fullWidth?: boolean
  asChild?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    "bg-cyan text-white border-cyan",
    "hover:bg-cyan/90 hover:shadow-glow-cyan",
    "active:scale-[0.97]",
    "focus-visible:ring-cyan",
    "disabled:bg-cyan/30 disabled:text-white/60 disabled:border-cyan/30",
  ].join(" "),

  secondary: [
    "bg-transparent text-cyan border-cyan/40",
    "hover:border-cyan hover:shadow-glow-cyan-sm hover:bg-cyan/5",
    "active:scale-[0.97]",
    "focus-visible:ring-cyan",
    "disabled:text-cyan/30 disabled:border-cyan/20",
  ].join(" "),

  ghost: [
    "bg-transparent text-text-muted border-transparent",
    "hover:text-text-primary hover:bg-bg-elevated hover:border-border",
    "active:scale-[0.97]",
    "focus-visible:ring-border",
    "disabled:text-text-faint",
  ].join(" "),

  danger: [
    "bg-transparent text-pink border-pink/40",
    "hover:border-pink hover:shadow-glow-pink hover:bg-pink/5",
    "active:scale-[0.97]",
    "focus-visible:ring-pink",
    "disabled:text-pink/30 disabled:border-pink/20",
  ].join(" "),

  neon: [
    "bg-neon text-white border-neon",
    "hover:bg-neon/90 hover:shadow-glow-neon",
    "active:scale-[0.97]",
    "focus-visible:ring-neon",
    "disabled:bg-neon/30 disabled:text-white/60 disabled:border-neon/30",
  ].join(" "),

  violet: [
    "bg-transparent text-violet border-violet/40",
    "hover:border-violet hover:shadow-glow-violet-sm hover:bg-violet/5",
    "active:scale-[0.97]",
    "focus-visible:ring-violet",
    "disabled:text-violet/30 disabled:border-violet/20",
  ].join(" "),
}

const sizeClasses: Record<ButtonSize, string> = {
  sm:   "h-8 px-3 text-[0.6875rem] gap-1.5 rounded-sm",
  md:   "h-11 px-5 text-[0.75rem] gap-2 rounded-md",
  lg:   "h-13 px-7 text-[0.8125rem] gap-2.5 rounded-md",
  icon: "h-11 w-11 p-0 rounded-md",
}

// ─── Magnetic Button wrapper ──────────────────────────────────────────────────

function MagneticWrapper({
  children,
  strength = 0.3,
}: {
  children: React.ReactNode
  strength?: number
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const springConfig = { stiffness: 200, damping: 20, mass: 0.5 }
  const springX = useSpring(x, springConfig)
  const springY = useSpring(y, springConfig)

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!ref.current) {return}
    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    x.set((e.clientX - centerX) * strength)
    y.set((e.clientY - centerY) * strength)
  }

  function onMouseLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      ref={ref}
      style={{ x: springX, y: springY }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="inline-flex"
    >
      {children}
    </motion.div>
  )
}

// ─── Button ──────────────────────────────────────────────────────────────────

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      magnetic = false,
      fullWidth = false,
      className,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading

    const button = (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading}
        className={cn(
          // Base
          "inline-flex items-center justify-center",
          "font-mono font-bold uppercase tracking-wider",
          "border transition-all duration-250",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
          "select-none cursor-pointer relative overflow-hidden",
          "[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
          // Variant
          variantClasses[variant],
          // Size
          sizeClasses[size],
          // Full width
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        {/* Loading spinner */}
        {loading && (
          <Loader2
            className="animate-spin shrink-0"
            size={size === "sm" ? 12 : size === "lg" ? 16 : 14}
            aria-hidden="true"
          />
        )}

        {/* Left icon (hidden when loading) */}
        {!loading && leftIcon && (
          <span className="shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}

        {/* Label */}
        {size !== "icon" && (
          <span className={cn("truncate", loading && loadingText && "sr-only")}>
            {children}
          </span>
        )}

        {/* Loading text */}
        {loading && loadingText && (
          <span className="truncate">{loadingText}</span>
        )}

        {/* Icon-only content */}
        {size === "icon" && !loading && children}

        {/* Right icon (hidden when loading) */}
        {!loading && rightIcon && size !== "icon" && (
          <span className="shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    )

    if (magnetic && !isDisabled) {
      return <MagneticWrapper>{button}</MagneticWrapper>
    }

    return button
  },
)

Button.displayName = "Button"

export { Button }
