// =============================================================================
// GET /api/admin/participants
// Paginated participant directory for admins with "participants:view".
//
// Filters:
// - account: "active" | "suspended" (whitelisted)
// - q: name / email / profile full name / student ID
//
// Only role PARTICIPANT accounts are listed — admin/staff accounts live in
// Roles & Access. Soft-deleted users are never listed.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { adminErrorResponse } from "@/lib/admin/http"
import { parseAdminListParams, parseEnumFilter } from "@/lib/admin/query"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, paginationMeta, successResponse } from "@/lib/utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ACCOUNT_FILTERS = ["active", "suspended"] as const

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("participants:view")
    if (error) {return error}

    const { page, pageSize, skip, take, q } = parseAdminListParams(request)
    const account = parseEnumFilter(
      request.nextUrl.searchParams,
      "account",
      ACCOUNT_FILTERS,
    )

    if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
      return NextResponse.json(
        errorResponse("Invalid pagination parameters.", "VALIDATION"),
        { status: 400 },
      )
    }

    const where = {
      role: "PARTICIPANT" as const,
      deletedAt: null,
      ...(account === "suspended"
        ? { isSuspended: true }
        : account === "active"
          ? { isSuspended: false }
          : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
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
          }
        : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          isSuspended: true,
          emailVerified: true,
          createdAt: true,
          profile: {
            select: {
              fullName: true,
              studentId: true,
              department: true,
              university: { select: { name: true, shortName: true } },
            },
          },
          studentVerifications: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true },
          },
          _count: {
            select: {
              eventRegistrations: true,
              workshopRegistrations: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json(
      successResponse({
        items,
        pagination: paginationMeta(total, page, pageSize),
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/participants")
  }
}
