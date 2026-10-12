// =============================================================================
// /api/admin/roles
// GET  — paginated list of users with admin access (role ADMIN or STAFF).
//        Requires "admin_roles:view" (super admin only).
//        Filters: q (name / email) and adminRole (whitelisted).
// POST — grant admin access to an existing user, looked up by email. Requires
//        "admin_roles:edit". Sets role to ADMIN and assigns the adminRole.
//
// Guardrails:
// - Unknown email → 404.
// - User already holds the requested admin role → 409.
// - Granting SUPER_ADMIN requires the requester to be a super admin → 403.
// =============================================================================

import type { NextRequest } from "next/server"
import type { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { parseAdminListParams, parseEnumFilter } from "@/lib/admin/query"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, paginationMeta, successResponse } from "@/lib/utils"
import { roleAssignSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ADMIN_ROLE_FILTERS = [
  "SUPER_ADMIN",
  "EVENT_ADMIN",
  "REGISTRATION_ADMIN",
  "CONTENT_ADMIN",
  "SPONSORSHIP_ADMIN",
  "VERIFICATION_ADMIN",
] as const

/** Shared row shape for the roles desk — never exposes credentials or profile. */
const ADMIN_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  adminRole: true,
  isSuspended: true,
  createdAt: true,
} as const

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("admin_roles:view")
    if (error) {return error}

    const { page, pageSize, skip, take, q } = parseAdminListParams(request)
    const adminRole = parseEnumFilter(
      request.nextUrl.searchParams,
      "adminRole",
      ADMIN_ROLE_FILTERS,
    )

    if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
      return NextResponse.json(
        errorResponse("Invalid pagination parameters.", "VALIDATION"),
        { status: 400 },
      )
    }

    const where: Prisma.UserWhereInput = {
      role: { in: ["ADMIN", "STAFF"] },
      deletedAt: null,
      ...(adminRole ? { adminRole } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "asc" },
        select: ADMIN_USER_SELECT,
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
    return adminErrorResponse(err, "GET /api/admin/roles")
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("admin_roles:edit")
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

    const parsed = roleAssignSchema.safeParse(body)
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

    const { email, adminRole } = parsed.data

    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: ADMIN_USER_SELECT,
    })

    if (!user) {
      throw new AdminError(
        "No user found with that email.",
        "USER_NOT_FOUND",
        404,
      )
    }
    if (user.adminRole === adminRole) {
      throw new AdminError(
        "This user already has that admin role.",
        "ALREADY_ASSIGNED",
        409,
      )
    }
    if (adminRole === "SUPER_ADMIN" && session.user.adminRole !== "SUPER_ADMIN") {
      throw new AdminError(
        "Only a super admin can grant the super admin role.",
        "FORBIDDEN",
        403,
      )
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN", adminRole },
      select: ADMIN_USER_SELECT,
    })

    await auditLog({
      actorId: session.user.id,
      action: "ADMIN_ROLE_ASSIGNED",
      targetType: "User",
      targetId: user.id,
      before: { role: user.role, adminRole: user.adminRole },
      after: { role: updated.role, adminRole: updated.adminRole },
      metadata: { email: user.email, via: "admin-roles" },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(successResponse(updated, "Admin role assigned."))
  } catch (err) {
    return adminErrorResponse(err, "POST /api/admin/roles")
  }
}
