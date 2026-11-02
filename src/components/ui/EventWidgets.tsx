"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Users } from "lucide-react"
import * as React from "react"

import { cn , getTimeRemaining, formatNumber } from "@/lib/utils"

// =============================================================================
// SeatCounter — remaining seats with urgency states + progress
// CountdownTimer — DD HH MM SS flip animation
// StatCard — animated count-up with label
// TerminalWindow — styled terminal frame for code/mono content
// =============================================================================

// ─── SeatCounter ─────────────────────────────────────────────────────────────

export interface SeatCounterProps {
  total: number
  remaining: number
  showBar?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

function SeatCounter({
  total,
  remaining,
  showBar = true,
  size = "md",
  className,
}: SeatCounterProps) {
  const filled = total - remaining
  const percentage = (filled / total) * 100

  const urgency =
    remaining === 0
      ? "full"
      : remaining <= Math.ceil(total * 0.1)
        ? "critical"
        : remaining <= Math.ceil(total * 0.3)
          ? "low"
          : "available"

  const urgencyConfig = {
    full:      { text: "Full",      color: "text-pink",   barColor: "bg-pink",  bg: "bg-pink/10 border-pink/30" },
    critical:  { text: `${remaining} left!`, color: "text-pink", barColor: "bg-pink", bg: "bg-pink/5 border-pink/20" },
    low:       { text: `${remaining} left`,  color: "text-amber", barColor: "bg-amber", bg: "bg-amber/5 border-amber/20" },
    available: { text: `${remaining} seats`, color: "text-neon", barColor: "bg-cyan",  bg: "bg-bg-panel border-border" },
  }

  const config = urgencyConfig[urgency]

  const sizeClasses = {
    sm: "px-3 py-2 text-xs",
    md: "px-4 py-3 text-sm",
    lg: "px-5 py-4 text-base",
  }

  return (
    <div
      className={cn(
        "rounded-lg border",
        config.bg,
        sizeClasses[size],
        className,
      )}
      aria-label={`${remaining} of ${total} seats remaining`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-1.5">
          <Users
            size={size === "sm" ? 12 : 14}
            className="text-text-muted"
            aria-hidden="true"
          />
          <span className="font-mono text-text-muted uppercase tracking-wider" style={{ fontSize: "0.65rem" }}>
            Seats
          </span>
        </div>
        <span className={cn("font-mono font-bold", config.color)}>
          {urgency === "full" ? config.text : config.text}
        </span>
      </div>

      {showBar && (
        <div className="w-full h-1 rounded-full bg-bg-elevated overflow-hidden">
          <motion.div
            className={cn("h-full rounded-full", config.barColor)}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentage, 100)}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      )}

      {size !== "sm" && (
        <p className="mt-1.5 text-xs text-text-faint font-mono">
          {filled} / {total} registered
        </p>
      )}
    </div>
  )
}

// ─── CountdownTimer ───────────────────────────────────────────────────────────

export interface CountdownTimerProps {
  target: Date | string
  onExpire?: () => void
  size?: "sm" | "md" | "lg" | "hero"
  showLabels?: boolean
  className?: string
}

interface TimeUnit {
  value: number
  prev: number
}

