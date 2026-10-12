// =============================================================================
// GET /api/admin/registrations
// Paginated registration desk for admins with "registrations:view".
//
// Filters:
// - eventType: whitelisted EventType (CTF, TRACE_ROUTE, …)
// - status:    whitelisted RegistrationStatus (PENDING, CONFIRMED, …)
// - q:         registration ID / participant name / email / student ID / team
//
// Each row carries enough participant context for the desk to act without a
// second lookup. Student ID documents are never included — status metadata
// only.
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

const EVENT_TYPE_FILTERS = [
  "CTF",
  "TRACE_ROUTE",
  "PROJECT_SHOWCASE",
  "POSTER_PRESENTATION",
  "PANEL_DISCUSSION",
  "HANDS_ON",
] as const

const STATUS_FILTERS = ["PENDING", "CONFIRMED", "CANCELLED", "WAITLISTED"] as const

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("registrations:view")
    if (error) {return error}

    const { page, pageSize, skip, take, q } = parseAdminListParams(request)
    const eventType = parseEnumFilter(
      request.nextUrl.searchParams,
      "eventType",
      EVENT_TYPE_FILTERS,
    )
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
      ...(eventType ? { event: { type: eventType } } : {}),
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              {
                registrationId: { contains: q.toUpperCase(), mode: "insensitive" as const },
              },
              { user: { name: { contains: q, mode: "insensitive" as const } } },
              { user: { email: { contains: q, mode: "insensitive" as const } } },
              {
                user: {
                  profile: {
                    fullName: { contains: q, mode: "insensitive" as const },
                  },
                },
              },
              {
                user: {
                  profile: {
                    studentId: { contains: q, mode: "insensitive" as const },
                  },
                },
              },
              { team: { name: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.eventRegistration.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          registrationId: true,
          status: true,
          checkInStatus: true,
          checkInTime: true,
          checkOutTime: true,
          createdAt: true,
          event: { select: { id: true, name: true, type: true } },
          team: { select: { id: true, name: true } },
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
      prisma.eventRegistration.count({ where }),
    ])

    return NextResponse.json(
      successResponse({
        items,
        pagination: paginationMeta(total, page, pageSize),
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/registrations")
  }
}
