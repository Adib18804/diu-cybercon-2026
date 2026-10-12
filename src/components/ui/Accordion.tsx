"use client"

import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, Plus, Minus } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// Accordion — max-height expand, accessible, single/multi mode
// =============================================================================

export interface AccordionItem {
  value: string
  trigger: React.ReactNode
  content: React.ReactNode
  disabled?: boolean
  badge?: string | number
}

export type AccordionVariant = "default" | "bordered" | "flush" | "cyber"
export type AccordionIconStyle = "chevron" | "plus-minus" | "none"

export interface AccordionProps {
  items: AccordionItem[]
  /** "single" = one open at a time, "multiple" = many open at once */
  type?: "single" | "multiple"
  defaultValue?: string | string[]
  value?: string | string[]
  onValueChange?: (value: string | string[]) => void
  variant?: AccordionVariant
  iconStyle?: AccordionIconStyle
  className?: string
}

const variantItemClasses: Record<AccordionVariant, string> = {
  default:  "border border-border rounded-lg bg-bg-panel overflow-hidden",
  bordered: "border-b border-border last:border-b-0",
  flush:    "",
  cyber:    "border border-border/50 rounded-lg bg-bg-panel overflow-hidden transition-all duration-400 hover:border-cyan/20",
}

const variantTriggerClasses: Record<AccordionVariant, string> = {
  default:  "px-5 py-4 hover:bg-bg-elevated",
  bordered: "px-0 py-4 hover:text-cyan",
  flush:    "px-0 py-3 hover:text-cyan",
  cyber:    "px-5 py-4 hover:bg-cyan/5",
}

function Accordion({
  items,
  type = "single",
  defaultValue,
  value: controlledValue,
  onValueChange,
  variant = "default",
  iconStyle = "chevron",
  className,
}: AccordionProps) {
  // ── Internal open state ────────────────────────────────────────────────────
  const [openItems, setOpenItems] = React.useState<string[]>(() => {
    if (controlledValue !== undefined) {
      return Array.isArray(controlledValue) ? controlledValue : [controlledValue]
    }
    if (defaultValue !== undefined) {
      return Array.isArray(defaultValue) ? defaultValue : [defaultValue]
    }
    return []
  })

  const resolvedOpen =
    controlledValue !== undefined
      ? Array.isArray(controlledValue)
        ? controlledValue
        : [controlledValue]
      : openItems

  function toggle(val: string) {
    let next: string[]

    if (type === "single") {
      next = resolvedOpen.includes(val) ? [] : [val]
    } else {
      next = resolvedOpen.includes(val)
        ? resolvedOpen.filter((v) => v !== val)
        : [...resolvedOpen, val]
    }

    if (controlledValue === undefined) {setOpenItems(next)}

    if (onValueChange) {
      onValueChange(type === "single" ? (next[0] ?? "") : next)
    }
  }

  return (
    <div
      className={cn(
        "w-full space-y-2",
        (variant === "bordered" || variant === "flush") && "space-y-0",
        className,
      )}
    >
      {items.map((item) => {
        const isOpen = resolvedOpen.includes(item.value)
        const triggerId = `acc-trigger-${item.value}`
        const panelId = `acc-panel-${item.value}`

        return (
          <div
            key={item.value}
            className={cn(
              variantItemClasses[variant],
              variant === "cyber" && isOpen && "border-cyan/30 shadow-glow-cyan-sm",
            )}
          >
            {/* Trigger */}
            <button
              id={triggerId}
              type="button"
              disabled={item.disabled}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => !item.disabled && toggle(item.value)}
              className={cn(
                "w-full flex items-center justify-between gap-4 text-left",
                "font-body font-medium transition-colors duration-250",
                "[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-inset",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                variantTriggerClasses[variant],
                isOpen
                  ? variant === "cyber"
                    ? "text-cyan"
                    : "text-text-primary"
                  : "text-text-muted hover:text-text-primary",
              )}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="text-sm font-semibold truncate">{item.trigger}</span>
                {item.badge !== undefined && (
                  <span className="shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-border text-text-faint font-mono text-[0.625rem]">
                    {item.badge}
                  </span>
                )}
              </span>

              {/* Icon */}
              {iconStyle !== "none" && (
                <span
                  className={cn(
                    "shrink-0 transition-all duration-400",
                    "[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
                    variant === "cyber" ? "text-cyan/60" : "text-text-faint",
                  )}
                  aria-hidden="true"
                >
                  {iconStyle === "chevron" ? (
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="block"
                    >
                      <ChevronDown size={16} />
                    </motion.span>
                  ) : isOpen ? (
                    <Minus size={16} />
                  ) : (
                    <Plus size={16} />
                  )}
                </span>
              )}
            </button>

            {/* Panel — animated height */}
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  key={`panel-${item.value}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div
                    className={cn(
                      "text-sm text-text-muted leading-relaxed font-body",
                      variant === "default" || variant === "cyber"
                        ? "px-5 pb-5 pt-0"
                        : "pb-4 pt-0",
                    )}
                  >
                    {item.content}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

export { Accordion }
