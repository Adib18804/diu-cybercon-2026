// =============================================================================
// PATCH /api/profile — update the signed-in participant's own profile.
// Student ID and email are identity anchors — never editable here.
// =============================================================================

import type { TShirtSize } from "@prisma/client"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/rbac"
import { registrationErrorResponse } from "@/lib/registrations/http"
import { resolveUniversityId } from "@/lib/registrations/service"
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit"
import { errorResponse, successResponse } from "@/lib/utils"
import { teamMemberUpdateSchema } from "@/lib/validations/registration"

export const runtime = "nodejs"

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const { session, error } = await requireAuth()
    if (error) {return error}

    const limit = await checkRateLimit("global", `profile:${session.user.id}`)
    if (!limit.success) {
      return rateLimitExceededResponse(limit.retryAfter)
    }

    // ── Must have a profile to update ─────────────────────────────────────────
    const profile = await prisma.participantProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        fullName: true,
        department: true,
        phone: true,
        tshirtSize: true,
        universityId: true,
      },
    })
    if (!profile) {
      return NextResponse.json(
        errorResponse(
          "You have not registered for an event yet, so there is no profile to update.",
          "PROFILE_NOT_FOUND",
        ),
        { status: 404 },
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
      before[key] = profile[key] ?? null
      after[key] = changes[key]
    }

    await prisma.participantProfile.update({
      where: { id: profile.id },
      data: changes,
    })

    // ── Audit ─────────────────────────────────────────────────────────────────
    await auditLog({
      actorId: session.user.id,
      action: "PROFILE_UPDATED",
      targetType: "ParticipantProfile",
      targetId: profile.id,
      before,
      after,
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse({ ...changes }, "Profile updated."),
    )
  } catch (err) {
    return registrationErrorResponse(err, "PATCH /api/profile")
  }
}
