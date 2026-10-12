// =============================================================================
// PATCH  /api/admin/panels/[id] — update a panel ("panels:edit")
// DELETE /api/admin/panels/[id] — delete a panel ("panels:edit")
//
// When `panelists` is present in a PATCH body the lineup is fully replaced
// inside one transaction (delete → recreate), and the before/after audit
// entry captures both lineups. Panelist → Panel is onDelete: Cascade, but
// the join rows are cleared explicitly so deletion is deterministic.
//
// Clearing semantics: moderatorId/time/venue transform "" → undefined in the
// schema, so the raw body keys are inspected — a present-but-empty key
// clears the column to NULL. An explicit null `sessionDate` clears the date
// (z.coerce.date() would otherwise turn null into the Unix epoch).
// =============================================================================

import { Prisma } from "@prisma/client"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { panelUpdateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/** Shared include: panelists ordered by speaker name with speaker identity. */
const PANEL_INCLUDE = {
  panelists: {
    orderBy: { speaker: { name: "asc" } },
    select: {
      id: true,
      role: true,
      speaker: {
        select: { id: true, name: true, organization: true, photoKey: true },
      },
    },
  },
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasKey(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

/** First occurrence per speaker wins — Panelist has @@unique([panelId, speakerId]). */
function dedupePanelists(
  panelists: ReadonlyArray<{ speakerId: string; role?: string | undefined }>,
): Array<{ speakerId: string; role: string | null }> {
  const seen = new Set<string>()
  const rows: Array<{ speakerId: string; role: string | null }> = []
  for (const panelist of panelists) {
    if (seen.has(panelist.speakerId)) {continue}
    seen.add(panelist.speakerId)
    rows.push({ speakerId: panelist.speakerId, role: panelist.role ?? null })
  }
  return rows
}

/** Plain snapshot for audit payloads — Dates become ISO strings. */
function panelSnapshot(panel: {
  topic: string
  description: string | null
  moderatorId: string | null
  sessionDate: Date | null
  startTime: string | null
  endTime: string | null
  venue: string | null
  status: string
  displayOrder: number
  panelists: ReadonlyArray<{
    role: string | null
    speaker: { id: string }
  }>
}): Record<string, unknown> {
  return {
    topic: panel.topic,
    description: panel.description,
    moderatorId: panel.moderatorId,
    sessionDate: panel.sessionDate ? panel.sessionDate.toISOString() : null,
    startTime: panel.startTime,
    endTime: panel.endTime,
    venue: panel.venue,
    status: panel.status,
    displayOrder: panel.displayOrder,
    speakerIds: panel.panelists.map((p) => p.speaker.id),
    panelists: panel.panelists.map((p) => ({
      speakerId: p.speaker.id,
      role: p.role,
    })),
  }
}

async function assertSpeakersExist(speakerIds: string[]): Promise<void> {
  if (speakerIds.length === 0) {return}
  const found = await prisma.speaker.count({ where: { id: { in: speakerIds } } })
  if (found !== speakerIds.length) {
    throw new AdminError(
      "One or more selected speakers no longer exist. Refresh the page and try again.",
      "UNKNOWN_SPEAKER",
      400,
    )
  }
}

// ─── PATCH — update panel ─────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("panels:edit")
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

    const parsed = panelUpdateSchema.safeParse(body)
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

    const existing = await prisma.panel.findUnique({
      where: { id },
      include: PANEL_INCLUDE,
    })
    if (!existing) {
      throw new AdminError("Panel not found.", "NOT_FOUND", 404)
    }

    const data = parsed.data
    const raw = isRecord(body) ? body : {}
    const updateData: Prisma.PanelUpdateInput = {}

    if (data.topic !== undefined) {updateData.topic = data.topic}
    if (data.status !== undefined) {updateData.status = data.status}
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

    // Explicit null clears the date (undefined leaves it untouched).
    if (raw.sessionDate === null) {
      updateData.sessionDate = null
    } else if (data.sessionDate !== undefined) {
      updateData.sessionDate = data.sessionDate
    }

    if (data.moderatorId !== undefined) {
      const moderator = await prisma.speaker.findUnique({
        where: { id: data.moderatorId },
        select: { id: true },
      })
      if (!moderator) {
        throw new AdminError(
          "The selected moderator no longer exists. Refresh the page and try again.",
          "UNKNOWN_MODERATOR",
          400,
        )
      }
      updateData.moderatorId = data.moderatorId
    } else if (hasKey(raw, "moderatorId")) {
      updateData.moderatorId = null
    }

    if (data.startTime !== undefined) {
      updateData.startTime = data.startTime
    } else if (hasKey(raw, "startTime")) {
      updateData.startTime = null
    }

    if (data.endTime !== undefined) {
      updateData.endTime = data.endTime
    } else if (hasKey(raw, "endTime")) {
      updateData.endTime = null
    }

    if (data.venue !== undefined) {
      updateData.venue = data.venue
    } else if (hasKey(raw, "venue")) {
      updateData.venue = null
    }

    // When provided, the panelist lineup is fully replaced.
    const replacePanelists = data.panelists !== undefined
    const panelistRows = replacePanelists
      ? dedupePanelists(data.panelists ?? [])
      : []
    if (replacePanelists) {
      await assertSpeakersExist(panelistRows.map((p) => p.speakerId))
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.panel.update({ where: { id }, data: updateData })

      if (replacePanelists) {
        await tx.panelist.deleteMany({ where: { panelId: id } })
        if (panelistRows.length > 0) {
          await tx.panelist.createMany({
            data: panelistRows.map((p) => ({
              panelId: id,
              speakerId: p.speakerId,
              role: p.role,
            })),
          })
        }
      }

      return tx.panel.findUniqueOrThrow({
        where: { id },
        include: PANEL_INCLUDE,
      })
    })

    await auditLog({
      actorId: session.user.id,
      action: "PANEL_UPDATED",
      targetType: "Panel",
      targetId: id,
      before: panelSnapshot(existing),
      after: panelSnapshot(updated),
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(successResponse(updated, "Panel updated."))
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/panels/[id]")
  }
}

// ─── DELETE — delete panel ────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("panels:edit")
    if (error) {return error}

    const { id } = await params

    const existing = await prisma.panel.findUnique({
      where: { id },
      include: PANEL_INCLUDE,
    })
    if (!existing) {
      throw new AdminError("Panel not found.", "NOT_FOUND", 404)
    }

    // Panelist → Panel is onDelete: Cascade, but clear the join rows first
    // so the delete is deterministic regardless of DB-level settings.
    await prisma.$transaction([
      prisma.panelist.deleteMany({ where: { panelId: id } }),
      prisma.panel.delete({ where: { id } }),
    ])

    await auditLog({
      actorId: session.user.id,
      action: "PANEL_DELETED",
      targetType: "Panel",
      targetId: id,
      before: panelSnapshot(existing),
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(successResponse({ id }, "Panel deleted."))
  } catch (err) {
    return adminErrorResponse(err, "DELETE /api/admin/panels/[id]")
  }
}
