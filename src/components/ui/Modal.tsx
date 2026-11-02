"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

// =============================================================================
// Modal — focus trap, keyboard dismiss (Escape), backdrop blur, animated
// =============================================================================

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full"

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  size?: ModalSize
  children: React.ReactNode
  showCloseButton?: boolean
  closeOnBackdrop?: boolean
  className?: string
  /** Render footer actions */
  footer?: React.ReactNode
}

const sizeClasses: Record<ModalSize, string> = {
  sm:   "max-w-sm",
  md:   "max-w-lg",
  lg:   "max-w-2xl",
  xl:   "max-w-4xl",
  full: "max-w-[95vw]",
}

function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  showCloseButton = true,
  closeOnBackdrop = true,
  className,
  footer,
}: ModalProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const [portalTarget, setPortalTarget] = React.useState<HTMLElement | null>(null)
  const titleId = React.useId()
  const descId = React.useId()

  React.useEffect(() => {
    setPortalTarget(document.body)
  }, [])

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

  // ── Focus trap ──────────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!open || !dialogRef.current) {return}

    const focusableSelectors = [
      "button:not([disabled])",
      "a[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ")

    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(focusableSelectors),
    )

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    // Focus the dialog on open
    first?.focus()

    function trapFocus(e: KeyboardEvent) {
      if (e.key !== "Tab") {return}
      if (focusable.length === 0) { e.preventDefault(); return }

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }

    document.addEventListener("keydown", trapFocus)
    return () => document.removeEventListener("keydown", trapFocus)
  }, [open])

  return portalTarget ? createPortal(
    <AnimatePresence>
      {open && (
          <div
            className="fixed inset-0 z-[99999] isolate flex items-start justify-center overflow-y-auto px-4 pb-8 pt-28 pointer-events-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descId : undefined}
          >
            <motion.div
              key="modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 z-0 bg-bg-deep/80 backdrop-blur-sm pointer-events-auto"
              aria-hidden="true"
              onClick={closeOnBackdrop ? onClose : undefined}
            />

            <motion.div
              key="modal-panel"
              ref={dialogRef}
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "relative z-[100000] flex w-full min-h-0 flex-col pointer-events-auto",
                "bg-bg-panel border border-border rounded-xl",
                "shadow-xl max-h-[min(85vh,calc(100dvh-9rem))] overflow-hidden",
                sizeClasses[size],
                className,
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              {(title || description || showCloseButton) && (
                <div className="sticky top-0 z-50 flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-bg-panel px-6 pb-4 pt-6">
                  <div className="min-w-0 space-y-1">
                    {title && (
                      <h2
                        id={titleId}
                        className="font-display font-bold text-lg text-text-primary tracking-tight"
                      >
                        {title}
                      </h2>
                    )}
                    {description && (
                      <p id={descId} className="text-sm text-text-muted">
                        {description}
                      </p>
                    )}
                  </div>
                  {showCloseButton && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="relative z-[100001] inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border-bright bg-bg-elevated text-text-primary shadow-md transition-colors hover:border-cyan hover:bg-cyan hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                      aria-label="Close dialog"
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}

              {/* Body — scrollable */}
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <div className="sticky bottom-0 z-40 flex shrink-0 items-center justify-end gap-3 border-t border-white/10 bg-bg-panel px-6 py-4">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
      )}
    </AnimatePresence>,
    portalTarget,
  ) : null
}

// =============================================================================
// ConfirmModal — yes/no confirmation dialog
// =============================================================================

export interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "primary"
  loading?: boolean
}

function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-ghost"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
            className={variant === "danger" ? "btn-danger" : "btn-primary"}
          >
            {loading ? "Processing…" : confirmLabel}
          </button>
        </>
      }
    >
      {/* Empty — description in title area is sufficient for simple confirms */}
      <span />
    </Modal>
  )
}

export { Modal, ConfirmModal }
