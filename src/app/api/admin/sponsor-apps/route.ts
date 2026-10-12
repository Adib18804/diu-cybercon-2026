// =============================================================================
// GET /api/admin/sponsor-apps — paginated sponsorship application queue
// (sponsor_apps:view)
//
// Filters:
// - status: SUBMITTED | CONTACTED | NEGOTIATION | APPROVED | REJECTED |
//   COMPLETED (whitelisted)
// - q: organization name / contact person / email
//
// Listed newest first — the order the sponsorship pipeline is worked
// through. Full application records are returned (no field pruning) so the
// manage panel renders from the row without a second round-trip.
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

const STATUS_FILTERS = [
  "SUBMITTED",
  "CONTACTED",
  "NEGOTIATION",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
] as const

// ─── GET — sponsor application list ───────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("sponsor_apps:view")
    if (error) {return error}

    const { page, pageSize, skip, take, q } = parseAdminListParams(request)
    const status = parseEnumFilter(
      request.nextUrl.searchParams,
      "status",
      STATUS_FILTERS,
    )

    if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
      return NextResponse.json(
        errorResponse("Invalid pagination parameters.", "VALIDATION"),
        { status: 400 },
      )
    }

    const where = {
      ...(status ? { status } : {}),
      ...(q
        ? { OR: buildSearchOr(q, ["orgName", "contactPerson", "email"]) }
        : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.sponsorApplication.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.sponsorApplication.count({ where }),
    ])

    return NextResponse.json(
      successResponse({
        items,
        pagination: paginationMeta(total, page, pageSize),
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/sponsor-apps")
  }
}
