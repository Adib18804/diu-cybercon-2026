"use client"

// =============================================================================
// Admin client — fetch helpers
// One place for envelope parsing, typed errors, and user-facing toasts.
// All admin pages fetch through these so error UX stays consistent.
// =============================================================================

import toast from "react-hot-toast"

export type AdminApiErrorDetails = Record<string, string[]>

type SuccessEnvelope<T> = { success: true; data: T; message?: string }
type ErrorEnvelope = {
  success: false
  error: string
  code?: string
  details?: AdminApiErrorDetails
}
export type ApiEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope

export class AdminApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: AdminApiErrorDetails

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: AdminApiErrorDetails,
  ) {
    super(message)
    this.name = "AdminApiError"
    this.status = status
    this.code = code
    this.details = details
  }
}

/** Toast an error safely — never leaks stack traces, always human-readable. */
export function toastApiError(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): void {
  const message =
    err instanceof AdminApiError
      ? err.message
      : err instanceof Error && err.message
        ? err.message
        : fallback
  toast.error(message)
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  try {
    return (await response.json()) as ApiEnvelope<T>
  } catch {
    return { success: false, error: "Unexpected server response." }
  }
}

/** GET JSON through the standard envelope. Throws AdminApiError on failure. */
export async function adminFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" })
  const payload = await parseEnvelope<T>(res)
  if (!payload.success) {
    throw new AdminApiError(payload.error, res.status, payload.code, payload.details)
  }
  return payload.data
}

/** Mutate (POST/PATCH/PUT/DELETE) with JSON body. Throws AdminApiError on failure. */
export async function adminMutate<T>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
  opts?: { successMessage?: string },
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await parseEnvelope<T>(res)
  if (!payload.success) {
    throw new AdminApiError(payload.error, res.status, payload.code, payload.details)
  }
  if (opts?.successMessage) {
    toast.success(payload.message ?? opts.successMessage)
  }
  return payload.data
}

// ─── Image upload ─────────────────────────────────────────────────────────────

export type AdminUploadCategory =
  | "gallery"
  | "sponsorLogo"
  | "speakerPhoto"
  | "partnerLogo"

export type AdminUploadResult = {
  key: string
  relativeUrl: string
  absoluteUrl: string
  sizeBytes: number
  mimeType: string
}

/**
 * Upload an image for admin-managed content. The server re-validates
 * everything (size, extension, MIME, magic bytes, Sharp re-encode).
 */
export async function adminUploadImage(
  file: File,
  category: AdminUploadCategory,
): Promise<AdminUploadResult> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("category", category)

  const res = await fetch("/api/admin/upload", {
    method: "POST",
    body: formData,
  })
  const payload = await parseEnvelope<AdminUploadResult>(res)
  if (!payload.success) {
    throw new AdminApiError(payload.error, res.status, payload.code, payload.details)
  }
  return payload.data
}
