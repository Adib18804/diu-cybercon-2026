// =============================================================================
// PATCH /api/teams/[id] — Rename a team.
// Allowed for the team leader OR an admin with the teams:edit permission.
// Names are unique per event (case-insensitive, active teams only).
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { hasPermission, isAdminRole, requireAuth } from "@/lib/rbac"
import { registrationErrorResponse } from "@/lib/registrations/http"
import {
  checkRateLimit,
  rateLimitExceededResponse,
} from "@/lib/security/rate-limit"
import { errorResponse, successResponse } from "@/lib/utils"
import { teamRenameSchema } from "@/lib/validations/registration"

export const runtime = "nodejs"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const { session, error } = await requireAuth()
    if (error) {return error}

    const limit = await checkRateLimit("global", `team-manage:${session.user.id}`)
    if (!limit.success) {
      return rateLimitExceededResponse(limit.retryAfter)
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json(
        errorResponse("Team not found.", "TEAM_NOT_FOUND"),
        { status: 404 },
      )
    }

    // ── Load team ─────────────────────────────────────────────────────────────
    const team = await prisma.team.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, leaderId: true, eventId: true },
    })
    if (!team) {
      return NextResponse.json(
        errorResponse("Team not found.", "TEAM_NOT_FOUND"),
        { status: 404 },
      )
    }

    // ── Authorization: leader OR admin with teams:edit ────────────────────────
    const isLeader = session.user.id === team.leaderId
    const isAdminEditor =
      isAdminRole(session.user.role) &&
      hasPermission(session.user.adminRole, "teams:edit")
    if (!isLeader && !isAdminEditor) {
      return NextResponse.json(
        errorResponse(
          "You do not have permission to manage this team.",
          "FORBIDDEN",
        ),
        { status: 403 },
      )
    }

    // ── Validate ──────────────────────────────────────────────────────────────
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        errorResponse("Invalid request body.", "INVALID_JSON"),
        { status: 400 },
      )
    }

    const parsed = teamRenameSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(
          "Please fix the highlighted fields and try again.",
          "VALIDATION_ERROR",
          parsed.error.flatten().fieldErrors as Record<string, string[]>,
        ),
        { status: 422 },
      )
    }
    const name = parsed.data.name

    // No-op rename — keep the current name, nothing to audit
    if (name.toLowerCase() === team.name.toLowerCase()) {
      return NextResponse.json(
        successResponse({ id: team.id, name: team.name }, "Team renamed."),
      )
    }

    // ── Unique name per event (case-insensitive, active teams only) ───────────
    const dup = await prisma.team.findFirst({
      where: {
        eventId: team.eventId,
        deletedAt: null,
        name: { equals: name, mode: "insensitive" },
        NOT: { id: team.id },
      },
      select: { id: true },
    })
    if (dup) {
      return NextResponse.json(
        errorResponse(
          "A team with this name already exists for this event.",
          "DUPLICATE_TEAM_NAME",
          { name: ["This team name is already taken"] },
        ),
        { status: 409 },
      )
    }

    await prisma.team.update({ where: { id: team.id }, data: { name } })

    // ── Audit ─────────────────────────────────────────────────────────────────
    await auditLog({
      actorId: session.user.id,
      action: "TEAM_RENAMED",
      targetType: "Team",
      targetId: team.id,
      before: { name: team.name },
      after: { name },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
      metadata: { eventId: team.eventId, byAdmin: isAdminEditor && !isLeader },
    })

    return NextResponse.json(
      successResponse({ id: team.id, name }, "Team renamed."),
    )
  } catch (err) {
    return registrationErrorResponse(err, "PATCH /api/teams/[id]")
  }
}
