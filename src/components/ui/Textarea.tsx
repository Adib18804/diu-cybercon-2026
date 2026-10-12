"use client"

import { AlertCircle } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// Textarea — accessible, resizable, character count, focus glow
// =============================================================================

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helper?: string
  maxLength?: number
  showCount?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helper,
      maxLength,
      showCount = false,
      className,
      id,
      required,
      value,
      onChange,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId()
    const inputId = id ?? generatedId
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`

    const [charCount, setCharCount] = React.useState(
      typeof value === "string" ? value.length : 0,
    )

    function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
      setCharCount(e.target.value.length)
      onChange?.(e)
    }

    const isNearLimit = maxLength && charCount > maxLength * 0.85
    const isAtLimit = maxLength && charCount >= maxLength

    return (
      <div className="w-full space-y-1.5">
        {/* Label + character count */}
        <div className="flex items-center justify-between">
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

          {(showCount || maxLength) && (
            <span
              className={cn(
                "font-mono text-xs tabular-nums",
                isAtLimit
                  ? "text-pink"
                  : isNearLimit
                    ? "text-amber"
                    : "text-text-faint",
              )}
              aria-live="polite"
            >
              {charCount}
              {maxLength ? `/${maxLength}` : ""}
            </span>
          )}
        </div>

        <textarea
          ref={ref}
          id={inputId}
          required={required}
          maxLength={maxLength}
          value={value}
          onChange={handleChange}
          aria-invalid={!!error}
          aria-describedby={
            [error ? errorId : null, helper ? helperId : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={cn(
            "w-full bg-bg-elevated border rounded-md px-4 py-3",
            "text-sm text-text-primary placeholder:text-text-faint font-body",
            "resize-y min-h-[120px]",
            "transition-all duration-250 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
            "focus:outline-none focus:ring-0",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error
              ? "border-pink/60 focus:border-pink focus:shadow-glow-pink"
              : "border-border focus:border-cyan focus:shadow-glow-cyan-sm",
            className,
          )}
          {...props}
        />

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

Textarea.displayName = "Textarea"

export { Textarea }
