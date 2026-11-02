// =============================================================================
// DIU_CYBERCON 2026 — Utility Functions
// Pure, side-effect-free helpers used across the application.
// =============================================================================

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// ─── Tailwind class merging ───────────────────────────────────────────────────

/**
 * Merge Tailwind classes safely, resolving conflicts.
 * Usage: cn("px-4 py-2", condition && "bg-cyan", "text-sm")
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ─── String utilities ─────────────────────────────────────────────────────────

/**
 * Trim and normalize whitespace in a string.
 * Collapses internal multiple spaces into one.
 */
export function normalizeString(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

/**
 * Convert a string to a URL-safe slug.
 * "Capture The Flag!" → "capture-the-flag"
 */
export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Truncate a string to a max length, appending "…" if needed.
 */
export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {return value}
  return value.slice(0, maxLength - 1) + "…"
}

/**
 * Capitalize the first letter of each word.
 */
export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase())
}

/**
 * Mask sensitive data for logging (e.g. email, phone).
 * "john@example.com" → "j***@example.com"
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!local || !domain) {return "***"}
  const visible = local[0] ?? "*"
  return `${visible}***@${domain}`
}

/**
 * Mask phone number — show last 4 digits only.
 * "+8801712345678" → "**********5678"
 */
export function maskPhone(phone: string): string {
  if (phone.length <= 4) {return "****"}
  return "*".repeat(phone.length - 4) + phone.slice(-4)
}

// ─── Number formatting ────────────────────────────────────────────────────────

/**
 * Format a number with thousand separators.
 * 1000000 → "10,00,000" (South Asian style) or "1,000,000" (international)
 */
export function formatNumber(value: number, locale = "en-IN"): string {
  return new Intl.NumberFormat(locale).format(value)
}

/**
 * Format bytes into human-readable size.
 * 5242880 → "5.0 MB"
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) {return "0 B"}
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

// ─── Date / Time utilities ────────────────────────────────────────────────────

/**
 * Format a Date for display.
 * Returns "24 October 2026" by default.
 */
export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  },
  locale = "en-GB",
): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat(locale, options).format(d)
}

/**
 * Format a Date as a short date.
 * Returns "24 Oct 2026"
 */
export function formatDateShort(date: Date | string): string {
  return formatDate(date, { day: "numeric", month: "short", year: "numeric" })
}

/**
 * Format a Date as time.
 * Returns "09:00 AM"
 */
export function formatTime(date: Date | string, use24h = false): string {
  const d = typeof date === "string" ? new Date(date) : date
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: !use24h,
  }).format(d)
}

/**
 * Calculate time remaining until a target date.
 * Returns { days, hours, minutes, seconds } — all non-negative.
 */
export function getTimeRemaining(target: Date | string): {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
  isPast: boolean
} {
  const targetDate = typeof target === "string" ? new Date(target) : target
  const total = targetDate.getTime() - Date.now()
  const isPast = total <= 0

  if (isPast) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0, isPast: true }
  }

  const seconds = Math.floor((total / 1000) % 60)
  const minutes = Math.floor((total / 1000 / 60) % 60)
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24)
  const days = Math.floor(total / (1000 * 60 * 60 * 24))

  return { days, hours, minutes, seconds, total, isPast: false }
}

/**
 * Check if a deadline has passed.
 */
export function isDeadlinePassed(deadline: Date | string): boolean {
  const d = typeof deadline === "string" ? new Date(deadline) : deadline
  return d.getTime() < Date.now()
}

/**
 * Get a relative time string.
 * "2 hours ago", "in 3 days"
 */
export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  const diffMs = d.getTime() - Date.now()
  const diffSec = Math.round(diffMs / 1000)
  const diffMin = Math.round(diffSec / 60)
  const diffHrs = Math.round(diffMin / 60)
  const diffDays = Math.round(diffHrs / 24)

  if (Math.abs(diffSec) < 60) {return rtf.format(diffSec, "second")}
  if (Math.abs(diffMin) < 60) {return rtf.format(diffMin, "minute")}
  if (Math.abs(diffHrs) < 24) {return rtf.format(diffHrs, "hour")}
  return rtf.format(diffDays, "day")
}

// ─── File utilities ───────────────────────────────────────────────────────────

