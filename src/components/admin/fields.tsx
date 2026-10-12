"use client"

// =============================================================================
// Admin form fields — Toggle, ImageUrlField (upload + preview), TagsField.
// These compose the ui primitives with admin-specific behaviour so every
// admin form stays consistent.
// =============================================================================

import { ImagePlus, Loader2, X } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

import { adminUploadImage, toastApiError, type AdminUploadCategory } from "./api"

// ─── Toggle ───────────────────────────────────────────────────────────────────

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: React.ReactNode
  description?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
  id,
}: ToggleProps) {
  const generatedId = React.useId()
  const toggleId = id ?? generatedId

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <button
        type="button"
        id={toggleId}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60",
          checked
            ? "border-neon/50 bg-neon/25"
            : "border-border bg-bg-elevated",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-all duration-200",
            checked
              ? "left-[calc(100%-1.125rem)] bg-neon"
              : "left-0.5 bg-text-faint",
          )}
          aria-hidden="true"
        />
      </button>
      <label htmlFor={toggleId} className="cursor-pointer select-none">
        <span className="block text-sm font-medium text-text-primary">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-text-muted">
            {description}
          </span>
        )}
      </label>
    </div>
  )
}

// ─── ImageUrlField ────────────────────────────────────────────────────────────

export interface ImageUrlFieldProps {
  label: string
  value: string
  onChange: (url: string) => void
  category: AdminUploadCategory
  hint?: string
  error?: string
  /** Aspect ratio of the preview thumbnail. */
  aspect?: "square" | "wide" | "logo"
  required?: boolean
}

const ASPECT_CLASSES: Record<NonNullable<ImageUrlFieldProps["aspect"]>, string> = {
  square: "h-24 w-24",
  wide: "h-24 w-40",
  logo: "h-16 w-40",
}

/**
 * Upload-or-paste image URL field. Uploads go through /api/admin/upload
 * (validated + Sharp re-encoded server-side) and store the ABSOLUTE URL so
 * public pages can render it with a plain <img>.
 */
export function ImageUrlField({
  label,
  value,
  onChange,
  category,
  hint,
  error,
  aspect = "wide",
  required,
}: ImageUrlFieldProps) {
  const inputId = React.useId()
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const hasImage = value.trim().length > 0

  async function handleFile(file: File | undefined) {
    if (!file || uploading) {return}
    setUploading(true)
    try {
      const result = await adminUploadImage(file, category)
      onChange(result.absoluteUrl)
    } catch (err) {
      toastApiError(err, "Upload failed. Please try again.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) {fileInputRef.current.value = ""}
    }
  }

  return (
    <div className="w-full space-y-1.5">
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
      </label>

      <div className="flex flex-wrap items-start gap-3">
        {/* Preview */}
        <div
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-bg-elevated",
            ASPECT_CLASSES[aspect],
          )}
        >
          {hasImage && value.startsWith("http") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <ImagePlus className="h-5 w-5 text-text-faint" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan",
                uploading && "cursor-wait opacity-60",
              )}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {uploading ? "Uploading…" : hasImage ? "Replace image" : "Upload image"}
            </button>
            {hasImage && !uploading && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-pink focus:outline-none focus-visible:ring-1 focus-visible:ring-pink"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Remove
              </button>
            )}
          </div>
          <input
            id={inputId}
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://… or upload a file"
            className={cn(
              "h-9 w-full rounded-md border bg-bg-elevated px-3 text-xs text-text-primary placeholder:text-text-faint transition-colors focus:outline-none focus:ring-0",
              error
                ? "border-pink/60 focus:border-pink"
                : "border-border focus:border-cyan",
            )}
          />
        </div>
      </div>

      {hint && !error && (
        <p className="text-xs text-text-faint">{hint}</p>
      )}
      {error && <p className="text-xs text-pink">{error}</p>}
    </div>
  )
}

// ─── TagsField ────────────────────────────────────────────────────────────────

export interface TagsFieldProps {
  label: string
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  hint?: string
  error?: string
  max?: number
}

/**
 * Comma-separated tag input. Enter or comma commits a tag; Backspace on an
 * empty input removes the last tag.
 */
export function TagsField({
  label,
  value,
  onChange,
  placeholder = "Type and press Enter…",
  hint,
  error,
  max = 20,
}: TagsFieldProps) {
  const [draft, setDraft] = React.useState("")
  const inputId = React.useId()

  function commit(raw: string) {
    const tag = raw.trim()
    if (!tag) {return}
    if (value.length >= max) {return}
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setDraft("")
      return
    }
    onChange([...value, tag])
    setDraft("")
  }

  return (
    <div className="w-full space-y-1.5">
      <label
        htmlFor={inputId}
        className="block font-mono text-xs uppercase tracking-widest text-text-muted"
      >
        {label}
      </label>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-cyan/30 bg-cyan/10 px-2 py-0.5 text-xs text-cyan"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                aria-label={`Remove ${tag}`}
                className="text-cyan/70 transition-colors hover:text-pink focus:outline-none"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        id={inputId}
        type="text"
        value={draft}
        onChange={(e) => {
          const next = e.target.value
          if (next.includes(",")) {
            commit(next.replace(/,/g, ""))
          } else {
            setDraft(next)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit(draft)
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => commit(draft)}
        placeholder={placeholder}
        className={cn(
          "h-9 w-full rounded-md border bg-bg-elevated px-3 text-xs text-text-primary placeholder:text-text-faint transition-colors focus:outline-none focus:ring-0",
          error ? "border-pink/60 focus:border-pink" : "border-border focus:border-cyan",
        )}
      />

      {hint && !error && <p className="text-xs text-text-faint">{hint}</p>}
      {error && <p className="text-xs text-pink">{error}</p>}
    </div>
  )
}

// ─── Form row ─────────────────────────────────────────────────────────────────

export function FormGrid({
  children,
  cols = 2,
}: {
  children: React.ReactNode
  cols?: 1 | 2
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        cols === 2 && "sm:grid-cols-2",
      )}
    >
      {children}
    </div>
  )
}
