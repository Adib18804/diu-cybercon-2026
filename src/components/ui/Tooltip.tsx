"use client"

import { motion, AnimatePresence } from "framer-motion"
import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// Tooltip — hover/focus reveal, accessible, 4 placement options
// =============================================================================

export type TooltipPlacement = "top" | "bottom" | "left" | "right"

export interface TooltipProps {
  content: React.ReactNode
  children: React.ReactElement
  placement?: TooltipPlacement
  delay?: number
  className?: string
  disabled?: boolean
}

const placementClasses: Record<TooltipPlacement, string> = {
  top:    "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left:   "right-full top-1/2 -translate-y-1/2 mr-2",
  right:  "left-full top-1/2 -translate-y-1/2 ml-2",
}

const placementMotion: Record<TooltipPlacement, { initial: object }> = {
  top:    { initial: { opacity: 0, y: 4 } },
  bottom: { initial: { opacity: 0, y: -4 } },
  left:   { initial: { opacity: 0, x: 4 } },
  right:  { initial: { opacity: 0, x: -4 } },
}

function Tooltip({
  content,
  children,
  placement = "top",
  delay = 400,
  className,
  disabled = false,
}: TooltipProps) {
  const [visible, setVisible] = React.useState(false)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipId = React.useId()

  function show() {
    if (disabled) {return}
    timeoutRef.current = setTimeout(() => setVisible(true), delay)
  }

  function hide() {
    if (timeoutRef.current) {clearTimeout(timeoutRef.current)}
    setVisible(false)
  }

  React.useEffect(() => () => {
    if (timeoutRef.current) {clearTimeout(timeoutRef.current)}
  }, [])

  const child = React.cloneElement(children, {
    onMouseEnter: (e: React.MouseEvent) => {
      show()
      ;(children.props as { onMouseEnter?: (e: React.MouseEvent) => void }).onMouseEnter?.(e)
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hide()
      ;(children.props as { onMouseLeave?: (e: React.MouseEvent) => void }).onMouseLeave?.(e)
    },
    onFocus: (e: React.FocusEvent) => {
      if (!disabled) {setVisible(true)
      ;}(children.props as { onFocus?: (e: React.FocusEvent) => void }).onFocus?.(e)
    },
    onBlur: (e: React.FocusEvent) => {
      setVisible(false)
      ;(children.props as { onBlur?: (e: React.FocusEvent) => void }).onBlur?.(e)
    },
    "aria-describedby": visible ? tooltipId : undefined,
  })

  return (
    <span className="relative inline-flex">
      {child}

      <AnimatePresence>
        {visible && (
          <motion.div
            id={tooltipId}
            role="tooltip"
            key="tooltip"
            initial={{ ...placementMotion[placement].initial, opacity: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ ...placementMotion[placement].initial, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "absolute z-[100] pointer-events-none",
              placementClasses[placement],
            )}
          >
            <div
              className={cn(
                "px-3 py-1.5 rounded-md",
                "bg-bg-elevated border border-border",
                "font-body text-xs text-text-primary",
                "shadow-lg whitespace-nowrap max-w-[200px]",
                className,
              )}
            >
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  )
}

// =============================================================================
// Pagination — numbered pages, prev/next, accessible
// =============================================================================

export interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  showEdges?: boolean
  siblings?: number
  className?: string
}

function getPageRange(
  page: number,
  totalPages: number,
  siblings: number,
): (number | "dots")[] {
  const range: (number | "dots")[] = []

  const left = Math.max(1, page - siblings)
  const right = Math.min(totalPages, page + siblings)

  if (left > 2) {
    range.push(1, "dots")
  } else {
    for (let i = 1; i < left; i++) {range.push(i)}
  }

  for (let i = left; i <= right; i++) {range.push(i)}

  if (right < totalPages - 1) {
    range.push("dots", totalPages)
  } else {
    for (let i = right + 1; i <= totalPages; i++) {range.push(i)}
  }

  return range
}

function Pagination({
  page,
  totalPages,
  onPageChange,
  showEdges: _showEdges = true,
  siblings = 1,
  className,
}: PaginationProps) {
  if (totalPages <= 1) {return null}

  const pages = getPageRange(page, totalPages, siblings)

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center gap-1", className)}
    >
      {/* Previous */}
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className={cn(
          "h-9 px-3 rounded-md border font-mono text-xs uppercase tracking-wider",
          "transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
          page <= 1
            ? "border-border text-text-faint cursor-not-allowed opacity-50"
            : "border-border text-text-muted hover:border-cyan/40 hover:text-cyan",
        )}
      >
        ← Prev
      </button>

      {/* Page numbers */}
      <div className="flex items-center gap-1">
        {pages.map((p, idx) =>
          p === "dots" ? (
            <span
              key={`dots-${idx}`}
              className="w-9 h-9 flex items-center justify-center text-text-faint font-mono text-xs"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "w-9 h-9 rounded-md border font-mono text-xs",
                "transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
                p === page
                  ? "border-cyan bg-cyan/10 text-cyan shadow-glow-cyan-sm"
                  : "border-border text-text-muted hover:border-cyan/40 hover:text-text-primary",
              )}
            >
              {p}
            </button>
          ),
        )}
      </div>

      {/* Next */}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
        className={cn(
          "h-9 px-3 rounded-md border font-mono text-xs uppercase tracking-wider",
          "transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
          page >= totalPages
            ? "border-border text-text-faint cursor-not-allowed opacity-50"
            : "border-border text-text-muted hover:border-cyan/40 hover:text-cyan",
        )}
      >
        Next →
      </button>
    </nav>
  )
}

// =============================================================================
// Breadcrumb — accessible nav landmark with structured data hint
// =============================================================================

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[]
  separator?: React.ReactNode
  className?: string
}

function Breadcrumb({
  items,
  separator = "/",
  className,
}: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center", className)}>
      <ol
        className="flex items-center flex-wrap gap-x-2 gap-y-1"
        itemScope
        itemType="https://schema.org/BreadcrumbList"
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li
              key={index}
              className="flex items-center gap-2"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              {index > 0 && (
                <span
                  className="text-text-faint text-xs font-mono"
                  aria-hidden="true"
                >
                  {separator}
                </span>
              )}

              {isLast || !item.href ? (
                <span
                  className={cn(
                    "font-mono text-xs",
                    isLast ? "text-cyan" : "text-text-muted",
                  )}
                  aria-current={isLast ? "page" : undefined}
                  itemProp="name"
                >
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  className="font-mono text-xs text-text-muted hover:text-text-primary transition-colors duration-150"
                  itemProp="item"
                >
                  <span itemProp="name">{item.label}</span>
                </a>
              )}

              <meta itemProp="position" content={String(index + 1)} />
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export { Tooltip, Pagination, Breadcrumb }
