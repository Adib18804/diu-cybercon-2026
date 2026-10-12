// =============================================================================
// PATCH  /api/teams/[id]/members/[memberId] — Edit a member's details.
//   Allowed for: the member themselves, the team leader, or an admin with
//   teams:edit. Student ID and email are identity anchors — never editable.
//
// DELETE /api/teams/[id]/members/[memberId] — Remove a member.
//   Leader (or admin with teams:edit) only. The leader cannot be removed.
//   The member's registration is cancelled and their student ID file is
//   purged from private storage.
// =============================================================================

import type { TShirtSize } from "@prisma/client"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { hasPermission, isAdminRole, requireAuth } from "@/lib/rbac"
import { registrationErrorResponse } from "@/lib/registrations/http"
import {
  resolveTeamLimits,
  resolveUniversityId,
} from "@/lib/registrations/service"
import {
  checkRateLimit,
  rateLimitExceededResponse,
} from "@/lib/security/rate-limit"
import { deletePrivateFile } from "@/lib/storage"
import { errorResponse, successResponse } from "@/lib/utils"
import { teamMemberUpdateSchema } from "@/lib/validations/registration"

export const runtime = "nodejs"

type RouteParams = { params: Promise<{ id: string; memberId: string }> }

// ─── Shared loader ────────────────────────────────────────────────────────────

async function loadTeamMember(teamId: string, memberId: string) {
  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId },
    select: {
      id: true,
      isLeader: true,
      profileId: true,
      profile: {
        select: {
          id: true,
          userId: true,
          fullName: true,
          department: true,
          phone: true,
          tshirtSize: true,
          universityId: true,
          user: { select: { email: true } },
        },
      },
      team: {
        select: {
          id: true,
          name: true,
          leaderId: true,
          eventId: true,
          deletedAt: true,
          event: {
            select: {
              id: true,
              type: true,
              minTeamSize: true,
              maxTeamSize: true,
            },
          },
        },
      },
    },
  })

  if (!member || member.team.deletedAt) {return null}
  return member
}

