// =============================================================================
// POST /api/upload/document
// Student ID / document upload for the registration wizard.
//
// SECURITY:
// - Authenticated users only (bound to session userId)
// - Rate limited per user
// - Validated: extension + MIME + magic bytes + size (server-side)
// - Re-encoded with Sharp → EXIF stripped, auto-oriented, resized, WebP
// - Stored in PRIVATE storage — never web-accessible directly
// - Returns a signed upload token (binds the file to this user + expiry)
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { extractIpAddress, extractUserAgent, auditLog } from "@/lib/audit"
import { ERROR_MESSAGES, type FILE_UPLOAD } from "@/lib/constants"
import { requireAuth } from "@/lib/rbac"
import { validateFile, sanitizeFilename } from "@/lib/security/file-validation"
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit"
import { createSignedUploadToken, savePrivateUpload } from "@/lib/storage"
import { errorResponse, successResponse } from "@/lib/utils"

export const runtime = "nodejs"

// Scope → file category mapping. Only student IDs are uploadable this phase.
const SCOPE_MAP = {
  studentId: { category: "student-ids" as const, validator: "studentId" as const },
} satisfies Record<string, { category: "student-ids"; validator: keyof typeof FILE_UPLOAD }>

type UploadScope = keyof typeof SCOPE_MAP

function isUploadScope(value: unknown): value is UploadScope {
  return typeof value === "string" && value in SCOPE_MAP
}

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

  const { category, validator } = SCOPE_MAP[scopeEntry]

  // ── Server-side validation (size, extension, MIME, magic bytes) ─────────
  const validation = await validateFile(fileEntry, validator)
  if (!validation.valid) {
    return NextResponse.json(
      errorResponse(validation.error, "VALIDATION"),
      { status: 422 },
    )
  }

  // ── Re-encode with Sharp: strips EXIF/GPS, auto-orients, caps dimensions ─
  let outputBuffer: Buffer
  try {
    const inputBuffer = Buffer.from(await fileEntry.arrayBuffer())
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
  } catch {
    return NextResponse.json(
      errorResponse(ERROR_MESSAGES.FILE_CORRUPTED, "VALIDATION"),
      { status: 422 },
    )
  }

  // ── Persist to private storage ───────────────────────────────────────────
  let key: string
  let sizeBytes: number
  try {
    const saved = await savePrivateUpload(outputBuffer, category, "webp")
    key = saved.key
    sizeBytes = saved.sizeBytes
  } catch (err) {
    console.error("[POST /api/upload/document] storage write failed:", err)
    return NextResponse.json(
      errorResponse(ERROR_MESSAGES.INTERNAL, "INTERNAL"),
      { status: 500 },
    )
  }

  // ── Signed token binds this upload to the user (no raw keys trusted later)
  const token = createSignedUploadToken({
    key,
    userId: session.user.id,
    sizeBytes,
  })

  // ── Audit trail ──────────────────────────────────────────────────────────
  await auditLog({
    actorId: session.user.id,
    action: "STUDENT_ID_UPLOADED",
    targetType: "StudentVerification",
    metadata: { key, sizeBytes, originalName: sanitizeFilename(fileEntry.name) },
    ipAddress: extractIpAddress(request),
    userAgent: extractUserAgent(request),
  })

  return NextResponse.json(
    successResponse({
      key,
      token,
      fileName: sanitizeFilename(fileEntry.name),
      sizeBytes,
      mimeType: "image/webp",
    }),
    { status: 201 },
  )
}
