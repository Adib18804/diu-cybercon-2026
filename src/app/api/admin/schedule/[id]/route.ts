// =============================================================================
// PATCH  /api/admin/schedule/[id] — update a schedule item ("schedule:edit")
// DELETE /api/admin/schedule/[id] — delete a schedule item ("schedule:edit")
//
// ScheduleItem.speakerId is a plain scalar column with NO Prisma relation, so
// speaker existence is validated manually. ScheduleItem.eventId DOES have a
// relation, so the update payload uses Prisma.ScheduleItemUncheckedUpdateInput
// to allow writing the foreign key directly.
//
// Clearing semantics: fields that transform "" → undefined in the schema are
// cleared by inspecting the raw body keys — a present key clears the column
// to NULL, an omitted key leaves it untouched. The "date" column is special:
// z.coerce.date() would silently turn null into the Unix epoch, so a null is
// rejected with a 422 before validation runs.
// =============================================================================

import { Prisma } from "@prisma/client"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { scheduleItemUpdateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasKey(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

/** Plain snapshot for audit payloads — Dates become ISO strings. */
function scheduleSnapshot(item: {
  day: number
  date: Date
  startTime: string
  endTime: string
  title: string
  description: string | null
  venue: string | null
  type: string
  eventId: string | null
  speakerId: string | null
  isHighlight: boolean
  displayOrder: number
}): Record<string, unknown> {
  return {
    day: item.day,
    date: item.date.toISOString(),
    startTime: item.startTime,
    endTime: item.endTime,
    title: item.title,
    description: item.description,
    venue: item.venue,
    type: item.type,
    eventId: item.eventId,
    speakerId: item.speakerId,
    isHighlight: item.isHighlight,
    displayOrder: item.displayOrder,
  }
}

// ─── PATCH — update schedule item ────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("schedule:edit")
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

    const raw = isRecord(body) ? body : {}

    // z.coerce.date() silently converts null to the Unix epoch — reject it.
    if (raw.date === null) {
      return NextResponse.json(
        errorResponse(
          "Please fix the highlighted fields and try again.",
          "VALIDATION",
          { date: ["Enter a valid date and time"] },
        ),
        { status: 422 },
      )
    }

    const parsed = scheduleItemUpdateSchema.safeParse(body)
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

    const existing = await prisma.scheduleItem.findUnique({ where: { id } })
    if (!existing) {
      throw new AdminError("Schedule item not found.", "NOT_FOUND", 404)
    }

    const data = parsed.data
    const updateData: Prisma.ScheduleItemUncheckedUpdateInput = {}

    if (data.day !== undefined) {updateData.day = data.day}
    if (data.date !== undefined) {updateData.date = data.date}
    if (data.startTime !== undefined) {updateData.startTime = data.startTime}
    if (data.endTime !== undefined) {updateData.endTime = data.endTime}
    if (data.title !== undefined) {updateData.title = data.title}
    if (data.type !== undefined) {updateData.type = data.type}
    if (data.isHighlight !== undefined) {
      updateData.isHighlight = data.isHighlight
    }
    if (data.displayOrder !== undefined) {
      updateData.displayOrder = data.displayOrder
    }

    // Long text keeps "" through validation — map it to NULL directly.
    if (data.description !== undefined) {
      updateData.description =
        data.description.length > 0 ? data.description : null
    } else if (hasKey(raw, "description")) {
      updateData.description = null
    }

    // Optional fields: "" was transformed away — a present key means "clear".
    if (data.venue !== undefined) {
      updateData.venue = data.venue
    } else if (hasKey(raw, "venue")) {
      updateData.venue = null
    }

    if (data.eventId !== undefined) {
      const event = await prisma.event.findUnique({
        where: { id: data.eventId },
        select: { id: true },
      })
      if (!event) {
        throw new AdminError(
          "The selected event does not exist.",
          "UNKNOWN_EVENT",
          400,
        )
      }
      updateData.eventId = data.eventId
    } else if (hasKey(raw, "eventId")) {
      updateData.eventId = null
    }

    if (data.speakerId !== undefined) {
      const speaker = await prisma.speaker.findUnique({
        where: { id: data.speakerId },
        select: { id: true },
      })
      if (!speaker) {
        throw new AdminError(
          "The selected speaker does not exist.",
          "UNKNOWN_SPEAKER",
          400,
        )
      }
      updateData.speakerId = data.speakerId
    } else if (hasKey(raw, "speakerId")) {
      updateData.speakerId = null
    }

    const updated = await prisma.scheduleItem.update({
      where: { id },
      data: updateData,
    })

    // Audit only the keys that actually changed.
    const beforeSnapshot = scheduleSnapshot(existing)
    const afterSnapshot = scheduleSnapshot(updated)
    const before: Record<string, unknown> = {}
    const after: Record<string, unknown> = {}
    for (const key of Object.keys(afterSnapshot)) {
      if (JSON.stringify(beforeSnapshot[key]) !== JSON.stringify(afterSnapshot[key])) {
        before[key] = beforeSnapshot[key]
        after[key] = afterSnapshot[key]
      }
    }

    await auditLog({
      actorId: session.user.id,
      action: "SCHEDULE_ITEM_UPDATED",
      targetType: "ScheduleItem",
      targetId: updated.id,
      before,
      after,
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(successResponse(updated, "Schedule item updated."))
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/schedule/[id]")
  }
}

// ─── DELETE — delete schedule item ───────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("schedule:edit")
    if (error) {return error}

    const { id } = await params

    const existing = await prisma.scheduleItem.findUnique({ where: { id } })
    if (!existing) {
      throw new AdminError("Schedule item not found.", "NOT_FOUND", 404)
    }

    await prisma.scheduleItem.delete({ where: { id } })

    await auditLog({
      actorId: session.user.id,
      action: "SCHEDULE_ITEM_DELETED",
      targetType: "ScheduleItem",
      targetId: id,
      before: scheduleSnapshot(existing),
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(successResponse({ id }, "Schedule item deleted."))
  } catch (err) {
    return adminErrorResponse(err, "DELETE /api/admin/schedule/[id]")
  }
}