/**
 * Extract the file extension from a filename (lowercase, with dot).
 * "photo.JPG" → ".jpg"
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".")
  if (lastDot === -1) {return ""}
  return filename.slice(lastDot).toLowerCase()
}

/**
 * Generate a random filename with original extension.
 * Prevents directory traversal and overwrites.
 * "my photo.jpg" → "a3f9b2c1d4e5.jpg"
 */
export function randomizeFilename(originalName: string): string {
  const ext = getFileExtension(originalName)
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 16)
  return `${random}${ext}`
}

/**
 * Build a Cloudinary folder path for a given category.
 */
export function getCloudinaryPath(
  category: "studentId" | "projectImage" | "posterFile" | "sponsorLogo" | "gallery",
): string {
  const paths: Record<typeof category, string> = {
    studentId: process.env.CLOUDINARY_PRIVATE_FOLDER ?? "cybercon2026/private/student-ids",
    projectImage: `${process.env.CLOUDINARY_PUBLIC_FOLDER ?? "cybercon2026/public"}/projects`,
    posterFile: `${process.env.CLOUDINARY_PUBLIC_FOLDER ?? "cybercon2026/public"}/posters`,
    sponsorLogo: process.env.CLOUDINARY_SPONSORS_FOLDER ?? "cybercon2026/public/sponsors",
    gallery: `${process.env.CLOUDINARY_PUBLIC_FOLDER ?? "cybercon2026/public"}/gallery`,
  }
  return paths[category]
}

// ─── API response helpers ─────────────────────────────────────────────────────

/**
 * Standard success response shape.
 */
export function successResponse<T>(data: T, message?: string) {
  return { success: true as const, data, ...(message ? { message } : {}) }
}

/**
 * Standard error response shape — never exposes internals.
 */
export function errorResponse(
  message: string,
  code?: string,
  details?: Record<string, string[]>,
) {
  return {
    success: false as const,
    error: message,
    ...(code ? { code } : {}),
    ...(details ? { details } : {}),
  }
}

// ─── Pagination helpers ───────────────────────────────────────────────────────

/**
 * Calculate skip/take values from page + pageSize.
 */
export function getPaginationParams(
  page: number,
  pageSize: number,
  maxPageSize = 100,
): { skip: number; take: number; page: number; pageSize: number } {
  const safePage = Math.max(1, Math.floor(page))
  const safePageSize = Math.min(Math.max(1, Math.floor(pageSize)), maxPageSize)
  return {
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
    page: safePage,
    pageSize: safePageSize,
  }
}

/**
 * Build pagination metadata for API responses.
 */
export function paginationMeta(
  total: number,
  page: number,
  pageSize: number,
): {
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
} {
  const totalPages = Math.ceil(total / pageSize)
  return {
    total,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  }
}

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * Validate a Bangladeshi phone number.
 * Accepts: +8801XXXXXXXXX, 01XXXXXXXXX (11 digits), 8801XXXXXXXXX
 */
export function isValidBDPhone(phone: string): boolean {
  const cleaned = phone.replace(/\s|-/g, "")
  return /^(?:\+88|88)?01[3-9]\d{8}$/.test(cleaned)
}

/**
 * Validate a URL (http/https only).
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ["http:", "https:"].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Check if a string is a valid GitHub URL.
 */
export function isValidGithubUrl(url: string): boolean {
  if (!isValidUrl(url)) {return false}
  return new URL(url).hostname === "github.com"
}

// ─── Object utilities ─────────────────────────────────────────────────────────

/**
 * Remove undefined/null keys from an object (for Prisma where clauses).
 */
export function removeNullish<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined),
  ) as Partial<T>
}

/**
 * Pick specific keys from an object.
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  return Object.fromEntries(
    keys.filter((k) => k in obj).map((k) => [k, obj[k]]),
  ) as Pick<T, K>
}

/**
 * Omit specific keys from an object.
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const keysSet = new Set(keys as string[])
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => !keysSet.has(k)),
  ) as Omit<T, K>
}

// ─── Array utilities ──────────────────────────────────────────────────────────

/**
 * Group an array of objects by a key.
 */
export function groupBy<T>(
  array: T[],
  key: keyof T,
): Record<string, T[]> {
  return array.reduce(
    (result, item) => {
      const group = String(item[key])
      return {
        ...result,
        [group]: [...(result[group] ?? []), item],
      }
    },
    {} as Record<string, T[]>,
  )
}

/**
 * Shuffle an array (Fisher-Yates).
 * Returns a new array — does not mutate the original.
 */
export function shuffle<T>(array: T[]): T[] {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}
