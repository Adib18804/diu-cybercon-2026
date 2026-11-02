// =============================================================================
// DIU_CYBERCON 2026 — Server-side File Validation
// Validates extension + MIME type + magic bytes + size.
// NEVER trust client-supplied MIME types alone.
// =============================================================================

import { FILE_UPLOAD, MAGIC_BYTES } from "@/lib/constants"

export type FileCategory = keyof typeof FILE_UPLOAD

export type FileValidationResult =
  | { valid: true }
  | { valid: false; error: string }

/**
 * Read the first N bytes of a file for magic byte inspection.
 */
async function readMagicBytes(file: File, count = 16): Promise<Uint8Array> {
  const slice = file.slice(0, count)
  const buffer = await slice.arrayBuffer()
  return new Uint8Array(buffer)
}

/**
 * Check if the file's magic bytes match the expected MIME type.
 */
function validateMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType]
  if (!signatures) {return true} // No signature registered — skip check

  return signatures.some((sig) => {
    if (mimeType === "image/webp") {
      // RIFF....WEBP — check offset 8 for "WEBP"
      if (bytes.length < 12) {return false}
      const riff = sig.every((b, i) => bytes[i] === b)
      const webp =
        bytes[8] === 0x57 && // W
        bytes[9] === 0x45 && // E
        bytes[10] === 0x42 && // B
        bytes[11] === 0x50 // P
      return riff && webp
    }
    return sig.every((b, i) => bytes[i] === b)
  })
}

/**
 * Full server-side file validation:
 * 1. File size check
 * 2. Extension whitelist
 * 3. MIME type whitelist
 * 4. Magic byte verification
 *
 * Call this on the SERVER — never trust client validation alone.
 */
export async function validateFile(
  file: File,
  category: FileCategory,
): Promise<FileValidationResult> {
  const config = FILE_UPLOAD[category]

  // ── 1. Size ────────────────────────────────────────────────────────────
  if (file.size > config.maxSizeBytes) {
    const maxMB = (config.maxSizeBytes / (1024 * 1024)).toFixed(0)
    return {
      valid: false,
      error: `File exceeds the maximum allowed size of ${maxMB}MB.`,
    }
  }

  if (file.size === 0) {
    return { valid: false, error: "File is empty." }
  }

  // ── 2. Extension ───────────────────────────────────────────────────────
  const fileName = file.name.toLowerCase()
  const ext = fileName.slice(fileName.lastIndexOf("."))
  const allowedExts = config.allowedExtensions as readonly string[]

  if (!ext || !allowedExts.includes(ext)) {
    return {
      valid: false,
      error: `File type not allowed. Accepted formats: ${allowedExts.join(", ")}.`,
    }
  }

  // ── 3. MIME type ───────────────────────────────────────────────────────
  const clientMime = file.type.toLowerCase()
  const allowedMimes = config.allowedMimeTypes as readonly string[]

  if (!allowedMimes.includes(clientMime)) {
    return {
      valid: false,
      error: `File type not allowed. Accepted types: ${allowedMimes.join(", ")}.`,
    }
  }

  // ── 4. Magic bytes ─────────────────────────────────────────────────────
  try {
    const magicBytes = await readMagicBytes(file)
    const magicValid = validateMagicBytes(magicBytes, clientMime)

    if (!magicValid) {
      return {
        valid: false,
        error:
          "File content does not match its declared type. Please upload a valid file.",
      }
    }
  } catch {
    return {
      valid: false,
      error: "File could not be read. Please try again.",
    }
  }

  // ── 5. Reject executable/script types ─────────────────────────────────
  const dangerousMimes = [
    "application/x-msdownload",
    "application/x-executable",
    "application/x-sh",
    "text/x-php",
    "application/x-php",
    "text/javascript",
    "application/javascript",
    "application/x-javascript",
  ]

  if (dangerousMimes.includes(clientMime)) {
    return { valid: false, error: "Executable files are not allowed." }
  }

  const dangerousExts = [
    ".exe", ".dll", ".bat", ".cmd", ".sh", ".php",
    ".js", ".ts", ".py", ".rb", ".pl", ".asp", ".aspx",
    ".jsp", ".cgi", ".htaccess", ".env",
  ]

  if (dangerousExts.some((e) => fileName.endsWith(e))) {
    return { valid: false, error: "This file type is not permitted." }
  }

  return { valid: true }
}

/**
 * Sanitize a filename for safe storage.
 * - Removes path components
 * - Removes non-alphanumeric chars except hyphens/underscores/dots
 * - Lowercases the extension
 */
export function sanitizeFilename(filename: string): string {
  // Strip any path components
  const base = filename.replace(/.*[\\/]/, "")

  // Split into name + extension
  const lastDot = base.lastIndexOf(".")
  if (lastDot === -1) {return base.replace(/[^a-zA-Z0-9-_]/g, "_")}

  const name = base.slice(0, lastDot).replace(/[^a-zA-Z0-9-_]/g, "_")
  const ext = base.slice(lastDot).toLowerCase()

  return `${name}${ext}`
}
