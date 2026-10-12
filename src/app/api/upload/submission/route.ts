// =============================================================================
// POST /api/upload/submission
// Public submission asset upload (project image, presentation, poster file).
//
// SECURITY:
// - Authenticated users only (bound to session userId)
// - Rate limited per user (shared fileUpload bucket)
// - Validated: extension + MIME + magic bytes + size (server-side)
// - Images re-encoded with Sharp → EXIF stripped, auto-oriented, resized, WebP
// - PDFs pass magic-byte validation and are stored byte-for-byte
// - Stored in PUBLIC storage (public/uploads/) — these assets are displayed
//   on the public showcase after admin approval; nothing sensitive here
// - Returns a signed upload token (binds the file to this user + expiry);
//   submission APIs only accept THIS token, never raw keys
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { extractIpAddress, extractUserAgent, auditLog } from "@/lib/audit"
import { ERROR_MESSAGES, type FILE_UPLOAD } from "@/lib/constants"
import { requireAuth } from "@/lib/rbac"
import { validateFile, sanitizeFilename } from "@/lib/security/file-validation"
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit"
import { createSignedUploadToken, savePublicUpload } from "@/lib/storage"
import { errorResponse, successResponse } from "@/lib/utils"

export const runtime = "nodejs"

// Scope → validator category + public folder. Images only for project images;
// posters/presentations accept PDF or image files.
const SCOPE_MAP = {
  projectImage: {
    validator: "projectImage" as const,
    folder: "projects" as const,
    label: "Project image",
  },
  presentationFile: {
    validator: "presentationFile" as const,
    folder: "presentations" as const,
    label: "Presentation file",
  },
  posterFile: {
    validator: "posterFile" as const,
    folder: "posters" as const,
    label: "Poster file",
  },
} satisfies Record<
  string,
  { validator: keyof typeof FILE_UPLOAD; folder: "projects" | "presentations" | "posters"; label: string }
>

type UploadScope = keyof typeof SCOPE_MAP

function isUploadScope(value: unknown): value is UploadScope {
  return typeof value === "string" && value in SCOPE_MAP
}

const PDF_MIME = "application/pdf"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { session, error } = await requireAuth()
  if (error) {return error}

  const rate = await checkRateLimit("fileUpload", session.user.id)
  if (!rate.success) {return rateLimitExceededResponse(rate.retryAfter)}

  // ── Parse multipart form ─────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      errorResponse("Invalid upload request.", "VALIDATION"),
      { status: 400 },
    )
  }

  const fileEntry = formData.get("file")
  const scopeEntry = formData.get("scope")

  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      errorResponse("No file provided.", "VALIDATION"),
      { status: 400 },
    )
  }

  if (!isUploadScope(scopeEntry)) {
    return NextResponse.json(
      errorResponse("Unsupported upload scope.", "VALIDATION"),
      { status: 400 },
    )
  }

  const { validator, folder } = SCOPE_MAP[scopeEntry]

  // ── Server-side validation (size, extension, MIME, magic bytes) ─────────
  const validation = await validateFile(fileEntry, validator)
  if (!validation.valid) {
    return NextResponse.json(
      errorResponse(validation.error, "VALIDATION"),
      { status: 422 },
    )
  }

  const isPdf = fileEntry.type.toLowerCase() === PDF_MIME

  // ── Process the file ─────────────────────────────────────────────────────
  // Images: Sharp re-encode → strips EXIF/GPS, auto-orients, caps dimensions.
  // PDFs:   magic bytes already verified; store the bytes unchanged.
  let outputBuffer: Buffer
  let extension: "webp" | "pdf"
  try {
    const inputBuffer = Buffer.from(await fileEntry.arrayBuffer())

    if (isPdf) {
      outputBuffer = inputBuffer
      extension = "pdf"
    } else {
      const sharp = (await import("sharp")).default
      outputBuffer = await sharp(inputBuffer, { failOn: "error" })
        .rotate() // apply EXIF orientation before stripping metadata
        .resize({
          width: 2400,
          height: 2400,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 88 })
        .toBuffer()
      extension = "webp"
    }
  } catch {
    return NextResponse.json(
      errorResponse(ERROR_MESSAGES.FILE_CORRUPTED, "VALIDATION"),
      { status: 422 },
    )
  }

  // ── Persist to public storage ────────────────────────────────────────────
  let key: string
  let sizeBytes: number
  let url: string
  try {
    const saved = await savePublicUpload(outputBuffer, folder, extension)
    key = saved.key
    sizeBytes = saved.sizeBytes
    url = saved.url
  } catch (err) {
    console.error("[POST /api/upload/submission] storage write failed:", err)
    return NextResponse.json(
      errorResponse(ERROR_MESSAGES.INTERNAL, "INTERNAL"),
      { status: 500 },
    )
  }

  // ── Signed token binds this upload to the user (submission APIs verify) ──
  const token = createSignedUploadToken({
    key,
    userId: session.user.id,
    sizeBytes,
  })

  // ── Audit trail ──────────────────────────────────────────────────────────
  await auditLog({
    actorId: session.user.id,
    action: "SUBMISSION_FILE_UPLOADED",
    targetType: "Upload",
    metadata: {
      key,
      scope: scopeEntry,
      sizeBytes,
      originalName: sanitizeFilename(fileEntry.name),
    },
    ipAddress: extractIpAddress(request),
    userAgent: extractUserAgent(request),
  })

  return NextResponse.json(
    successResponse({
      key,
      token,
      fileName: sanitizeFilename(fileEntry.name),
      sizeBytes,
      url,
      mimeType: isPdf ? PDF_MIME : "image/webp",
    }),
    { status: 201 },
  )
}
