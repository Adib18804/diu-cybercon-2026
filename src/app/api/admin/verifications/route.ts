// =============================================================================
// GET /api/admin/verifications
// Paginated student-ID verification queue for admins with "verification:view".
//
// Filters:
// - status: PENDING | VERIFIED | REJECTED | REVISION_REQUIRED (whitelisted)
// - q: applicant name / email / student ID / profile full name
//
// Document files are NEVER returned here — only metadata. The file itself is
// reachable solely through the signed-URL flow (≤ 5 min) in
// /api/admin/verifications/[id]/view-url → /api/files/verification/[id].
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
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "REVISION_REQUIRED",
] as const

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("verification:view")
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

    const flatSearch = buildSearchOr(q, ["name", "email"])

    const where = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            user: {
              OR: [
                ...(flatSearch ?? []),
                {
                  profile: {
                    fullName: { contains: q, mode: "insensitive" as const },
                  },
                },
                {
                  profile: {
                    studentId: { contains: q, mode: "insensitive" as const },
                  },
                },
              ],
            },
          }
        : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.studentVerification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          fileName: true,
          fileSizeBytes: true,
          reviewNote: true,
          createdAt: true,
          reviewedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              isSuspended: true,
              profile: {
                select: {
                  fullName: true,
                  studentId: true,
                  department: true,
                  university: { select: { name: true, shortName: true } },
                },
              },
            },
          },
        },
      }),
      prisma.studentVerification.count({ where }),
    ])

    return NextResponse.json(
      successResponse({
        items,
        pagination: paginationMeta(total, page, pageSize),
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/verifications")
  }
}
