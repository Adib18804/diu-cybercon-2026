"use client"

import { motion, AnimatePresence } from "framer-motion"
import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// RadioGroup — animated selection ring, accessible, grouped
// =============================================================================

export interface RadioOption {
  value: string
  label: React.ReactNode
  description?: string
  disabled?: boolean
  badge?: string
}

export interface RadioGroupProps {
  name: string
  options: RadioOption[]
  value?: string
  onChange?: (value: string) => void
  label?: string
  error?: string
  helper?: string
  orientation?: "horizontal" | "vertical"
  variant?: "default" | "card"
  className?: string
  required?: boolean
}

function RadioGroup({
  name,
  options,
  value,
  onChange,
  label,
  error,
  helper,
  orientation = "vertical",
  variant = "default",
  className,
  required,
}: RadioGroupProps) {
  const groupId = React.useId()
  const errorId = `${groupId}-error`
  const helperId = `${groupId}-helper`

  return (
    <fieldset
      className={cn("space-y-2", className)}
      aria-required={required}
      aria-describedby={
        [error ? errorId : null, helper ? helperId : null]
          .filter(Boolean)
          .join(" ") || undefined
      }
    >
      {label && (
        <legend className="block font-mono text-xs uppercase tracking-widest text-text-muted mb-3">
          {label}
          {required && (
            <span className="ml-1 text-pink" aria-hidden="true">
              *
            </span>
          )}
        </legend>
      )}

      <div
        className={cn(
          orientation === "horizontal"
            ? "flex flex-wrap gap-3"
            : "flex flex-col gap-2",
        )}
        role="radiogroup"
      >
        {options.map((option) => {
          const optionId = `${groupId}-${option.value}`
          const isSelected = value === option.value

          if (variant === "card") {
            return (
              <label
                key={option.value}
                htmlFor={optionId}
                className={cn(
                  "relative flex cursor-pointer items-start gap-3 rounded-md border p-4",
                  "transition-all duration-250 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
                  isSelected
                    ? "border-cyan/50 bg-cyan/5 shadow-glow-cyan-sm"
                    : "border-border bg-bg-elevated hover:border-cyan/30 hover:bg-bg-elevated",
                  option.disabled && "opacity-50 cursor-not-allowed",
                )}
              >
                <input
                  type="radio"
                  id={optionId}
                  name={name}
                  value={option.value}
                  checked={isSelected}
                  disabled={option.disabled}
                  onChange={() => onChange?.(option.value)}
                  className="sr-only"
                />

                {/* Radio dot */}
                <div
                  className={cn(
                    "mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center",
                    "transition-all duration-250",
                    isSelected
                      ? "border-cyan shadow-glow-cyan-sm"
                      : "border-border",
                  )}
                  aria-hidden="true"
                >
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                        className="h-2.5 w-2.5 rounded-full bg-cyan"
                      />
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {option.label}
                    </span>
                    {option.badge && (
                      <span className="badge-cyan text-[0.625rem]">
                        {option.badge}
                      </span>
                    )}
                  </div>
                  {option.description && (
                    <span className="block text-xs text-text-faint mt-0.5">
                      {option.description}
                    </span>
                  )}
                </div>
              </label>
            )
          }

          // Default variant
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                "flex cursor-pointer items-center gap-3",
                option.disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <input
                type="radio"
                id={optionId}
                name={name}
                value={option.value}
                checked={isSelected}
                disabled={option.disabled}
                onChange={() => onChange?.(option.value)}
                className="sr-only"
              />

              {/* Radio visual */}
              <div
                className={cn(
                  "h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center",
                  "transition-all duration-250 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
                  isSelected
                    ? "border-cyan shadow-glow-cyan-sm"
                    : "border-border hover:border-cyan/40",
                )}
                aria-hidden="true"
              >
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      className="h-2.5 w-2.5 rounded-full bg-cyan"
                    />
                  )}
                </AnimatePresence>
              </div>

              <div>
                <span className="text-sm text-text-primary">{option.label}</span>
                {option.description && (
                  <span className="block text-xs text-text-faint">
                    {option.description}
                  </span>
                )}
              </div>
            </label>
          )
        })}
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-xs text-pink font-body">
          {error}
        </p>
      )}

      {helper && !error && (
        <p id={helperId} className="text-xs text-text-faint font-body">
          {helper}
        </p>
      )}
    </fieldset>
  )
}

export { RadioGroup }
