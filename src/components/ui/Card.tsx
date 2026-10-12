"use client"

import { motion } from "framer-motion"
import type { Route } from "next"
import Link from "next/link"
import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// Card — glass morphism, hover lift, gradient border, flat variants
// =============================================================================

export type CardVariant = "default" | "glass" | "gradient-border" | "flat" | "elevated"
export type CardAccent = "cyan" | "neon" | "violet" | "pink" | "amber" | "none"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  accent?: CardAccent
  hover?: boolean
  /** Animate in on mount (fade-up) */
  animate?: boolean
  /** Delay for staggered animations (seconds) */
  animateDelay?: number
  padding?: "none" | "sm" | "md" | "lg"
  as?: "div" | "article" | "section" | "li"
}

const accentBorderMap: Record<CardAccent, string> = {
  cyan:   "border-cyan/30 hover:border-cyan/60 hover:shadow-glow-cyan-sm",
  neon:   "border-neon/30 hover:border-neon/60 hover:shadow-glow-neon-sm",
  violet: "border-violet/30 hover:border-violet/60 hover:shadow-glow-violet-sm",
  pink:   "border-pink/30 hover:border-pink/50",
  amber:  "border-amber/30 hover:border-amber/50",
  none:   "border-border",
}

const paddingMap = {
  none: "",
  sm:   "p-4",
  md:   "p-6",
  lg:   "p-8",
}

const variantBase: Record<CardVariant, string> = {
  default:         "bg-bg-panel border border-border rounded-lg",
  glass:           "glass rounded-lg",
  "gradient-border": "gradient-border rounded-lg",
  flat:            "bg-bg-elevated rounded-lg border border-border-subtle",
  elevated:        "bg-bg-panel rounded-lg border border-border shadow-lg",
}

// ─── Motion prop conflicts ────────────────────────────────────────────────────
// Framer Motion re-declares these DOM handlers with different signatures.
// Strip them at runtime and exclude them at the type level before spreading
// into a motion component.
const MOTION_CONFLICTING_PROPS = [
  "onDrag",
  "onDragStart",
  "onDragEnd",
  "onDragEnter",
  "onDragLeave",
  "onDragOver",
  "onDragExit",
  "onDrop",
  "onAnimationStart",
  "onAnimationEnd",
  "onAnimationIteration",
  "onTransitionEnd",
] as const

type MotionConflictingProp = (typeof MOTION_CONFLICTING_PROPS)[number]

function stripMotionConflictingProps(
  props: React.HTMLAttributes<HTMLDivElement>,
): Omit<React.HTMLAttributes<HTMLDivElement>, MotionConflictingProp> {
  const clone: Record<string, unknown> = { ...props }
  for (const key of MOTION_CONFLICTING_PROPS) {delete clone[key]}
  return clone
}

function Card({
  variant = "default",
  accent = "none",
  hover = false,
  animate = false,
  animateDelay = 0,
  padding = "md",
  as: Tag = "div",
  className,
  children,
  ...props
}: CardProps) {
  const hoverClasses = hover
    ? cn(
        "cursor-pointer transition-all duration-400 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
        "hover:-translate-y-1 hover:shadow-card-hover",
        accent !== "none" && accentBorderMap[accent],
      )
    : ""

  const accentClasses =
    !hover && accent !== "none" ? accentBorderMap[accent] : ""

  const baseClasses = cn(
    variantBase[variant],
    paddingMap[padding],
    hoverClasses,
    accentClasses,
    className,
  )

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{
          duration: 0.7,
          delay: animateDelay,
          ease: [0.16, 1, 0.3, 1],
        }}
        className={baseClasses}
        {...stripMotionConflictingProps(props)}
      >
        {children}
      </motion.div>
    )
  }

  const Component = Tag as React.ElementType
  return (
    <Component className={baseClasses} {...props}>
      {children}
    </Component>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 pb-4 border-b border-border", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function CardTitle({
  className,
  children,
  as: Tag = "h3",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" }) {
  return (
    <Tag
      className={cn(
        "font-display font-bold text-card-title text-text-primary tracking-tight",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}

function CardDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-text-muted leading-relaxed", className)}
      {...props}
    >
      {children}
    </p>
  )
}

function CardContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("pt-4", className)} {...props}>
      {children}
    </div>
  )
}

function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center pt-4 mt-4 border-t border-border",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ─── Bento card variant ───────────────────────────────────────────────────────
// Used in the 6-module bento grid on homepage

export interface BentoCardProps {
  title: string
  description: string
  icon: React.ReactNode
  accent?: CardAccent
  badge?: string
  meta?: string
  href?: string
  children?: React.ReactNode
  className?: string
  animateDelay?: number
  isNew?: boolean
}

function BentoCard({
  title,
  description,
  icon,
  accent = "cyan",
  badge,
  meta,
  href,
  children,
  className,
  animateDelay = 0,
  isNew = false,
}: BentoCardProps) {
  const accentColorMap: Record<CardAccent, string> = {
    cyan:   "text-cyan",
    neon:   "text-neon",
    violet: "text-violet",
    pink:   "text-pink",
    amber:  "text-amber",
    none:   "text-text-muted",
  }

  const accentGlowMap: Record<CardAccent, string> = {
    cyan:   "group-hover:shadow-glow-cyan",
    neon:   "group-hover:shadow-glow-neon",
    violet: "group-hover:shadow-glow-violet",
    pink:   "group-hover:shadow-glow-pink",
    amber:  "",
    none:   "",
  }

  const isLink = Boolean(href)

  const cardInner = (
    <>
        {/* New badge */}
        {isNew && (
          <span className="absolute top-4 right-4 badge-pink text-[0.6rem] px-2 py-0.5 animate-pulse">
            NEW
          </span>
        )}

        {/* Icon */}
        <div
          className={cn(
            "mb-4 w-12 h-12 rounded-xl flex items-center justify-center",
            "border border-current/20 bg-current/5",
            "transition-all duration-400",
            accentGlowMap[accent],
          )}
          aria-hidden="true"
        >
          <span className={cn("w-6 h-6", accentColorMap[accent])}>
            {icon}
          </span>
        </div>

        {/* Badge */}
        {badge && (
          <p className="font-mono text-micro uppercase tracking-widest mb-2 text-current/60">
            {badge}
          </p>
        )}

        {/* Title */}
        <h3 className="font-display font-bold text-base text-text-primary mb-2 tracking-tight">
          {title}
        </h3>

        {/* Description */}
        <p className="text-sm text-text-muted leading-relaxed flex-1">
          {description}
        </p>

        {/* Meta */}
        {meta && (
          <p className="mt-3 font-mono text-[0.6875rem] text-current/60 uppercase tracking-wider">
            {meta}
          </p>
        )}

        {children}
    </>
  )

  const cardClassName = cn(
    "group relative flex flex-col h-full",
    "bg-bg-panel border border-border rounded-xl p-6",
    "transition-all duration-400 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
    "hover:-translate-y-1 hover:border-current hover:shadow-card-hover",
    accentColorMap[accent],
    className,
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.7, delay: animateDelay, ease: [0.16, 1, 0.3, 1] }}
      className={isLink ? "h-full" : undefined}
    >
      {isLink ? (
        <Link href={href as Route} className={cardClassName}>
          {cardInner}
        </Link>
      ) : (
        <div className={cardClassName}>{cardInner}</div>
      )}
    </motion.div>
  )
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  BentoCard,
}
