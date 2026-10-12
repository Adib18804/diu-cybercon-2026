"use client"

// =============================================================================
// MatrixBg — canvas "digital rain" backdrop
//   · Cyan glyphs on transparent canvas, ~5% opacity, fixed + non-interactive
//   · rAF loop throttled to ~22fps, paused when the tab is hidden
//   · Disabled entirely under prefers-reduced-motion (listens for changes)
//   · Renders behind page content (z-effects), alongside the CSS grid layer
// =============================================================================

import * as React from "react"

const GLYPHS =
  "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ9876543210ABCDEF<>#@$%"
const FONT_SIZE = 14
const FRAME_INTERVAL_MS = 45 // ~22fps — smooth enough, cheap on CPU
const TRAIL_ALPHA = 0.08

export function MatrixBg() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) {
      return
    }

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)")

    let drops: number[] = []
    let columns = 0
    let rafId = 0
    let lastFrame = 0
    let running = false

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      columns = Math.max(1, Math.floor(canvas.width / FONT_SIZE))
      drops = Array.from({ length: columns }, () =>
        Math.floor((Math.random() * canvas.height) / FONT_SIZE),
      )
      context.font = `${FONT_SIZE}px "JetBrains Mono", monospace`
      context.textBaseline = "top"
      context.clearRect(0, 0, canvas.width, canvas.height)
    }

    const draw = () => {
      // Fade previous frame to leave rain trails.
      context.fillStyle = `rgba(5, 7, 13, ${TRAIL_ALPHA})`
      context.fillRect(0, 0, canvas.width, canvas.height)

      context.fillStyle = "#00e5ff"
      for (let i = 0; i < columns; i += 1) {
        const char = GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length))
        const x = i * FONT_SIZE
        const y = (drops[i] ?? 0) * FONT_SIZE
        context.fillText(char, x, y)

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0
        } else {
          drops[i] = (drops[i] ?? 0) + 1
        }
      }
    }

    const frame = (timestamp: number) => {
      if (!running) {
        return
      }
      if (timestamp - lastFrame >= FRAME_INTERVAL_MS) {
        lastFrame = timestamp
        draw()
      }
      rafId = window.requestAnimationFrame(frame)
    }

    const start = () => {
      if (running || reducedQuery.matches) {
        return
      }
      running = true
      lastFrame = 0
      rafId = window.requestAnimationFrame(frame)
    }

    const stop = () => {
      running = false
      window.cancelAnimationFrame(rafId)
      context.clearRect(0, 0, canvas.width, canvas.height)
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop()
      } else {
        start()
      }
    }

    const onReducedChange = () => {
      if (reducedQuery.matches) {
        stop()
      } else {
        resize()
        start()
      }
    }

    resize()
    start()

    window.addEventListener("resize", resize)
    document.addEventListener("visibilitychange", onVisibilityChange)
    reducedQuery.addEventListener("change", onReducedChange)

    return () => {
      stop()
      window.removeEventListener("resize", resize)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      reducedQuery.removeEventListener("change", onReducedChange)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-effects h-full w-full opacity-5"
    />
  )
}
