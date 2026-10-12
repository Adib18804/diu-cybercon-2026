// =============================================================================
// PATCH  /api/admin/announcements/[id] — edit an announcement (announcements:edit)
// DELETE /api/admin/announcements/[id] — soft-delete an announcement (announcements:edit)
//
// Announcements are soft-deleted: DELETE stamps deletedAt and the row stays in
// the database (list queries exclude it). PATCH only writes the fields that
// actually changed and records them in the audit trail; publishing a draft for
// the first time stamps publishedAt and is audited as ANNOUNCEMENT_PUBLISHED.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { announcementUpdateSchema } from "@/lib/validations/admin"

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

// ─── PATCH — edit an announcement ─────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("announcements:edit")
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

    const parsed = announcementUpdateSchema.safeParse(body)
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

    const existing = await prisma.announcement.findUnique({ where: { id } })
    if (!existing || existing.deletedAt) {
      throw new AdminError("Announcement not found.", "NOT_FOUND", 404)
    }

    const data = parsed.data

    // Publishing a draft for the first time stamps publishedAt.
    const nowPublishing = !existing.isPublished && data.isPublished === true
    const stampPublishedAt =
      nowPublishing && existing.publishedAt === null ? new Date() : undefined

    const updateData = {
      ...data,
      ...(stampPublishedAt !== undefined
        ? { publishedAt: stampPublishedAt }
        : {}),
    }

    // Only the fields present in the payload and different from the stored
    // row belong in the audit trail.
    const currentValues: Record<string, AuditValue> = {
      title: existing.title,
      content: existing.content,
      isPinned: existing.isPinned,
      isPublished: existing.isPublished,
      publishedAt: toAuditValue(existing.publishedAt),
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

    const updated = await prisma.announcement.update({
      where: { id },
      data: updateData,
    })

    const updatedValues: Record<string, AuditValue> = {
      title: updated.title,
      content: updated.content,
      isPinned: updated.isPinned,
      isPublished: updated.isPublished,
      publishedAt: toAuditValue(updated.publishedAt),
    }

    const after: Record<string, AuditValue> = {}
    for (const key of changedKeys) {
      after[key] = toAuditValue(updatedValues[key])
    }

    await auditLog({
      actorId: session.user.id,
      action: nowPublishing ? "ANNOUNCEMENT_PUBLISHED" : "ANNOUNCEMENT_UPDATED",
      targetType: "Announcement",
      targetId: id,
      before,
      after,
      metadata: { title: updated.title, changedKeys },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse(updated, "Announcement updated."),
    )
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/announcements/[id]")
  }
}

// ─── DELETE — soft-delete an announcement ─────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("announcements:edit")
    if (error) {return error}

    const { id } = await params

    const existing = await prisma.announcement.findUnique({
      where: { id },
      select: { id: true, title: true, isPublished: true, deletedAt: true },
    })
    if (!existing || existing.deletedAt) {
      throw new AdminError("Announcement not found.", "NOT_FOUND", 404)
    }

    const deletedAt = new Date()

    // Soft delete — the row is kept for the audit trail and is excluded from
    // every list query by its deletedAt filter.
    await prisma.announcement.update({
      where: { id },
      data: { deletedAt },
    })

    await auditLog({
      actorId: session.user.id,
      action: "ANNOUNCEMENT_DELETED",
      targetType: "Announcement",
      targetId: id,
      before: {
        title: existing.title,
        isPublished: existing.isPublished,
      },
      metadata: {
        title: existing.title,
        softDelete: true,
        deletedAt: deletedAt.toISOString(),
      },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse({ id }, "Announcement deleted."),
    )
  } catch (err) {
    return adminErrorResponse(err, "DELETE /api/admin/announcements/[id]")
  }
}
