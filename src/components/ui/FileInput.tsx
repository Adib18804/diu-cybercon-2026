"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  Upload,
  X,
  FileImage,
  FileText,
  Camera,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import * as React from "react"

import { cn , formatBytes } from "@/lib/utils"

// =============================================================================
// FileInput — drag-drop zone, preview, camera capture on mobile, validation
// =============================================================================

export interface FileInputProps {
  label?: string
  accept?: string
  maxSizeBytes?: number
  value?: File | null
  onChange?: (file: File | null) => void
  onError?: (error: string) => void
  error?: string
  helper?: string
  disabled?: boolean
  required?: boolean
  /** Show camera capture button on mobile */
  allowCamera?: boolean
  /** Show image preview after selection */
  showPreview?: boolean
  /** Accepted file types for display hint */
  acceptHint?: string
  className?: string
  id?: string
}

type DropState = "idle" | "dragging" | "accepted" | "rejected"

function FileInput({
  label,
  accept = "image/jpeg,image/png,image/webp",
  maxSizeBytes = 5 * 1024 * 1024,
  value,
  onChange,
  onError,
  error,
  helper,
  disabled = false,
  required = false,
  allowCamera = true,
  showPreview = true,
  acceptHint = "JPG, PNG, WebP",
  className,
  id,
}: FileInputProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const cameraInputId = `${inputId}-camera`
  const errorId = `${inputId}-error`
  const helperId = `${inputId}-helper`

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const cameraInputRef = React.useRef<HTMLInputElement>(null)
  const [dropState, setDropState] = React.useState<DropState>("idle")
  const [preview, setPreview] = React.useState<string | null>(null)
  const dragCounterRef = React.useRef(0)

  // Build preview URL when value changes
  React.useEffect(() => {
    if (!value) {
      setPreview(null)
      return
    }
    const isImage = value.type.startsWith("image/")
    if (isImage && showPreview) {
      const url = URL.createObjectURL(value)
      setPreview(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [value, showPreview])

  // ── File validation ────────────────────────────────────────────────────────
  function validateAndSet(file: File): void {
    if (file.size > maxSizeBytes) {
      const err = `File is too large. Maximum size is ${formatBytes(maxSizeBytes)}.`
      onError?.(err)
      setDropState("rejected")
      setTimeout(() => setDropState("idle"), 2000)
      return
    }

    const acceptedTypes = accept.split(",").map((t) => t.trim())
    const isAccepted =
      acceptedTypes.some((t) => {
        if (t.endsWith("/*")) {
          return file.type.startsWith(t.slice(0, -2))
        }
        return file.type === t || file.name.toLowerCase().endsWith(t.replace("image/", "."))
      })

    if (!isAccepted) {
      const err = `File type not allowed. Accepted: ${acceptHint}.`
      onError?.(err)
      setDropState("rejected")
      setTimeout(() => setDropState("idle"), 2000)
      return
    }

    setDropState("accepted")
    onChange?.(file)
    setTimeout(() => setDropState("idle"), 1500)
  }

  // ── Input change ───────────────────────────────────────────────────────────
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {validateAndSet(file)}
    // Reset input so same file can be re-selected
    e.target.value = ""
  }

  // ── Drag events ────────────────────────────────────────────────────────────
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (!disabled) {setDropState("dragging")}
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {setDropState("idle")}
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    if (disabled) {return}

    const file = e.dataTransfer.files?.[0]
    if (file) {validateAndSet(file)}
    else {setDropState("idle")}
  }

  // ── Clear ──────────────────────────────────────────────────────────────────
  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange?.(null)
    setDropState("idle")
    setPreview(null)
  }

  const hasFile = !!value
  const isImage = value?.type.startsWith("image/") ?? false
  const isPdf = value?.type === "application/pdf"

  const zoneStateClasses: Record<DropState, string> = {
    idle:     "border-border hover:border-cyan/40",
    dragging: "border-cyan border-2 bg-cyan/5 shadow-glow-cyan-sm",
    accepted: "border-neon border-2 bg-neon/5 shadow-glow-neon-sm",
    rejected: "border-pink border-2 bg-pink/5",
  }

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className="block font-mono text-xs uppercase tracking-widest text-text-muted"
        >
          {label}
          {required && (
            <span className="ml-1 text-pink" aria-hidden="true">*</span>
          )}
          {required && <span className="sr-only"> (required)</span>}
        </label>
      )}

      {/* Drop zone */}
      <div
        className={cn(
          "relative rounded-lg border-2 border-dashed transition-all duration-250",
          "[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
          "bg-bg-elevated",
          zoneStateClasses[dropState],
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          error && !hasFile && "border-pink/60",
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-describedby={
          [error ? errorId : null, helper ? helperId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
      >
        <AnimatePresence mode="wait">
          {/* File selected state */}
          {hasFile ? (
            <motion.div
              key="file-selected"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="p-4"
            >
              <div className="flex items-start gap-4">
                {/* Preview / icon */}
                {showPreview && isImage && preview ? (
                  <div className="shrink-0 w-16 h-16 rounded-md overflow-hidden border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="shrink-0 w-16 h-16 rounded-md bg-bg-panel border border-border flex items-center justify-center">
                    {isPdf ? (
                      <FileText size={24} className="text-violet" />
                    ) : (
                      <FileImage size={24} className="text-cyan" />
                    )}
                  </div>
                )}

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {value.name}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {formatBytes(value.size)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <CheckCircle2 size={12} className="text-neon" />
                    <span className="text-xs text-neon font-mono">
                      File ready
                    </span>
                  </div>
                </div>

                {/* Clear button */}
                <button
                  type="button"
                  onClick={handleClear}
                  className={cn(
                    "shrink-0 p-1.5 rounded-md text-text-faint",
                    "hover:text-pink hover:bg-pink/10",
                    "transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
                  )}
                  aria-label="Remove file"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          ) : dropState === "dragging" ? (
            /* Dragging state */
            <motion.div
              key="dragging"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center"
            >
              <motion.div
                animate={{ y: [-4, 4, -4] }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              >
                <Upload size={32} className="text-cyan" />
              </motion.div>
              <p className="text-sm font-medium text-cyan">Drop file here</p>
            </motion.div>
          ) : dropState === "rejected" ? (
            /* Rejected state */
            <motion.div
              key="rejected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center"
            >
              <AlertCircle size={32} className="text-pink" />
              <p className="text-sm font-medium text-pink">File not accepted</p>
            </motion.div>
          ) : (
            /* Idle / empty state */
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-bg-panel border border-border flex items-center justify-center">
                <Upload size={20} className="text-text-muted" />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-text-primary">
                  <span className="text-cyan font-medium">Click to upload</span>
                  {" "}or drag and drop
                </p>
                <p className="text-xs text-text-faint">
                  {acceptHint} · Max {formatBytes(maxSizeBytes)}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          disabled={disabled}
          required={required}
          className="sr-only"
          aria-invalid={!!error}
        />
      </div>

      {/* Camera capture button (mobile) */}
      {allowCamera && !hasFile && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="font-mono text-xs text-text-faint uppercase tracking-widest">
            or
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {allowCamera && !hasFile && (
        <>
          <button
            type="button"
            disabled={disabled}
            onClick={() => cameraInputRef.current?.click()}
            className={cn(
              "w-full flex items-center justify-center gap-2",
              "h-10 rounded-md border border-border",
              "font-mono text-xs text-text-muted uppercase tracking-wider",
              "hover:border-cyan/40 hover:text-cyan hover:bg-cyan/5",
              "transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              // Camera button is primarily useful on mobile
              "sm:hidden", // hide on desktop where drag-drop is easier
            )}
            aria-label="Take a photo using camera"
          >
            <Camera size={14} />
            Use Camera
          </button>
          <input
            ref={cameraInputRef}
            id={cameraInputId}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleInputChange}
            disabled={disabled}
            className="sr-only"
            aria-label="Camera capture input"
          />
        </>
      )}

      {/* Error */}
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

      {/* Helper */}
      {helper && !error && (
        <p id={helperId} className="text-xs text-text-faint font-body">
          {helper}
        </p>
      )}
    </div>
  )
}

export { FileInput }