// ─── PATCH — edit member details ──────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error } = await requireAuth()
    if (error) {return error}

    const limit = await checkRateLimit("global", `team-manage:${session.user.id}`)
    if (!limit.success) {
      return rateLimitExceededResponse(limit.retryAfter)
    }

    const { id, memberId } = await params
    if (!id || !memberId) {
      return NextResponse.json(
        errorResponse("Team member not found.", "MEMBER_NOT_FOUND"),
        { status: 404 },
      )
    }

    const member = await loadTeamMember(id, memberId)
    if (!member) {
      return NextResponse.json(
        errorResponse("Team member not found.", "MEMBER_NOT_FOUND"),
        { status: 404 },
      )
    }

    // ── Authorization: self OR leader OR admin with teams:edit ────────────────
    const isSelf = session.user.id === member.profile.userId
    const isLeader = session.user.id === member.team.leaderId
    const isAdminEditor =
      isAdminRole(session.user.role) &&
      hasPermission(session.user.adminRole, "teams:edit")
    if (!isSelf && !isLeader && !isAdminEditor) {
      return NextResponse.json(
        errorResponse(
          "You do not have permission to edit this team member.",
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

    const parsed = teamMemberUpdateSchema.safeParse(body)
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
    const data = parsed.data

    // ── Build the change set (only provided fields) ───────────────────────────
    const changes: {
      fullName?: string
      department?: string
      phone?: string
      tshirtSize?: TShirtSize
      universityId?: string
    } = {}

    if (data.fullName !== undefined) {changes.fullName = data.fullName}
    if (data.department !== undefined) {changes.department = data.department}
    if (data.phone !== undefined) {changes.phone = data.phone}
    if (data.tshirtSize !== undefined) {changes.tshirtSize = data.tshirtSize}
    if (data.universityId !== undefined || data.universityName !== undefined) {
      changes.universityId = await resolveUniversityId(prisma, {
        universityId: data.universityId,
        universityName: data.universityName,
      })
    }

    const before: Record<string, unknown> = {}
    const after: Record<string, unknown> = {}
    for (const key of Object.keys(changes) as (keyof typeof changes)[]) {
      before[key] = member.profile[key] ?? null
      after[key] = changes[key]
    }

    await prisma.participantProfile.update({
      where: { id: member.profileId },
      data: changes,
    })

    // ── Audit ─────────────────────────────────────────────────────────────────
    const editedBy = isSelf ? "self" : isLeader ? "leader" : "admin"
    await auditLog({
      actorId: session.user.id,
      action: "TEAM_MEMBER_UPDATED",
      targetType: "TeamMember",
      targetId: member.id,
      before,
      after,
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
      metadata: {
        teamId: member.team.id,
        eventId: member.team.eventId,
        profileId: member.profileId,
        editedBy,
      },
    })

    return NextResponse.json(
      successResponse({ id: member.id, ...changes }, "Member updated."),
    )
  } catch (err) {
    return registrationErrorResponse(
      err,
      "PATCH /api/teams/[id]/members/[memberId]",
    )
  }
}

// ─── DELETE — remove a member ─────────────────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error } = await requireAuth()
    if (error) {return error}

    const limit = await checkRateLimit("global", `team-manage:${session.user.id}`)
    if (!limit.success) {
      return rateLimitExceededResponse(limit.retryAfter)
    }

    const { id, memberId } = await params
    if (!id || !memberId) {
      return NextResponse.json(
        errorResponse("Team member not found.", "MEMBER_NOT_FOUND"),
        { status: 404 },
      )
    }

    const member = await loadTeamMember(id, memberId)
    if (!member) {
      return NextResponse.json(
        errorResponse("Team member not found.", "MEMBER_NOT_FOUND"),
        { status: 404 },
      )
    }

    // ── Authorization: leader OR admin with teams:edit ────────────────────────
    const isLeader = session.user.id === member.team.leaderId
    const isAdminEditor =
      isAdminRole(session.user.role) &&
      hasPermission(session.user.adminRole, "teams:edit")
    if (!isLeader && !isAdminEditor) {
      return NextResponse.json(
        errorResponse(
          "Only the team leader can remove members.",
          "NOT_TEAM_LEADER",
        ),
        { status: 403 },
      )
    }

    if (member.isLeader) {
      return NextResponse.json(
        errorResponse(
          "The team leader cannot be removed. Transfer or cancel instead.",
          "CANNOT_REMOVE_LEADER",
        ),
        { status: 400 },
      )
    }
    if (session.user.id === member.profile.userId) {
      return NextResponse.json(
        errorResponse(
          "You cannot remove yourself from the team.",
          "CANNOT_REMOVE_SELF",
        ),
        { status: 400 },
      )
    }

    // ── Minimum team size must survive the removal ────────────────────────────
    const teamSize = await prisma.teamMember.count({ where: { teamId: id } })
    const limits = resolveTeamLimits(member.team.event)
    if (teamSize - 1 < limits.min) {
      return NextResponse.json(
        errorResponse(
          `A team for this event must keep at least ${limits.min} members.`,
          "TEAM_TOO_SMALL",
        ),
        { status: 409 },
      )
    }

    // ── Transaction: purge verification, detach member, cancel registration ──
    const removedFileKey = await prisma.$transaction(
      async (tx) => {
        const verification = await tx.studentVerification.findUnique({
          where: { teamMemberId: member.id },
          select: { id: true, fileKey: true },
        })

        if (verification) {
          await tx.studentVerification.delete({ where: { id: verification.id } })
        }

        await tx.teamMember.delete({ where: { id: member.id } })

        await tx.eventRegistration.updateMany({
          where: {
            eventId: member.team.eventId,
            userId: member.profile.userId,
            teamId: member.team.id,
          },
          data: { status: "CANCELLED" },
        })

        return verification?.fileKey ?? null
      },
      { timeout: 20000, maxWait: 10000 },
    )

    // Purge the student ID file (best-effort — outside the DB transaction)
    if (removedFileKey) {
      const deleted = await deletePrivateFile(removedFileKey)
      if (!deleted) {
        console.warn(
          `[DELETE /api/teams/[id]/members/[memberId]] file not purged: ${removedFileKey}`,
        )
      }
    }

    // ── Audit ─────────────────────────────────────────────────────────────────
    await auditLog({
      actorId: session.user.id,
      action: "TEAM_MEMBER_REMOVED",
      targetType: "TeamMember",
      targetId: member.id,
      before: {
        memberName: member.profile.fullName,
        memberEmail: member.profile.user.email,
      },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
      metadata: {
        teamId: member.team.id,
        eventId: member.team.eventId,
        removedUserId: member.profile.userId,
        removedBy: isLeader ? "leader" : "admin",
      },
    })

    return NextResponse.json(
      successResponse(
        { removed: true, teamSize: teamSize - 1 },
        "Member removed.",
      ),
    )
  } catch (err) {
    return registrationErrorResponse(
      err,
      "DELETE /api/teams/[id]/members/[memberId]",
    )
  }
}
