"use client"

// =============================================================================
// Preloader — boot sequence overlay
//   · Shows once per browser session (sessionStorage gate)
//   · Sequential boot lines (fade + slide-in, 250ms cadence)
//   · Progress bar fills in 150ms steps
//   · Exits with a 400ms fade; skipped entirely under prefers-reduced-motion
//   · <noscript> fallback hides it when JS is unavailable
// =============================================================================

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import * as React from "react"

import { APP_NAME, APP_TAGLINE } from "@/lib/constants"

const STORAGE_KEY = "dc26-preloaded"

const BOOT_LINES = [
  "initializing secure session...",
  "verifying integrity checksums...",
  "loading event modules...",
  "establishing encrypted channel...",
  "launching experience...",
] as const

const LINE_INTERVAL_MS = 250
const PROGRESS_STEP_MS = 150
const PROGRESS_STEPS = [12, 24, 37, 49, 61, 74, 86, 100] as const

// First line/progress step appears quickly, then cadence follows the spec.
const FIRST_DELAY_MS = 120
const BOOT_END_MS =
  FIRST_DELAY_MS + PROGRESS_STEPS.length * PROGRESS_STEP_MS + 160

export function Preloader() {
  const prefersReduced = useReducedMotion()
  const [visible, setVisible] = React.useState(true)
  const [lineCount, setLineCount] = React.useState(0)
  const [progress, setProgress] = React.useState(0)

  React.useEffect(() => {
    let skip = false
    try {
      skip = window.sessionStorage.getItem(STORAGE_KEY) === "1"
    } catch {
      // Storage unavailable (privacy mode) — treat as first visit.
    }

    if (skip || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, "1")
      } catch {
        /* ignore */
      }
      setVisible(false)
      return
    }

    const timers: Array<ReturnType<typeof setTimeout>> = []

    BOOT_LINES.forEach((_, index) => {
      timers.push(
        setTimeout(
          () => setLineCount(index + 1),
          FIRST_DELAY_MS + index * LINE_INTERVAL_MS,
        ),
      )
    })

    PROGRESS_STEPS.forEach((value, index) => {
      timers.push(
        setTimeout(
          () => setProgress(value),
          FIRST_DELAY_MS + index * PROGRESS_STEP_MS,
        ),
      )
    })

    timers.push(
      setTimeout(() => {
        try {
          window.sessionStorage.setItem(STORAGE_KEY, "1")
        } catch {
          /* ignore */
        }
        setVisible(false)
      }, BOOT_END_MS),
    )

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [])

  // Lock scroll while the overlay is up.
  React.useEffect(() => {
    if (!visible) {
      return
    }
    const { style } = document.documentElement
    style.overflow = "hidden"
    return () => {
      style.overflow = ""
    }
  }, [visible])

  return (
    <>
      {/* No-JS fallback: never trap the page behind the overlay */}
      <noscript>
        <style>{`#dc-preloader{display:none !important}`}</style>
      </noscript>

      <AnimatePresence>
        {visible && (
          <motion.div
            id="dc-preloader"
            key="preloader"
            aria-hidden="true"
            exit={{ opacity: 0 }}
            transition={{
              duration: prefersReduced ? 0 : 0.4,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="fixed inset-0 z-scan-line flex flex-col items-center justify-center gap-8 bg-bg-deep px-6"
          >
            {/* Brand */}
            <div className="flex flex-col items-center gap-2">
              <span className="flex h-12 w-12 items-center justify-center rounded-md border border-cyan/40 bg-cyan/5 font-mono text-lg font-bold text-cyan shadow-glow-cyan-sm">
                &gt;_
              </span>
              <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-text-primary">
                {APP_NAME}
              </p>
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.35em] text-cyan/80">
                {APP_TAGLINE}
              </p>
            </div>

            {/* Boot lines */}
            <div className="flex h-24 w-full max-w-xs flex-col justify-end gap-1.5 font-mono text-xs text-text-muted">
              {BOOT_LINES.slice(0, lineCount).map((line) => (
                <motion.p
                  key={line}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="m-0 text-text-muted"
                >
                  <span className="text-cyan">&gt;</span> {line}
                </motion.p>
              ))}
            </div>

            {/* Progress */}
            <div className="flex w-full max-w-xs flex-col gap-2">
              <div className="h-1 w-full overflow-hidden rounded-full bg-border/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan to-violet transition-[width] duration-150 ease-expo-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between font-mono text-[0.6rem] uppercase tracking-widest text-text-faint">
                <span>Booting</span>
                <span className="text-cyan">{progress}%</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
