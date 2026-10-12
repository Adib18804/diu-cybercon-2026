"use client"

import { AlertCircle, Eye, EyeOff, CheckCircle2 } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// Input — accessible text input with label, error, helper, icons, focus glow
// =============================================================================

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string
  error?: string
  helper?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  success?: boolean
  inputSize?: "sm" | "md" | "lg"
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helper,
      leftIcon,
      rightIcon,
      success,
      inputSize = "md",
      className,
      id,
      type = "text",
      required,
      disabled,
      ...props
    },
    ref,
  ) => {
    const [showPassword, setShowPassword] = React.useState(false)
    const generatedId = React.useId()
    const inputId = id ?? generatedId
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`

    const isPassword = type === "password"
    const resolvedType = isPassword ? (showPassword ? "text" : "password") : type

    const sizeClasses = {
      sm: "h-8 text-xs px-3",
      md: "h-11 text-sm px-4",
      lg: "h-13 text-base px-4",
    }

    const hasRightContent = Boolean(rightIcon || isPassword || success || error)

    return (
      <div className="w-full space-y-1.5">
        {/* Label */}
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

        {/* Input wrapper */}
        <div className="relative">
          {/* Left icon */}
          {leftIcon && (
            <div
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint"
              aria-hidden="true"
            >
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            disabled={disabled}
            required={required}
            aria-invalid={!!error}
            aria-describedby={
              [error ? errorId : null, helper ? helperId : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
            className={cn(
              // Base
              "w-full bg-bg-elevated border rounded-md",
              "text-text-primary placeholder:text-text-faint font-body",
              "transition-all duration-250 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
              "focus:outline-none focus:ring-0",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              // Size
              sizeClasses[inputSize],
              // Left padding when icon present
              leftIcon && "pl-10",
              // Right padding when content present
              hasRightContent && "pr-10",
              // State variants
              error
                ? "border-pink/60 focus:border-pink focus:shadow-glow-pink"
                : success
                  ? "border-neon/40 focus:border-neon focus:shadow-glow-neon-sm"
                  : "border-border focus:border-cyan focus:shadow-glow-cyan-sm",
              className,
            )}
            {...props}
          />

          {/* Right content area */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {/* Custom right icon */}
            {rightIcon && !isPassword && !error && !success && (
              <span className="text-text-faint" aria-hidden="true">
                {rightIcon}
              </span>
            )}

            {/* Success icon */}
            {success && !error && (
              <CheckCircle2
                className="text-neon"
                size={16}
                aria-hidden="true"
              />
            )}

            {/* Error icon */}
            {error && (
              <AlertCircle
                className="text-pink"
                size={16}
                aria-hidden="true"
              />
            )}

            {/* Password toggle */}
            {isPassword && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="text-text-faint hover:text-text-primary transition-colors duration-150 focus:outline-none focus-visible:text-cyan"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            )}
          </div>
        </div>

        {/* Error message */}
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

        {/* Helper text */}
        {helper && !error && (
          <p id={helperId} className="text-xs text-text-faint font-body">
            {helper}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = "Input"

export { Input }
