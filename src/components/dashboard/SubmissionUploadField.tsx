"use client"

import { CheckCircle2, ExternalLink, RotateCcw, X } from "lucide-react"
import * as React from "react"
import toast from "react-hot-toast"

import { FileInput, Spinner } from "@/components/ui"
import { formatBytes } from "@/lib/utils"

// =============================================================================
// SubmissionUploadField — picker + immediate upload for public submission
// assets (project image, presentation file, poster file).
// Files are validated + re-encoded server-side (images: EXIF stripped, WebP);
// the form only keeps the signed upload token + a preview URL.
// =============================================================================

export type SubmissionUploadScope =
  | "projectImage"
  | "presentationFile"
  | "posterFile"

export interface StagedSubmissionUpload {
  token: string
  key: string
  fileName: string
  sizeBytes: number
  url: string
  mimeType: string
}

export interface SubmissionUploadFieldProps {
  label: string
  helper?: string
  scope: SubmissionUploadScope
  accept: string
  acceptHint: string
  maxSizeBytes: number
  value: StagedSubmissionUpload | null
  onChange: (upload: StagedSubmissionUpload | null) => void
  error?: string
  disabled?: boolean
  required?: boolean
}

interface UploadApiResponse {
  success: boolean
  error?: string
  data?: StagedSubmissionUpload
}

export function SubmissionUploadField({
  label,
  helper,
  scope,
  accept,
  acceptHint,
  maxSizeBytes,
  value,
  onChange,
  error,
  disabled = false,
  required = false,
}: SubmissionUploadFieldProps) {
  const [pendingFile, setPendingFile] = React.useState<File | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)

  async function uploadFile(file: File): Promise<void> {
    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("scope", scope)

      const res = await fetch("/api/upload/submission", {
        method: "POST",
        body: formData,
      })

      let json: UploadApiResponse | null = null
      try {
        json = (await res.json()) as UploadApiResponse
      } catch {
        json = null
      }

      if (!res.ok || !json?.success || !json.data) {
        const message =
          json?.error ??
          (res.status === 429
            ? "Too many uploads. Please wait a moment and try again."
            : "Upload failed. Please try again.")
        setUploadError(message)
        setPendingFile(null)
        toast.error(message)
        return
      }

      onChange(json.data)
      setPendingFile(null)
      toast.success(`${json.data.fileName} uploaded.`)
    } catch {
      const message = "Upload failed. Check your connection and try again."
      setUploadError(message)
      setPendingFile(null)
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  function handleFileSelect(file: File | null): void {
    if (!file) {
      setPendingFile(null)
      return
    }
    setPendingFile(file)
    void uploadFile(file)
  }

  // ── Uploaded state — staged file with view / replace / remove ───────────────
  if (value) {
    const isImage = value.mimeType.startsWith("image/")
    return (
      <div className="w-full space-y-1.5">
        <p className="block font-mono text-xs uppercase tracking-widest text-text-muted">
          {label}
        </p>
        <div className="flex items-start gap-4 rounded-lg border border-neon/30 bg-neon/5 p-4">
          {isImage ? (
            // Locally uploaded public asset preview (blob-free: server URL)
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value.url}
              alt=""
              className="h-12 w-12 shrink-0 rounded-md border border-border object-cover"
            />
          ) : (
            <CheckCircle2
              size={20}
              className="mt-0.5 shrink-0 text-neon"
              aria-hidden="true"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">
              {value.fileName}
            </p>
            <p className="mt-0.5 font-mono text-xs text-text-muted">
              {formatBytes(value.sizeBytes)} · uploaded securely
            </p>
            <a
              href={value.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-cyan underline-offset-2 hover:underline"
            >
              View file
              <ExternalLink size={11} aria-hidden="true" />
            </a>
          </div>
          {!disabled && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onChange(null)}
                className="rounded-md p-1.5 text-text-faint transition-colors duration-150 hover:bg-cyan/10 hover:text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                aria-label="Replace file"
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="rounded-md p-1.5 text-text-faint transition-colors duration-150 hover:bg-pink/10 hover:text-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                aria-label="Remove file"
              >
                <X size={15} />
              </button>
            </div>
          )}
        </div>
        {error && (
          <p role="alert" className="text-xs text-pink">
            {error}
          </p>
        )}
      </div>
    )
  }

  // ── Empty state — picker (+ uploading overlay while in flight) ──────────────
  return (
    <div className="relative">
      <FileInput
        label={label}
        accept={accept}
        acceptHint={acceptHint}
        maxSizeBytes={maxSizeBytes}
        value={pendingFile}
        onChange={handleFileSelect}
        onError={(message) => {
          setUploadError(message)
          toast.error(message)
        }}
        helper={helper}
        error={uploadError ?? error}
        disabled={disabled || uploading}
        required={required}
        showPreview={false}
      />
      {uploading && (
        <div className="absolute inset-0 z-content flex items-center justify-center rounded-lg bg-bg-deep/70 backdrop-blur-[2px]">
          <div className="flex items-center gap-3 rounded-md border border-border bg-bg-panel px-4 py-3">
            <Spinner size="sm" />
            <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
              Uploading…
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
