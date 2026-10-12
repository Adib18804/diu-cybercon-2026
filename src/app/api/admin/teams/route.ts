// =============================================================================
// GET /api/admin/teams
// Paginated team directory for admins with "teams:view".
//
// Filters:
// - eventType: whitelisted EventType (CTF, TRACE_ROUTE, …)
// - q:         team name (case-insensitive contains)
//
// Team.leaderId is a plain string column with NO Prisma relation, so leaders
// are resolved with a second query over the collected ids and merged into each
// row as `leader: { id, name, email } | null` — never invented.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { adminErrorResponse } from "@/lib/admin/http"
import {
  buildSearchOr,
  parseAdminListParams,
  parseEnumFilter,
} from "@/lib/admin/query"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, paginationMeta, successResponse } from "@/lib/utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const EVENT_TYPE_FILTERS = [
  "CTF",
  "TRACE_ROUTE",
  "PROJECT_SHOWCASE",
  "POSTER_PRESENTATION",
  "PANEL_DISCUSSION",
  "HANDS_ON",
] as const

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("teams:view")
    if (error) {return error}

    const { page, pageSize, skip, take, q } = parseAdminListParams(request)
    const eventType = parseEnumFilter(
      request.nextUrl.searchParams,
      "eventType",
      EVENT_TYPE_FILTERS,
    )

    if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
      return NextResponse.json(
        errorResponse("Invalid pagination parameters.", "VALIDATION"),
        { status: 400 },
      )
    }

    const where = {
      deletedAt: null,
      ...(eventType ? { event: { type: eventType } } : {}),
      ...(q ? { OR: buildSearchOr(q, ["name"]) ?? [] } : {}),
    }

    const [teams, total] = await prisma.$transaction([
      prisma.team.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          event: { select: { id: true, name: true, type: true } },
          _count: { select: { members: true } },
        },
      }),
      prisma.team.count({ where }),
    ])

    // ── Resolve leaders (leaderId references a user id, un-related) ───────────
    const leaderIds = [...new Set(teams.map((team) => team.leaderId))]
    const leaders =
      leaderIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: leaderIds } },
            select: { id: true, name: true, email: true },
          })
        : []
    const leaderById = new Map(leaders.map((leader) => [leader.id, leader]))

    const items = teams.map((team) => {
      // Drop the internal soft-delete marker (always null under this filter).
      const { deletedAt: _deletedAt, ...rest } = team
      void _deletedAt
      return { ...rest, leader: leaderById.get(team.leaderId) ?? null }
    })

    return NextResponse.json(
      successResponse({
        items,
        pagination: paginationMeta(total, page, pageSize),
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/teams")
  }
}
