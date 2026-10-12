// =============================================================================
// PATCH  /api/admin/gallery/[id] — edit a gallery image (gallery:edit)
// DELETE /api/admin/gallery/[id] — hard-delete a gallery image (gallery:edit)
//
// PATCH accepts any subset of the gallery fields; the schema's `imageUrl`
// maps onto the model's required `imageKey` column (only written when a new
// image URL is actually provided). An explicit empty `title` clears the
// optional caption. Only the fields that actually changed are recorded in
// the audit trail.
//
// DELETE removes the row and best-effort deletes the stored public file —
// a storage cleanup failure never blocks the delete itself.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { deletePublicFile } from "@/lib/storage"
import { errorResponse, successResponse } from "@/lib/utils"
import { galleryUpdateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

type AuditValue = string | number | boolean | null

/** undefined/null → null, Date → ISO string, primitives kept, else stringified. */
function toAuditValue(value: unknown): AuditValue {
  if (value === undefined || value === null) {return null}
  if (value instanceof Date) {return value.toISOString()}
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value
  }
  return JSON.stringify(value) ?? null
}

/** Path marker that separates the origin from the storage key in stored URLs. */
const UPLOADS_MARKER = "/uploads/"

/** Extract `<folder>/<file>.<ext>` from a stored absolute /uploads/ URL. */
function storageKeyFromUrl(url: string): string | null {
  const markerIndex = url.indexOf(UPLOADS_MARKER)
  if (markerIndex === -1) {return null}
  const key = url.slice(markerIndex + UPLOADS_MARKER.length)
  return key.length > 0 ? key : null
}

// ─── PATCH — edit a gallery image ─────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("gallery:edit")
    if (error) {return error}

    const { id } = await params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        errorResponse("Invalid JSON body.", "INVALID_JSON"),
        { status: 400 },
      )
    }

    const parsed = galleryUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(
          "Please fix the highlighted fields and try again.",
          "VALIDATION",
          parsed.error.flatten().fieldErrors as Record<string, string[]>,
        ),
        { status: 422 },
      )
    }

    const existing = await prisma.galleryImage.findUnique({ where: { id } })
    if (!existing) {
      throw new AdminError("Gallery image not found.", "NOT_FOUND", 404)
    }

    const data = parsed.data
    const { imageUrl, ...rest } = data

    // `title: ""` transforms to undefined and disappears from the parsed
    // payload — an explicit empty title in the raw body means "clear it".
    const rawBodyHasTitle =
      typeof body === "object" &&
      body !== null &&
      Object.prototype.hasOwnProperty.call(body, "title")
    const clearingTitle = rawBodyHasTitle && data.title === undefined

    const updateData = {
      ...rest,
      ...(imageUrl !== undefined ? { imageKey: imageUrl } : {}),
      ...(clearingTitle ? { title: null } : {}),
    }

    // Only the fields present in the payload and different from the stored
    // row belong in the audit trail.
    const currentValues: Record<string, AuditValue> = {
      title: existing.title,
      imageKey: existing.imageKey,
      category: existing.category,
      altText: existing.altText,
      year: existing.year,
      displayOrder: existing.displayOrder,
      isPublished: existing.isPublished,
    }

    const changedKeys: string[] = []
    const before: Record<string, AuditValue> = {}
    for (const [key, value] of Object.entries(updateData)) {
      if (value === undefined) {continue}
      const current = currentValues[key]
      if (current === value) {continue}
      changedKeys.push(key)
      before[key] = toAuditValue(current)
    }

    const updated = await prisma.galleryImage.update({
      where: { id },
      data: updateData,
    })

    const updatedValues: Record<string, AuditValue> = {
      title: updated.title,
      imageKey: updated.imageKey,
      category: updated.category,
      altText: updated.altText,
      year: updated.year,
      displayOrder: updated.displayOrder,
      isPublished: updated.isPublished,
    }

    const after: Record<string, AuditValue> = {}
    for (const key of changedKeys) {
      after[key] = toAuditValue(updatedValues[key])
    }

    await auditLog({
      actorId: session.user.id,
      action: "GALLERY_IMAGE_UPDATED",
      targetType: "GalleryImage",
      targetId: id,
      before,
      after,
      metadata: { title: updated.title, changedKeys },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse(updated, "Gallery image updated."),
    )
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/gallery/[id]")
  }
}

// ─── DELETE — hard-delete a gallery image ─────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("gallery:edit")
    if (error) {return error}

    const { id } = await params

    const existing = await prisma.galleryImage.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        imageKey: true,
        category: true,
        year: true,
      },
    })
    if (!existing) {
      throw new AdminError("Gallery image not found.", "NOT_FOUND", 404)
    }

    await prisma.galleryImage.delete({ where: { id } })

    // Best-effort cleanup of the stored public file — never let a storage
    // failure (file already gone, unsafe key, etc.) block the delete.
    const storageKey = storageKeyFromUrl(existing.imageKey)
    if (storageKey) {
      try {
        await deletePublicFile(storageKey)
      } catch {
        // Non-fatal — the row is already removed.
      }
    }

    await auditLog({
      actorId: session.user.id,
      action: "GALLERY_IMAGE_DELETED",
      targetType: "GalleryImage",
      targetId: id,
      before: {
        title: existing.title,
        imageKey: existing.imageKey,
        category: existing.category,
        year: existing.year,
      },
      metadata: { title: existing.title, imageKey: existing.imageKey },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse({ id }, "Gallery image deleted."),
    )
  } catch (err) {
    return adminErrorResponse(err, "DELETE /api/admin/gallery/[id]")
  }
}