function CountdownTimer({
  target,
  onExpire,
  size = "md",
  showLabels = true,
  className,
}: CountdownTimerProps) {
  const timerRef = React.useRef<HTMLDivElement>(null)
  // Initialize to null — server renders nothing, client renders the same null
  // on first paint. The useEffect tick() fires immediately after mount and
  // populates both states, eliminating the server/client time-value mismatch
  // that causes "Expected server HTML to contain a matching <span> in <div>".
  const [time, setTime] = React.useState<ReturnType<typeof getTimeRemaining> | null>(null)
  const [units, setUnits] = React.useState<{
    days: TimeUnit
    hours: TimeUnit
    minutes: TimeUnit
    seconds: TimeUnit
  }>({
    days:    { value: 0, prev: 0 },
    hours:   { value: 0, prev: 0 },
    minutes: { value: 0, prev: 0 },
    seconds: { value: 0, prev: 0 },
  })

  React.useEffect(() => {
    const tick = () => {
      const remaining = getTimeRemaining(target)
      setTime(remaining)
      setUnits((prev) => ({
        days:    { value: remaining.days,    prev: prev.days.value },
        hours:   { value: remaining.hours,   prev: prev.hours.value },
        minutes: { value: remaining.minutes, prev: prev.minutes.value },
        seconds: { value: remaining.seconds, prev: prev.seconds.value },
      }))
      // The aria-label changes every second, so it must never be a
      // React-rendered attribute: the server renders it a moment before the
      // client hydrates, the seconds tick over, and React flags a hydration
      // mismatch for a value that is *supposed* to change. Updating the DOM
      // node imperatively keeps assistive tech informed while leaving React's
      // markup identical on both sides (nothing to diff).
      timerRef.current?.setAttribute(
        "aria-label",
        `${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes, ${remaining.seconds} seconds remaining`,
      )
      if (remaining.isPast) {onExpire?.()}
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [target, onExpire])

  if (time === null) {
    // Pre-mount: render an invisible placeholder with the same outer shape so
    // the page layout doesn't shift when the timer appears after hydration.
    return (
      <div className={cn("flex items-center", className)} aria-hidden="true" />
    )
  }

  if (time.isPast) {
    return (
      <div className={cn("font-mono text-text-muted text-sm", className)}>
        Event has started
      </div>
    )
  }

  const digitSizeClasses = {
    sm:   { digit: "text-2xl w-12 h-12", label: "text-[0.55rem]", gap: "gap-2" },
    md:   { digit: "text-3xl w-16 h-16", label: "text-[0.6rem]",  gap: "gap-3" },
    lg:   { digit: "text-4xl w-20 h-20", label: "text-xs",        gap: "gap-4" },
    hero: { digit: "text-5xl md:text-6xl w-24 h-24 md:w-28 md:h-28", label: "text-xs", gap: "gap-4 md:gap-6" },
  }

  const s = digitSizeClasses[size]

  const segments = [
    { unit: units.days,    label: "DAYS" },
    { unit: units.hours,   label: "HRS" },
    { unit: units.minutes, label: "MIN" },
    { unit: units.seconds, label: "SEC" },
  ]

  return (
    <div
      ref={timerRef}
      className={cn("flex items-center", s.gap, className)}
      role="timer"
      aria-live="off"
      // The seconds tick every second while the page hydrates. Whatever the
      // diff lands on (attribute or text race), a clock is the textbook case
      // React documents suppressHydrationWarning for. The aria-label is set
      // imperatively (see effect above) so the digits and label stay correct
      // the moment the browser paints.
      suppressHydrationWarning
    >
      {segments.map(({ unit, label }, segIdx) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center gap-1.5">
            {/* Digit box */}
            <div
              className={cn(
                "relative flex items-center justify-center",
                "bg-bg-panel border border-border rounded-lg",
                "font-display font-extrabold text-text-primary",
                "overflow-hidden",
                s.digit,
              )}
            >
              {/* Top/bottom split line */}
              <div className="absolute inset-x-0 top-1/2 h-px bg-border z-10" aria-hidden="true" />

              {/* Animated digit */}
              <AnimatePresence mode="wait">
                <motion.span
                  key={unit.value}
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="relative z-20 tabular-nums"
                  aria-hidden="true"
                >
                  {String(unit.value).padStart(2, "0")}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* Label */}
            {showLabels && (
              <span
                className={cn(
                  "font-mono font-bold uppercase tracking-widest text-text-faint",
                  s.label,
                )}
                aria-hidden="true"
              >
                {label}
              </span>
            )}
          </div>

          {/* Separator (not after last) */}
          {segIdx < 3 && (
            <span
              className={cn(
                "font-display font-bold text-cyan mb-6",
                size === "hero" ? "text-3xl" : size === "lg" ? "text-2xl" : "text-xl",
                "animate-pulse",
              )}
              aria-hidden="true"
            >
              :
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

export interface StatCardProps {
  value: number | string
  label: string
  suffix?: string
  prefix?: string
  description?: string
  icon?: React.ReactNode
  accent?: "cyan" | "neon" | "violet" | "pink" | "amber"
  animate?: boolean
  animateDelay?: number
  className?: string
}

const accentTextMap = {
  cyan:   "text-cyan",
  neon:   "text-neon",
  violet: "text-violet",
  pink:   "text-pink",
  amber:  "text-amber",
}

const accentBgMap = {
  cyan:   "bg-cyan/5 border-cyan/20",
  neon:   "bg-neon/5 border-neon/20",
  violet: "bg-violet/5 border-violet/20",
  pink:   "bg-pink/5 border-pink/20",
  amber:  "bg-amber/5 border-amber/20",
}

function useCountUp(end: number, duration = 1600, delay = 0, start = true) {
  const [count, setCount] = React.useState(0)

  React.useEffect(() => {
    if (!start) {return}
    const timer = setTimeout(() => {
      const startTime = performance.now()
      const step = (now: number) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3)
        setCount(Math.round(eased * end))
        if (progress < 1) {requestAnimationFrame(step)}
      }
      requestAnimationFrame(step)
    }, delay * 1000)

    return () => clearTimeout(timer)
  }, [end, duration, delay, start])

  return count
}

function StatCard({
  value,
  label,
  suffix = "",
  prefix = "",
  description,
  icon,
  accent = "cyan",
  animate = true,
  animateDelay = 0,
  className,
}: StatCardProps) {
  const [inView, setInView] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const numericValue = typeof value === "number" ? value : parseInt(String(value).replace(/\D/g, ""), 10) || 0

  const counted = useCountUp(numericValue, 1600, animateDelay, inView && animate)

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) {setInView(true)} },
      { threshold: 0.3 },
    )
    if (ref.current) {observer.observe(ref.current)}
    return () => observer.disconnect()
  }, [])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay: animateDelay, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative rounded-xl border p-6",
        accentBgMap[accent],
        className,
      )}
    >
      {/* Icon */}
      {icon && (
        <div
          className={cn("mb-4 w-10 h-10 rounded-lg flex items-center justify-center", `bg-${accent}/10`)}
          aria-hidden="true"
        >
          <span className={accentTextMap[accent]}>{icon}</span>
        </div>
      )}

      {/* Value */}
      <div
        className={cn(
          "font-display font-extrabold leading-none tabular-nums",
          accentTextMap[accent],
        )}
        style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
        aria-label={`${prefix}${typeof value === "number" ? formatNumber(value) : value}${suffix}`}
      >
        {prefix}
        <span aria-hidden="true">
          {animate && inView
            ? formatNumber(counted)
            : typeof value === "number"
              ? formatNumber(value)
              : value}
        </span>
        {suffix && (
          <span className="ml-1 text-[0.6em] text-current/60">{suffix}</span>
        )}
      </div>

      {/* Label */}
      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-text-muted">
        {label}
      </p>

      {/* Description */}
      {description && (
        <p className="mt-1 text-xs text-text-faint leading-relaxed">
          {description}
        </p>
      )}
    </motion.div>
  )
}

