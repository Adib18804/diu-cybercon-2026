// =============================================================================
// POST /api/admin/participants/[id]/suspend
// Suspend or reinstate a participant account. Requires "participants:edit".
//
// Guardrails:
// - Only role PARTICIPANT accounts can be suspended here — admin/staff
//   accounts are managed through Roles & Access.
// - A reason is required to suspend (it lands in the audit trail).
// - No-op transitions are rejected (already suspended / not suspended).
//
// The JWT session layer re-checks suspension from the DB at most once per
// minute, so a suspended participant loses access within ~60s.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { userSuspendSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("participants:edit")
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

    const parsed = userSuspendSchema.safeParse(body)
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

    const { suspend, reason } = parsed.data

    const existing = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isSuspended: true,
        deletedAt: true,
      },
    })

    if (!existing || existing.deletedAt) {
      throw new AdminError("Participant not found.", "NOT_FOUND", 404)
    }
    if (existing.role !== "PARTICIPANT") {
      throw new AdminError(
        "Only participant accounts can be suspended here. Use Roles & Access for admin and staff accounts.",
        "WRONG_ACCOUNT_TYPE",
        400,
      )
    }
    if (suspend && existing.isSuspended) {
      throw new AdminError(
        "This account is already suspended.",
        "ALREADY_SUSPENDED",
        409,
      )
    }
    if (!suspend && !existing.isSuspended) {
      throw new AdminError(
        "This account is not suspended.",
        "NOT_SUSPENDED",
        409,
      )
    }
    if (suspend && !reason) {
      throw new AdminError(
        "A reason is required to suspend an account.",
        "REASON_REQUIRED",
        400,
      )
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isSuspended: suspend },
      select: { id: true, isSuspended: true, updatedAt: true },
    })

    await auditLog({
      actorId: session.user.id,
      action: suspend ? "USER_SUSPENDED" : "USER_UNSUSPENDED",
      targetType: "User",
      targetId: id,
      before: { isSuspended: existing.isSuspended },
      after: { isSuspended: updated.isSuspended },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
      metadata: {
        email: existing.email,
        ...(reason ? { reason } : {}),
        via: "admin-participants",
      },
    })

    return NextResponse.json(
      successResponse(
        updated,
        suspend
          ? "Account suspended. Access is revoked within a minute."
          : "Account reinstated.",
      ),
    )
  } catch (err) {
    return adminErrorResponse(err, "POST /api/admin/participants/[id]/suspend")
  }
}
