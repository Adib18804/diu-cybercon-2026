"use client"

import { ChevronDown, AlertCircle } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// Select — custom styled native select, accessible, focus glow
// =============================================================================

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string
  error?: string
  helper?: string
  options?: SelectOption[]
  placeholder?: string
  selectSize?: "sm" | "md" | "lg"
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helper,
      options = [],
      placeholder,
      selectSize = "md",
      className,
      id,
      required,
      children,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId()
    const inputId = id ?? generatedId
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`

    const sizeClasses = {
      sm: "h-8 text-xs pl-3 pr-8",
      md: "h-11 text-sm pl-4 pr-10",
      lg: "h-13 text-base pl-4 pr-10",
    }

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block font-mono text-xs uppercase tracking-widest text-text-muted"
          >
            {label}
            {required && (
              <span className="ml-1 text-pink" aria-hidden="true">
                *
              </span>
            )}
            {required && <span className="sr-only"> (required)</span>}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={!!error}
            aria-describedby={
              [error ? errorId : null, helper ? helperId : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
            className={cn(
              "w-full appearance-none bg-bg-elevated border rounded-md",
              "text-text-primary font-body cursor-pointer",
              "transition-all duration-250 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
              "focus:outline-none focus:ring-0",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              sizeClasses[selectSize],
              error
                ? "border-pink/60 focus:border-pink focus:shadow-glow-pink"
                : "border-border focus:border-cyan focus:shadow-glow-cyan-sm",
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
            {children}
          </select>

          {/* Arrow icon */}
          <div
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-faint"
            aria-hidden="true"
          >
            <ChevronDown size={16} />
          </div>
        </div>

        {error && (
          <p
            id={errorId}
            role="alert"
            className="flex items-center gap-1.5 text-xs text-pink font-body"
          >
            <AlertCircle size={12} className="shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        {helper && !error && (
          <p id={helperId} className="text-xs text-text-faint font-body">
            {helper}
          </p>
        )}
      </div>
    )
  },
)

Select.displayName = "Select"

export { Select }
