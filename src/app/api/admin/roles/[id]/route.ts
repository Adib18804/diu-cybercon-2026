// =============================================================================
// /api/admin/roles/[id]
// [id] is the USER id whose admin access is managed. Both methods require
// "admin_roles:edit" (super admin only).
//
// PATCH  — change the user's adminRole (role is re-confirmed as ADMIN).
// DELETE — revoke admin access entirely: role back to PARTICIPANT and no
//          adminRole.
//
// Guardrails:
// - An admin cannot change or revoke their own access.
// - Only a super admin can demote or revoke another super admin.
// - The last remaining super admin cannot be demoted or revoked.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { roleAssignSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

/** Only the adminRole from the shared schema — the user is addressed by id. */
const adminRoleUpdateSchema = roleAssignSchema.pick({ adminRole: true })

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

async function findTargetUser(id: string) {
  return prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: ADMIN_USER_SELECT,
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("admin_roles:edit")
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

    const parsed = adminRoleUpdateSchema.safeParse(body)
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

    const { adminRole } = parsed.data

    const target = await findTargetUser(id)
    if (!target) {
      throw new AdminError("User not found.", "NOT_FOUND", 404)
    }
    if (target.id === session.user.id) {
      throw new AdminError(
        "You cannot change your own admin role.",
        "SELF_ROLE_CHANGE",
        409,
      )
    }
    if (
      target.adminRole === "SUPER_ADMIN" &&
      session.user.adminRole !== "SUPER_ADMIN"
    ) {
      throw new AdminError(
        "Only a super admin can change another super admin's role.",
        "FORBIDDEN",
        403,
      )
    }
    if (target.adminRole === "SUPER_ADMIN" && adminRole !== "SUPER_ADMIN") {
      const superAdminCount = await prisma.user.count({
        where: { adminRole: "SUPER_ADMIN" },
      })
      if (superAdminCount <= 1) {
        throw new AdminError(
          "Cannot demote the last super admin.",
          "LAST_SUPER_ADMIN",
          409,
        )
      }
    }
    if (target.adminRole === adminRole) {
      throw new AdminError(
        "This user already has that admin role.",
        "ALREADY_ASSIGNED",
        409,
      )
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { role: "ADMIN", adminRole },
      select: ADMIN_USER_SELECT,
    })

    await auditLog({
      actorId: session.user.id,
      action: "ADMIN_ROLE_ASSIGNED",
      targetType: "User",
      targetId: target.id,
      before: { role: target.role, adminRole: target.adminRole },
      after: { role: updated.role, adminRole: updated.adminRole },
      metadata: { email: target.email, via: "admin-roles" },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(successResponse(updated, "Admin role updated."))
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/roles/[id]")
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("admin_roles:edit")
    if (error) {return error}

    const { id } = await params

    const target = await findTargetUser(id)
    if (!target) {
      throw new AdminError("User not found.", "NOT_FOUND", 404)
    }
    if (target.id === session.user.id) {
      throw new AdminError(
        "You cannot revoke your own admin access.",
        "SELF_REVOKE",
        409,
      )
    }
    if (
      target.adminRole === "SUPER_ADMIN" &&
      session.user.adminRole !== "SUPER_ADMIN"
    ) {
      throw new AdminError(
        "Only a super admin can revoke another super admin's access.",
        "FORBIDDEN",
        403,
      )
    }
    if (target.adminRole === "SUPER_ADMIN") {
      const superAdminCount = await prisma.user.count({
        where: { adminRole: "SUPER_ADMIN" },
      })
      if (superAdminCount <= 1) {
        throw new AdminError(
          "Cannot revoke the last super admin.",
          "LAST_SUPER_ADMIN",
          409,
        )
      }
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { role: "PARTICIPANT", adminRole: null },
      select: ADMIN_USER_SELECT,
    })

    await auditLog({
      actorId: session.user.id,
      action: "ADMIN_ROLE_REMOVED",
      targetType: "User",
      targetId: target.id,
      before: { role: target.role, adminRole: target.adminRole },
      after: { role: updated.role, adminRole: updated.adminRole },
      metadata: { email: target.email, via: "admin-roles" },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(successResponse(updated, "Admin access revoked."))
  } catch (err) {
    return adminErrorResponse(err, "DELETE /api/admin/roles/[id]")
  }
}
