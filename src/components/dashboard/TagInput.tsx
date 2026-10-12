"use client"

import { AlertCircle, Plus, X } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// TagInput — chip-based string array input.
// Used for project technologies, poster authors, and poster keywords.
// =============================================================================

export interface TagInputProps {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  error?: string
  helper?: string
  placeholder?: string
  /** Hard cap on number of entries (mirrors the server schema). */
  maxItems: number
  /** Hard cap on characters per entry (mirrors the server schema). */
  maxLength: number
  disabled?: boolean
  required?: boolean
}

export function TagInput({
  label,
  values,
  onChange,
  error,
  helper,
  placeholder = "Type and press Enter",
  maxItems,
  maxLength,
  disabled = false,
  required = false,
}: TagInputProps) {
  const [draft, setDraft] = React.useState("")
  const [localError, setLocalError] = React.useState<string | null>(null)
  const inputId = React.useId()

  const atCapacity = values.length >= maxItems

  function addTag(): void {
    const value = draft.trim()
    if (!value) {
      setDraft("")
      return
    }

    if (value.length < 2) {
      setLocalError("Each entry needs at least 2 characters")
      return
    }
    if (value.length > maxLength) {
      setLocalError(`Each entry can be at most ${maxLength} characters`)
      return
    }
    if (values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      setLocalError("That entry was already added")
      setDraft("")
      return
    }
    if (atCapacity) {
      setLocalError(`You can add up to ${maxItems} entries`)
      return
    }

    onChange([...values, value])
    setDraft("")
    setLocalError(null)
  }

  function removeTag(index: number): void {
    onChange(values.filter((_, i) => i !== index))
    setLocalError(null)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag()
      return
    }
    if (e.key === "Backspace" && !draft && values.length > 0) {
      removeTag(values.length - 1)
    }
  }

  const shownError = localError ?? error

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between">
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
        <span className="font-mono text-xs tabular-nums text-text-faint">
          {values.length}/{maxItems}
        </span>
      </div>

      {/* Chips */}
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value, index) => (
            <span
              key={`${value}-${index}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-cyan/30 bg-cyan/5 py-1 pl-2.5 pr-1.5 text-xs text-cyan"
            >
              {value}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeTag(index)}
                  className="rounded p-0.5 text-cyan/70 transition-colors duration-150 hover:bg-cyan/15 hover:text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                  aria-label={`Remove ${value}`}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex gap-2">
        <input
          id={inputId}
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setLocalError(null)
          }}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={atCapacity ? `Maximum of ${maxItems} reached` : placeholder}
          disabled={disabled || atCapacity}
          maxLength={maxLength + 20}
          aria-invalid={!!shownError}
          className={cn(
            "h-11 w-full rounded-md border bg-bg-elevated px-4 text-sm",
            "text-text-primary placeholder:text-text-faint font-body",
            "transition-all duration-250 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
            "focus:outline-none focus:ring-0",
            "disabled:cursor-not-allowed disabled:opacity-50",
            shownError
              ? "border-pink/60 focus:border-pink focus:shadow-glow-pink"
              : "border-border focus:border-cyan focus:shadow-glow-cyan-sm",
          )}
        />
        <button
          type="button"
          onClick={addTag}
          disabled={disabled || atCapacity || !draft.trim()}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border",
            "border-border bg-bg-elevated text-text-muted transition-colors duration-150",
            "hover:border-cyan/40 hover:text-cyan",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-muted",
          )}
          aria-label="Add entry"
        >
          <Plus size={16} />
        </button>
      </div>

      {shownError && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-pink font-body">
          <AlertCircle size={12} className="shrink-0" aria-hidden="true" />
          {shownError}
        </p>
      )}

      {helper && !shownError && (
        <p className="text-xs text-text-faint font-body">{helper}</p>
      )}
    </div>
  )
}
