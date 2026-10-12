// =============================================================================
// GET  /api/admin/workshops — paginated workshop list (workshops:view)
// POST /api/admin/workshops — create a workshop (workshops:edit)
//
// Filters:
// - status: DRAFT | OPEN | CLOSED | COMPLETED (whitelisted)
// - skillLevel: BEGINNER | INTERMEDIATE | ADVANCED (whitelisted)
// - q: workshop title / instructor name
//
// Listed ordered by manual display order, then date — the order the public
// workshop pages present them in. Seats read registeredCount / totalSeats.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { adminErrorResponse } from "@/lib/admin/http"
import {
  buildSearchOr,
  parseAdminListParams,
  parseEnumFilter,
} from "@/lib/admin/query"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, paginationMeta, successResponse } from "@/lib/utils"
import { workshopCreateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STATUS_FILTERS = ["DRAFT", "OPEN", "CLOSED", "COMPLETED"] as const
const SKILL_LEVEL_FILTERS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const

// ─── GET — workshop list ──────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("workshops:view")
    if (error) {return error}

    const { page, pageSize, skip, take, q } = parseAdminListParams(request)
    const status = parseEnumFilter(
      request.nextUrl.searchParams,
      "status",
      STATUS_FILTERS,
    )
    const skillLevel = parseEnumFilter(
      request.nextUrl.searchParams,
      "skillLevel",
      SKILL_LEVEL_FILTERS,
    )

    if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
      return NextResponse.json(
        errorResponse("Invalid pagination parameters.", "VALIDATION"),
        { status: 400 },
      )
    }

    const where = {
      ...(status ? { status } : {}),
      ...(skillLevel ? { skillLevel } : {}),
      ...(q ? { OR: buildSearchOr(q, ["title", "instructorName"]) } : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.workshop.findMany({
        where,
        skip,
        take,
        orderBy: [{ displayOrder: "asc" }, { date: "asc" }],
        select: {
          id: true,
          title: true,
          skillLevel: true,
          instructorName: true,
          instructorOrg: true,
          date: true,
          startTime: true,
          endTime: true,
          venue: true,
          totalSeats: true,
          registeredCount: true,
          status: true,
          displayOrder: true,
        },
      }),
      prisma.workshop.count({ where }),
    ])

    return NextResponse.json(
      successResponse({
        items,
        pagination: paginationMeta(total, page, pageSize),
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/workshops")
  }
}

// ─── POST — create a workshop ─────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("workshops:edit")
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

    const parsed = workshopCreateSchema.safeParse(body)
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

    const created = await prisma.workshop.create({ data: parsed.data })

    await auditLog({
      actorId: session.user.id,
      action: "WORKSHOP_CREATED",
      targetType: "Workshop",
      targetId: created.id,
      metadata: { title: created.title },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse(created, "Workshop created."),
      { status: 201 },
    )
  } catch (err) {
    return adminErrorResponse(err, "POST /api/admin/workshops")
  }
}
