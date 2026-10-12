// =============================================================================
// GET    /api/admin/teams/[id]  — team detail (teams:view)
// PATCH  /api/admin/teams/[id]  — rename a team (teams:edit)
// DELETE /api/admin/teams/[id]  — soft-delete a team (teams:edit)
//
// GET returns the team, its event, the resolved leader (leaderId is an
// un-related user id), the full member roster with verification status, and
// the registration count. Student ID documents are never included — status
// metadata only.
//
// Guardrails:
// - A team with event registrations cannot be deleted (409) — cancel or move
//   those registrations first.
// - Rename races on the [name, eventId] unique index surface as 409 via
//   adminErrorResponse (P2002 mapping).
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { teamUpdateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

// ─── GET — team detail ────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("teams:view")
    if (error) {return error}

    const { id } = await params

    const team = await prisma.team.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        leaderId: true,
        createdAt: true,
        updatedAt: true,
        event: { select: { id: true, name: true, type: true } },
      },
    })

    if (!team) {
      throw new AdminError("Team not found.", "NOT_FOUND", 404)
    }

    // leaderId references a user id — resolve it with a second query.
    const leader = await prisma.user.findUnique({
      where: { id: team.leaderId },
      select: { id: true, name: true, email: true },
    })

    const members = await prisma.teamMember.findMany({
      where: { teamId: id },
      include: {
        profile: {
          select: {
            fullName: true,
            studentId: true,
            department: true,
            phone: true,
            university: { select: { name: true, shortName: true } },
          },
        },
        verification: { select: { status: true } },
      },
      orderBy: { joinedAt: "asc" },
    })

    const registrationCount = await prisma.eventRegistration.count({
      where: { teamId: id },
    })

    const { leaderId: _leaderId, ...teamData } = team
    void _leaderId

    return NextResponse.json(
      successResponse({
        team: { ...teamData, leader },
        members,
        registrationCount,
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/teams/[id]")
  }
}

// ─── PATCH — rename ───────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("teams:edit")
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

    const parsed = teamUpdateSchema.safeParse(body)
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

    const existing = await prisma.team.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true },
    })
    if (!existing) {
      throw new AdminError("Team not found.", "NOT_FOUND", 404)
    }

    // A rename race on the [name, eventId] unique index maps to 409 in
    // adminErrorResponse (P2002) — no manual pre-check needed.
    const updated = await prisma.team.update({
      where: { id },
      data: { name: parsed.data.name },
      select: { id: true, name: true, updatedAt: true },
    })

    await auditLog({
      actorId: session.user.id,
      action: "TEAM_RENAMED",
      targetType: "Team",
      targetId: id,
      before: { name: existing.name },
      after: { name: updated.name },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
      metadata: { via: "admin-teams" },
    })

    return NextResponse.json(
      successResponse(
        { id: updated.id, name: updated.name, updatedAt: updated.updatedAt },
        "Team renamed.",
      ),
    )
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/teams/[id]")
  }
}

// ─── DELETE — soft delete ─────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("teams:edit")
    if (error) {return error}

    const { id } = await params

    const existing = await prisma.team.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, eventId: true },
    })
    if (!existing) {
      throw new AdminError("Team not found.", "NOT_FOUND", 404)
    }

    const registrationCount = await prisma.eventRegistration.count({
      where: { teamId: id },
    })
    if (registrationCount > 0) {
      throw new AdminError(
        "This team has registrations and cannot be deleted.",
        "HAS_REGISTRATIONS",
        409,
      )
    }

    await prisma.team.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    await auditLog({
      actorId: session.user.id,
      action: "TEAM_DELETED",
      targetType: "Team",
      targetId: id,
      before: { name: existing.name },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
      metadata: { eventId: existing.eventId, via: "admin-teams" },
    })

    return NextResponse.json(
      successResponse({ id, name: existing.name }, "Team deleted."),
    )
  } catch (err) {
    return adminErrorResponse(err, "DELETE /api/admin/teams/[id]")
  }
}