// ─── TerminalWindow ───────────────────────────────────────────────────────────

export interface TerminalWindowProps {
  title?: string
  children: React.ReactNode
  className?: string
  prompt?: string
  animate?: boolean
}

function TerminalWindow({
  title = "terminal",
  children,
  className,
  animate = false,
}: TerminalWindowProps) {
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 16 } : undefined}
      whileInView={animate ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "rounded-lg border border-border bg-bg-panel overflow-hidden",
        className,
      )}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-elevated">
        {/* Traffic light dots */}
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="w-3 h-3 rounded-full bg-pink/60" />
          <span className="w-3 h-3 rounded-full bg-amber/60" />
          <span className="w-3 h-3 rounded-full bg-neon/60" />
        </div>

        {/* Title */}
        <span className="flex-1 text-center font-mono text-xs text-text-faint">
          {title}
        </span>

        {/* Spacer (symmetry) */}
        <div className="w-[54px]" aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="p-4 font-mono text-sm text-cyan leading-relaxed overflow-x-auto scrollbar-hidden">
        {children}
      </div>
    </motion.div>
  )
}

// ─── TypewriterText — animated character reveal for hero/terminal ─────────────

export interface TypewriterTextProps {
  text: string
  speed?: number
  delay?: number
  showCursor?: boolean
  className?: string
  onComplete?: () => void
}

function TypewriterText({
  text,
  speed = 45,
  delay = 0,
  showCursor = true,
  className,
  onComplete,
}: TypewriterTextProps) {
  const [displayed, setDisplayed] = React.useState("")
  const [started, setStarted] = React.useState(false)

  React.useEffect(() => {
    const delayTimer = setTimeout(() => setStarted(true), delay)
    return () => clearTimeout(delayTimer)
  }, [delay])

  React.useEffect(() => {
    if (!started) {return}
    if (displayed.length >= text.length) {
      onComplete?.()
      return
    }
    const timer = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1))
    }, speed)
    return () => clearTimeout(timer)
  }, [displayed, text, speed, started, onComplete])

  const isDone = displayed.length >= text.length

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden="true">{displayed}</span>
      {showCursor && (
        <span
          className={cn(
            "inline-block w-[0.6em] h-[1.1em] bg-cyan ml-0.5 align-text-bottom",
            isDone && "animate-cursor-blink",
          )}
          aria-hidden="true"
        />
      )}
    </span>
  )
}

export { SeatCounter, CountdownTimer, StatCard, TerminalWindow, TypewriterText }
