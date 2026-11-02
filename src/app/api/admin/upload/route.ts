// =============================================================================
// POST /api/admin/upload
// Admin image upload (gallery, sponsor logos, speaker photos, partner logos).
//
// SECURITY:
// - Admin permission required (per-category permission, checked server-side)
// - Rate limited per admin (shared fileUpload bucket)
// - Validated: extension + MIME + magic bytes + size (server-side)
// - SVG is rejected outright (script-injection vector) — raster only
// - All images re-encoded with Sharp → EXIF stripped, auto-oriented, resized, WebP
// - Stored in PUBLIC storage (public/uploads/<folder>/)
// - Returns BOTH a relative key and an absolute URL; admin forms store the
//   absolute URL in logoKey/photoKey/imageKey fields (public pages render
//   images when the stored value starts with "http")
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { extractIpAddress, extractUserAgent, auditLog } from "@/lib/audit"
import { ERROR_MESSAGES } from "@/lib/constants"
import { type Permission, requirePermission } from "@/lib/rbac"
import { sanitizeFilename, validateFile } from "@/lib/security/file-validation"
import {
  checkRateLimit,
  rateLimitExceededResponse,
} from "@/lib/security/rate-limit"
import { type PublicStorageFolder, savePublicUpload } from "@/lib/storage"
import { errorResponse, successResponse } from "@/lib/utils"

export const runtime = "nodejs"

// Category → validation config + storage folder + required permission.
// speakerPhoto / partnerLogo reuse the sponsorLogo validator (5MB raster
// image) but are forced raster-only below (SVG always rejected).
const SCOPE_MAP = {
  gallery: {
    validator: "gallery" as const,
    folder: "gallery",
    permission: "gallery:edit",
    maxDimension: 2400,
    label: "Gallery image",
  },
  sponsorLogo: {
    validator: "sponsorLogo" as const,
    folder: "sponsors",
    permission: "sponsors:edit",
    maxDimension: 800,
    label: "Sponsor logo",
  },
  speakerPhoto: {
    validator: "sponsorLogo" as const,
    folder: "speakers",
    permission: "speakers:edit",
    maxDimension: 1200,
    label: "Speaker photo",
  },
  partnerLogo: {
    validator: "sponsorLogo" as const,
    folder: "partners",
    permission: "partners:edit",
    maxDimension: 1200,
    label: "Partner logo",
  },
} satisfies Record<
  string,
  {
    validator: "gallery" | "sponsorLogo"
    folder: PublicStorageFolder
    permission: Permission
    maxDimension: number
    label: string
  }
>

type UploadCategory = keyof typeof SCOPE_MAP

function isUploadCategory(value: unknown): value is UploadCategory {
  return typeof value === "string" && value in SCOPE_MAP
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Parse multipart first (need category to pick the permission) ─────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      errorResponse("Invalid upload request.", "VALIDATION"),
      { status: 400 },
    )
  }

  const categoryEntry = formData.get("category")
  if (!isUploadCategory(categoryEntry)) {
    return NextResponse.json(
      errorResponse("Unsupported upload category.", "VALIDATION"),
      { status: 400 },
    )
  }

  const config = SCOPE_MAP[categoryEntry]

  // ── Permission check (server-side, per category) ─────────────────────────
  const { session, error } = await requirePermission(config.permission)
  if (error) {return error}

  const rate = await checkRateLimit("fileUpload", session.user.id)
  if (!rate.success) {return rateLimitExceededResponse(rate.retryAfter)}

  const fileEntry = formData.get("file")
  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      errorResponse("No file provided.", "VALIDATION"),
      { status: 400 },
    )
  }

  // ── SVG rejection — images only, raster only ─────────────────────────────
  const ext = fileEntry.name.toLowerCase().slice(fileEntry.name.lastIndexOf("."))
  if (
    fileEntry.type.toLowerCase() === "image/svg+xml" ||
    ext === ".svg"
  ) {
    return NextResponse.json(
      errorResponse(
        "SVG files are not accepted. Upload a PNG, JPG or WebP image.",
        "VALIDATION",
      ),
      { status: 422 },
    )
  }

  // ── Server-side validation (size, extension, MIME, magic bytes) ──────────
  const validation = await validateFile(fileEntry, config.validator)
  if (!validation.valid) {
    return NextResponse.json(
      errorResponse(validation.error, "VALIDATION"),
      { status: 422 },
    )
  }

  // ── Sharp re-encode → strips EXIF/GPS, auto-orients, caps dimensions ─────
  let outputBuffer: Buffer
  try {
    const inputBuffer = Buffer.from(await fileEntry.arrayBuffer())
    const sharp = (await import("sharp")).default
    outputBuffer = await sharp(inputBuffer, { failOn: "error" })
      .rotate()
      .resize({
        width: config.maxDimension,
        height: config.maxDimension,
        fit: categoryEntry === "sponsorLogo" ? "contain" : "inside",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
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

  // ── Persist to public storage ────────────────────────────────────────────
  let key: string
  let sizeBytes: number
  try {
    const saved = await savePublicUpload(outputBuffer, config.folder, "webp")
    key = saved.key
    sizeBytes = saved.sizeBytes
  } catch (err) {
    console.error("[POST /api/admin/upload] storage write failed:", err)
    return NextResponse.json(
      errorResponse(ERROR_MESSAGES.INTERNAL, "INTERNAL"),
      { status: 500 },
    )
  }

  const relativeUrl = `/uploads/${key}`
  const absoluteUrl = `${request.nextUrl.origin}${relativeUrl}`

  // ── Audit trail ──────────────────────────────────────────────────────────
  await auditLog({
    actorId: session.user.id,
    action: "ADMIN_FILE_UPLOADED",
    targetType: "Upload",
    metadata: {
      key,
      category: categoryEntry,
      sizeBytes,
      originalName: sanitizeFilename(fileEntry.name),
    },
    ipAddress: extractIpAddress(request),
    userAgent: extractUserAgent(request),
  })

  return NextResponse.json(
    successResponse({
      key,
      relativeUrl,
      absoluteUrl,
      sizeBytes,
      mimeType: "image/webp",
    }),
    { status: 201 },
  )
}
