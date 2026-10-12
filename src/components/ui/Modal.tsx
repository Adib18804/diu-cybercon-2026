"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import * as React from "react"

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
  full: "max-w-[95vw] max-h-[95dvh]",
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

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-modal bg-bg-deep/80 backdrop-blur-sm"
            aria-hidden="true"
            onClick={closeOnBackdrop ? onClose : undefined}
          />

          {/* Dialog */}
          <div
            className="fixed inset-0 z-modal flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descId : undefined}
          >
            <motion.div
              key="modal-panel"
              ref={dialogRef}
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "relative w-full flex flex-col",
                "bg-bg-panel border border-border rounded-xl",
                "shadow-xl max-h-[90dvh]",
                sizeClasses[size],
                className,
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              {(title ?? showCloseButton) && (
                <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border shrink-0">
                  <div className="space-y-1 min-w-0">
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
                      className={cn(
                        "shrink-0 p-2 rounded-md text-text-faint",
                        "hover:text-text-primary hover:bg-bg-elevated",
                        "transition-colors duration-150",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
                      )}
                      aria-label="Close dialog"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              )}

              {/* Body — scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <div className="shrink-0 px-6 py-4 border-t border-border flex items-center justify-end gap-3">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
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
