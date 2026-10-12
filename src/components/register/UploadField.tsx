"use client"

import { CheckCircle2, RotateCcw, X } from "lucide-react"
import * as React from "react"
import toast from "react-hot-toast"

import type { StagedUpload } from "./types"

import { FileInput, Spinner } from "@/components/ui"
import { formatBytes } from "@/lib/utils"


// =============================================================================
// UploadField — student ID picker + immediate secure upload.
// The file is validated and re-encoded server-side (EXIF stripped) and staged
// in private storage; the wizard only keeps the signed upload token.
// =============================================================================

export interface UploadFieldProps {
  label: string
  helper?: string
  value: StagedUpload | null
  onChange: (upload: StagedUpload | null) => void
  error?: string
  maxSizeBytes: number
  disabled?: boolean
}

interface UploadApiResponse {
  success: boolean
  error?: string
  data?: {
    key: string
    token: string
    fileName: string
    sizeBytes: number
    mimeType: string
  }
}

export function UploadField({
  label,
  helper,
  value,
  onChange,
  error,
  maxSizeBytes,
  disabled = false,
}: UploadFieldProps) {
  const [pendingFile, setPendingFile] = React.useState<File | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)

  async function uploadFile(file: File): Promise<void> {
    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("scope", "studentId")

      const res = await fetch("/api/upload/document", {
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

      onChange({
        token: json.data.token,
        fileName: json.data.fileName,
        sizeBytes: json.data.sizeBytes,
      })
      setPendingFile(null)
      toast.success("Student ID uploaded securely.")
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

  // ── Uploaded state — show the staged file with replace / remove ────────────
  if (value) {
    return (
      <div className="w-full space-y-1.5">
        <p className="block font-mono text-xs uppercase tracking-widest text-text-muted">
          {label}
        </p>
        <div className="flex items-start gap-4 rounded-lg border border-neon/30 bg-neon/5 p-4">
          <CheckCircle2
            size={20}
            className="mt-0.5 shrink-0 text-neon"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">
              {value.fileName}
            </p>
            <p className="mt-0.5 font-mono text-xs text-text-muted">
              {formatBytes(value.sizeBytes)} · uploaded securely
            </p>
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

  // ── Empty state — picker (+ uploading indicator while in flight) ───────────
  return (
    <div className="relative">
      <FileInput
        label={label}
        accept="image/jpeg,image/png,image/webp"
        acceptHint="JPG, PNG, WebP"
        maxSizeBytes={maxSizeBytes}
        value={pendingFile}
        onChange={handleFileSelect}
        onError={(message) => {
          setUploadError(message)
          toast.error(message)
        }}
        helper={
          helper ??
          "A clear photo of your student ID. It stays private — only the verification team can view it."
        }
        error={uploadError ?? error}
        disabled={disabled || uploading}
        required
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
