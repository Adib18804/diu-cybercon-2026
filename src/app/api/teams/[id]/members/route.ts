// =============================================================================
// POST /api/teams/[id]/members — Add a member to an existing team.
// Leader-only. The student ID upload token must have been staged by the
// leader (same rule as the registration wizard). Creates the member's
// registration; the new registration awaits admin approval.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { requireAuth } from "@/lib/rbac"
import { registrationErrorResponse } from "@/lib/registrations/http"
import { addTeamMember } from "@/lib/registrations/service"
import {
  checkRateLimit,
  rateLimitExceededResponse,
} from "@/lib/security/rate-limit"
import { errorResponse, successResponse } from "@/lib/utils"
import { teamMemberSchema } from "@/lib/validations/registration"

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const { session, error } = await requireAuth()
    if (error) {return error}

    const limit = await checkRateLimit("registration", session.user.id)
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

    // ── Parse + validate ──────────────────────────────────────────────────────
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        errorResponse("Invalid request body.", "INVALID_JSON"),
        { status: 400 },
      )
    }

    const parsed = teamMemberSchema.safeParse(body)
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

    // ── Business rules + transaction (leader check inside) ────────────────────
    const result = await addTeamMember({
      actorId: session.user.id,
      teamId: id,
      input: parsed.data,
    })

    // ── Post-transaction: audit ────────────────────────────────────────────────
    const ipAddress = extractIpAddress(request)
    const userAgent = extractUserAgent(request)

    await auditLog({
      actorId: session.user.id,
      action: "TEAM_MEMBER_ADDED",
      targetType: "TeamMember",
      targetId: result.registrationId,
      after: {
        teamId: result.teamId,
        memberEmail: result.email,
        memberName: result.participantName,
      },
      ipAddress,
      userAgent,
      metadata: { teamSize: result.teamSize },
    })

    // ── Response ──────────────────────────────────────────────────────────────
    return NextResponse.json(
      successResponse(
        {
          teamId: result.teamId,
          teamName: result.teamName,
          registrationId: result.registrationId,
          participantName: result.participantName,
          email: result.email,
          teamSize: result.teamSize,
        },
        "Team member added. Their registration is pending approval.",
      ),
      { status: 201 },
    )
  } catch (err) {
    return registrationErrorResponse(err, "POST /api/teams/[id]/members")
  }
}
