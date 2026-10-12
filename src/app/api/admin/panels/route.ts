// =============================================================================
// GET  /api/admin/panels — paginated panel list ("panels:view")
// POST /api/admin/panels — create a panel ("panels:edit")
//
// Filters:
// - status: whitelisted EventStatus (DRAFT, OPEN, CLOSED, COMPLETED)
// - q:      topic
//
// Panelists are created in the same transaction as the panel and returned
// with their speaker identity so the table can render a lineup without a
// second fetch. The audit entry records the created lineup.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import {
  buildSearchOr,
  parseAdminListParams,
  parseEnumFilter,
} from "@/lib/admin/query"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, paginationMeta, successResponse } from "@/lib/utils"
import { panelCreateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PANEL_STATUS_FILTERS = ["DRAFT", "OPEN", "CLOSED", "COMPLETED"] as const

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

// ─── GET — panel list ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("panels:view")
    if (error) {return error}

    const { page, pageSize, skip, take, q } = parseAdminListParams(request)
    const status = parseEnumFilter(
      request.nextUrl.searchParams,
      "status",
      PANEL_STATUS_FILTERS,
    )

    if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
      return NextResponse.json(
        errorResponse("Invalid pagination parameters.", "VALIDATION"),
        { status: 400 },
      )
    }

    const searchOr = buildSearchOr(q, ["topic"])

    const where = {
      ...(status ? { status } : {}),
      ...(searchOr ? { OR: searchOr } : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.panel.findMany({
        where,
        skip,
        take,
        orderBy: [{ displayOrder: "asc" }, { sessionDate: "asc" }],
        include: PANEL_INCLUDE,
      }),
      prisma.panel.count({ where }),
    ])

    return NextResponse.json(
      successResponse({
        items,
        pagination: paginationMeta(total, page, pageSize),
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/panels")
  }
}

// ─── POST — create panel ──────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("panels:edit")
    if (error) {return error}

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        errorResponse("Invalid JSON body.", "INVALID_JSON"),
        { status: 400 },
      )
    }

    const parsed = panelCreateSchema.safeParse(body)
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

    const data = parsed.data
    const raw = isRecord(body) ? body : {}

    // z.coerce.date() turns null into the Unix epoch — an explicit null from
    // the client means "no scheduled date", not 1970-01-01.
    const sessionDate =
      raw.sessionDate === null ? null : (data.sessionDate ?? null)

    const panelistRows = dedupePanelists(data.panelists)

    if (panelistRows.length > 0) {
      const speakerIds = panelistRows.map((p) => p.speakerId)
      const found = await prisma.speaker.count({
        where: { id: { in: speakerIds } },
      })
      if (found !== speakerIds.length) {
        throw new AdminError(
          "One or more selected speakers no longer exist. Refresh the page and try again.",
          "UNKNOWN_SPEAKER",
          400,
        )
      }
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
    }

    const created = await prisma.$transaction(async (tx) => {
      const panel = await tx.panel.create({
        data: {
          topic: data.topic,
          description:
            data.description && data.description.length > 0
              ? data.description
              : null,
          moderatorId: data.moderatorId ?? null,
          sessionDate,
          startTime: data.startTime ?? null,
          endTime: data.endTime ?? null,
          venue: data.venue ?? null,
          status: data.status,
          displayOrder: data.displayOrder,
        },
      })

      if (panelistRows.length > 0) {
        await tx.panelist.createMany({
          data: panelistRows.map((p) => ({
            panelId: panel.id,
            speakerId: p.speakerId,
            role: p.role,
          })),
        })
      }

      return tx.panel.findUniqueOrThrow({
        where: { id: panel.id },
        include: PANEL_INCLUDE,
      })
    })

    await auditLog({
      actorId: session.user.id,
      action: "PANEL_CREATED",
      targetType: "Panel",
      targetId: created.id,
      after: panelSnapshot(created),
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse(created, "Panel created."),
      { status: 201 },
    )
  } catch (err) {
    return adminErrorResponse(err, "POST /api/admin/panels")
  }
}
