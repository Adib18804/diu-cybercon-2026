// =============================================================================
// GET  /api/admin/schedule — paginated schedule list ("schedule:view")
// POST /api/admin/schedule — create a schedule item ("schedule:edit")
//
// Filters:
// - day: whitelisted "1" | "2" | "3" (coerced to a number for Prisma)
// - q:   title
//
// ScheduleItem.speakerId has NO Prisma relation, so speaker names are
// resolved with a second query and merged into each row as
// `speaker: { id, name } | null`. The `event` relation is included directly.
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
import { scheduleItemCreateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DAY_FILTERS = ["1", "2", "3"] as const

type SpeakerLookup = { id: string; name: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
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

// ─── GET — schedule list ──────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("schedule:view")
    if (error) {return error}

    const { page, pageSize, skip, take, q } = parseAdminListParams(request)
    const day = parseEnumFilter(
      request.nextUrl.searchParams,
      "day",
      DAY_FILTERS,
    )

    if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
      return NextResponse.json(
        errorResponse("Invalid pagination parameters.", "VALIDATION"),
        { status: 400 },
      )
    }

    const searchOr = buildSearchOr(q, ["title"])

    const where = {
      ...(day ? { day: Number(day) } : {}),
      ...(searchOr ? { OR: searchOr } : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.scheduleItem.findMany({
        where,
        skip,
        take,
        orderBy: [
          { day: "asc" },
          { startTime: "asc" },
          { displayOrder: "asc" },
        ],
        include: {
          event: { select: { id: true, name: true, type: true } },
        },
      }),
      prisma.scheduleItem.count({ where }),
    ])

    // speakerId is a plain column (no relation) — resolve names separately.
    const speakerIds = Array.from(
      new Set(
        items
          .map((item) => item.speakerId)
          .filter((value): value is string => value !== null),
      ),
    )
    const speakers =
      speakerIds.length > 0
        ? await prisma.speaker.findMany({
            where: { id: { in: speakerIds } },
            select: { id: true, name: true },
          })
        : []
    const speakerById = new Map<string, SpeakerLookup>(
      speakers.map((speaker) => [speaker.id, speaker] as const),
    )

    const enriched = items.map((item) => ({
      ...item,
      speaker: item.speakerId
        ? (speakerById.get(item.speakerId) ?? null)
        : null,
    }))

    return NextResponse.json(
      successResponse({
        items: enriched,
        pagination: paginationMeta(total, page, pageSize),
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/schedule")
  }
}

// ─── POST — create schedule item ──────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("schedule:edit")
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

    // z.coerce.date() turns null into the Unix epoch — reject an explicit
    // null date instead of silently storing 1970-01-01.
    const raw = isRecord(body) ? body : {}
    if (raw.date === null) {
      return NextResponse.json(
        errorResponse("Please fix the highlighted fields and try again.", "VALIDATION", {
          date: ["Enter a valid date and time"],
        }),
        { status: 422 },
      )
    }

    const parsed = scheduleItemCreateSchema.safeParse(body)
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

    if (data.eventId !== undefined) {
      const event = await prisma.event.findUnique({
        where: { id: data.eventId },
        select: { id: true },
      })
      if (!event) {
        throw new AdminError(
          "The selected event no longer exists. Refresh the page and try again.",
          "UNKNOWN_EVENT",
          400,
        )
      }
    }

    if (data.speakerId !== undefined) {
      const speaker = await prisma.speaker.findUnique({
        where: { id: data.speakerId },
        select: { id: true },
      })
      if (!speaker) {
        throw new AdminError(
          "The selected speaker no longer exists. Refresh the page and try again.",
          "UNKNOWN_SPEAKER",
          400,
        )
      }
    }

    const created = await prisma.scheduleItem.create({
      data: {
        day: data.day,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        title: data.title,
        description:
          data.description && data.description.length > 0
            ? data.description
            : null,
        venue: data.venue ?? null,
        type: data.type,
        eventId: data.eventId ?? null,
        speakerId: data.speakerId ?? null,
        isHighlight: data.isHighlight,
        displayOrder: data.displayOrder,
      },
    })

    await auditLog({
      actorId: session.user.id,
      action: "SCHEDULE_ITEM_CREATED",
      targetType: "ScheduleItem",
      targetId: created.id,
      after: scheduleSnapshot(created),
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse(created, "Schedule item created."),
      { status: 201 },
    )
  } catch (err) {
    return adminErrorResponse(err, "POST /api/admin/schedule")
  }
}
