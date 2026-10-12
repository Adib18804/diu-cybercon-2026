"use client"

// =============================================================================
// Cursor — trailing ring cursor (native cursor stays visible)
//   · Ring follows the pointer with rAF lerp (factor 0.16, ~60fps)
//   · Grows over interactive elements; shrinks while pressed
//   · Enabled only for fine pointers; disabled under prefers-reduced-motion
//   · All per-frame updates go through refs (zero React re-renders)
// =============================================================================

import * as React from "react"

const RING_SIZE = 28
const POSITION_LERP = 0.16
const SCALE_LERP = 0.2
const HOVER_SCALE = 1.6
const PRESS_SCALE = 0.8

const INTERACTIVE_SELECTOR = [
  "a",
  "button",
  '[role="button"]',
  "input",
  "textarea",
  "select",
  "label[for]",
  "[data-cursor-hover]",
].join(", ")

export function Cursor() {
  const [enabled, setEnabled] = React.useState(false)
  const ringRef = React.useRef<HTMLDivElement>(null)

  // Gate: fine pointer + no reduced-motion preference.
  React.useEffect(() => {
    const pointerQuery = window.matchMedia("(pointer: fine)")
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)")

    const update = () => {
      setEnabled(pointerQuery.matches && !reducedQuery.matches)
    }

    update()
    pointerQuery.addEventListener("change", update)
    reducedQuery.addEventListener("change", update)
    return () => {
      pointerQuery.removeEventListener("change", update)
      reducedQuery.removeEventListener("change", update)
    }
  }, [])

  React.useEffect(() => {
    const ring = ringRef.current
    if (!enabled || !ring) {
      return
    }

    const target = { x: -100, y: -100 }
    const current = { x: -100, y: -100 }
    let hovering = false
    let pressing = false
    let scale = 1
    let targetScale = 1
    let rafId = 0

    const updateScaleFromState = () => {
      targetScale = pressing ? PRESS_SCALE : hovering ? HOVER_SCALE : 1
    }

    const frame = () => {
      current.x += (target.x - current.x) * POSITION_LERP
      current.y += (target.y - current.y) * POSITION_LERP
      scale += (targetScale - scale) * SCALE_LERP
      ring.style.transform = `translate3d(${current.x - RING_SIZE / 2}px, ${
        current.y - RING_SIZE / 2
      }px, 0) scale(${scale.toFixed(3)})`
      rafId = window.requestAnimationFrame(frame)
    }

    const onMouseMove = (event: MouseEvent) => {
      target.x = event.clientX
      target.y = event.clientY
      ring.style.opacity = "1"
    }

    const onMouseOver = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target : null
      hovering = Boolean(element?.closest(INTERACTIVE_SELECTOR))
      ring.classList.toggle("border-cyan/80", hovering)
      ring.classList.toggle("bg-cyan/5", hovering)
      ring.classList.toggle("border-cyan/40", !hovering)
      updateScaleFromState()
    }

    const onMouseDown = () => {
      pressing = true
      updateScaleFromState()
    }

    const onMouseUp = () => {
      pressing = false
      updateScaleFromState()
    }

    const onWindowLeave = () => {
      ring.style.opacity = "0"
    }

    const onWindowEnter = () => {
      ring.style.opacity = "1"
    }

    document.addEventListener("mousemove", onMouseMove, { passive: true })
    document.addEventListener("mouseover", onMouseOver, { passive: true })
    document.addEventListener("mousedown", onMouseDown, { passive: true })
    document.addEventListener("mouseup", onMouseUp, { passive: true })
    document.documentElement.addEventListener("mouseleave", onWindowLeave)
    document.documentElement.addEventListener("mouseenter", onWindowEnter)
    rafId = window.requestAnimationFrame(frame)

    return () => {
      window.cancelAnimationFrame(rafId)
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseover", onMouseOver)
      document.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("mouseup", onMouseUp)
      document.documentElement.removeEventListener("mouseleave", onWindowLeave)
      document.documentElement.removeEventListener("mouseenter", onWindowEnter)
    }
  }, [enabled])

  if (!enabled) {
    return null
  }

  return (
    <div
      ref={ringRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-cursor h-7 w-7 rounded-full border border-cyan/40 opacity-0 transition-opacity duration-250 will-change-transform"
    />
  )
}
