"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// Drawer — slide-in panel from any side, focus trap, keyboard dismiss
// =============================================================================

export type DrawerSide = "left" | "right" | "bottom" | "top"

export interface DrawerProps {
  open: boolean
  onClose: () => void
  side?: DrawerSide
  title?: string
  description?: string
  children: React.ReactNode
  showCloseButton?: boolean
  closeOnBackdrop?: boolean
  className?: string
  footer?: React.ReactNode
  /** Width for left/right drawers */
  width?: string
  /** Height for top/bottom drawers */
  height?: string
}

/** Motion state used by the slide animation — transform + opacity only */
interface SlideState {
  /** Custom-property index signature required by Framer's Target types */
  [key: `--${string}`]: string | number
  x?: string | number
  y?: string | number
  opacity: number
}

const slideVariants: Record<
  DrawerSide,
  { initial: SlideState; animate: SlideState; exit: SlideState }
> = {
  left: {
    initial: { x: "-100%", opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit:    { x: "-100%", opacity: 0 },
  },
  right: {
    initial: { x: "100%", opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit:    { x: "100%", opacity: 0 },
  },
  bottom: {
    initial: { y: "100%", opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit:    { y: "100%", opacity: 0 },
  },
  top: {
    initial: { y: "-100%", opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit:    { y: "-100%", opacity: 0 },
  },
}

const positionClasses: Record<DrawerSide, string> = {
  left:   "inset-y-0 left-0",
  right:  "inset-y-0 right-0",
  bottom: "inset-x-0 bottom-0",
  top:    "inset-x-0 top-0",
}

function Drawer({
  open,
  onClose,
  side = "right",
  title,
  description,
  children,
  showCloseButton = true,
  closeOnBackdrop = true,
  className,
  footer,
  width = "w-80 sm:w-96",
  height = "h-[80dvh]",
}: DrawerProps) {
  const drawerRef = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  const descId = React.useId()

  // ── Escape key ──────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!open) {return}
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {onClose()}
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  // ── Body scroll lock ────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  // ── Focus first element on open ─────────────────────────────────────────────
  React.useEffect(() => {
    if (!open || !drawerRef.current) {return}
    const focusable = drawerRef.current.querySelector<HTMLElement>(
      "button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    )
    focusable?.focus()
  }, [open])

  const isHorizontal = side === "left" || side === "right"
  const sizeClass = isHorizontal ? width : height

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-drawer bg-bg-deep/70 backdrop-blur-sm"
            aria-hidden="true"
            onClick={closeOnBackdrop ? onClose : undefined}
          />

          {/* Panel */}
          <motion.div
            key="drawer-panel"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descId : undefined}
            initial={slideVariants[side].initial}
            animate={slideVariants[side].animate}
            exit={slideVariants[side].exit}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "fixed z-drawer flex flex-col",
              "bg-bg-panel border-border",
              positionClasses[side],
              sizeClass,
              side === "right"  && "border-l",
              side === "left"   && "border-r",
              side === "bottom" && "border-t rounded-t-2xl",
              side === "top"    && "border-b rounded-b-2xl",
              "overflow-hidden",
              className,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {(title ?? showCloseButton) && (
              <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-border">
                <div className="min-w-0 space-y-0.5">
                  {title && (
                    <h2
                      id={titleId}
                      className="font-display font-bold text-base text-text-primary tracking-tight"
                    >
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p id={descId} className="text-xs text-text-muted">
                      {description}
                    </p>
                  )}
                </div>

                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className={cn(
                      "shrink-0 p-2 rounded-md text-text-faint",
                      "hover:text-text-primary hover:bg-bg-elevated",
                      "transition-colors duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
                    )}
                    aria-label="Close drawer"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}

            {/* Drag handle for bottom drawers */}
            {side === "bottom" && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-border" aria-hidden="true" />
            )}

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0 scrollbar-hidden">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="shrink-0 px-6 py-4 border-t border-border flex items-center justify-end gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export { Drawer }
