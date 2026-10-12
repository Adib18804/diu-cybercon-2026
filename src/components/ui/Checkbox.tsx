"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Check } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// Checkbox — animated check, accessible, with label and error
// =============================================================================

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode
  description?: string
  error?: string
  indeterminate?: boolean
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      description,
      error,
      indeterminate = false,
      className,
      id,
      checked,
      onChange,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId()
    const inputId = id ?? generatedId
    const descId = `${inputId}-desc`
    const errorId = `${inputId}-error`

    const innerRef = React.useRef<HTMLInputElement>(null)

    // Merge refs
    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement)

    // Handle indeterminate state (not expressible via HTML attribute)
    React.useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = indeterminate
      }
    }, [indeterminate])

    const isChecked = checked ?? false

    return (
      <div className={cn("space-y-1", className)}>
        <div className="flex items-start gap-3">
          {/* Hidden native input */}
          <input
            ref={innerRef}
            id={inputId}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            aria-checked={indeterminate ? "mixed" : isChecked}
            aria-describedby={
              [description ? descId : null, error ? errorId : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
            className="sr-only"
            {...props}
          />

          {/* Custom checkbox visual */}
          <label
            htmlFor={inputId}
            className={cn(
              "relative flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center",
              "rounded border-2 transition-all duration-250 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
              "mt-0.5",
              isChecked || indeterminate
                ? "border-cyan bg-cyan/10 shadow-glow-cyan-sm"
                : "border-border bg-bg-elevated hover:border-cyan/40",
              disabled && "opacity-50 cursor-not-allowed",
              error && !isChecked && "border-pink/60",
            )}
          >
            <AnimatePresence>
              {(isChecked || indeterminate) && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                >
                  {indeterminate ? (
                    <span className="block w-2.5 h-0.5 bg-cyan rounded-full" />
                  ) : (
                    <Check size={12} className="text-cyan" strokeWidth={3} />
                  )}
                </motion.span>
              )}
            </AnimatePresence>
          </label>

          {/* Label and description */}
          {(label ?? description) && (
            <label
              htmlFor={inputId}
              className={cn(
                "cursor-pointer space-y-0.5",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              {label && (
                <span className="block text-sm text-text-primary font-body leading-5">
                  {label}
                </span>
              )}
              {description && (
                <span
                  id={descId}
                  className="block text-xs text-text-faint font-body"
                >
                  {description}
                </span>
              )}
            </label>
          )}
        </div>

        {error && (
          <p
            id={errorId}
            role="alert"
            className="ml-8 flex items-center gap-1.5 text-xs text-pink font-body"
          >
            {error}
          </p>
        )}
      </div>
    )
  },
)

Checkbox.displayName = "Checkbox"

export { Checkbox }
