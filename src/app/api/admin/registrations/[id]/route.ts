// =============================================================================
// PATCH /api/admin/registrations/[id]
// Change a registration's status (PENDING / CONFIRMED / CANCELLED /
// WAITLISTED). Requires "registrations:edit".
//
// Guardrails:
// - No-op transitions are rejected with a friendly 409.
// - A registration cannot be cancelled while the participant is checked in —
//   record the check-out first so the headcount stays trustworthy.
//
// Participant notification emails for status changes are wired in the email
// phase (Phase 16); this route only mutates + audits.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { registrationStatusUpdateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

const STATUS_MESSAGES: Record<string, string> = {
  PENDING: "Registration moved back to pending.",
  CONFIRMED: "Registration confirmed.",
  CANCELLED: "Registration cancelled.",
  WAITLISTED: "Registration moved to the waitlist.",
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  WAITLISTED: "waitlisted",
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("registrations:edit")
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

    const parsed = registrationStatusUpdateSchema.safeParse(body)
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

    const { status } = parsed.data

    const existing = await prisma.eventRegistration.findUnique({
      where: { id },
      select: {
        id: true,
        registrationId: true,
        status: true,
        checkInStatus: true,
        userId: true,
        event: { select: { name: true } },
      },
    })

    if (!existing) {
      throw new AdminError("Registration not found.", "NOT_FOUND", 404)
    }
    if (existing.status === status) {
      throw new AdminError(
        `This registration is already ${STATUS_LABELS[status] ?? status.toLowerCase()}.`,
        "ALREADY_IN_STATUS",
        409,
      )
    }
    if (status === "CANCELLED" && existing.checkInStatus === "CHECKED_IN") {
      throw new AdminError(
        "This participant is currently checked in. Record their check-out first, then cancel the registration.",
        "CHECKED_IN",
        409,
      )
    }

    const updated = await prisma.eventRegistration.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        registrationId: true,
        status: true,
        checkInStatus: true,
        updatedAt: true,
      },
    })

    await auditLog({
      actorId: session.user.id,
      action: "REGISTRATION_STATUS_CHANGED",
      targetType: "EventRegistration",
      targetId: id,
      before: { status: existing.status },
      after: { status: updated.status },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
      metadata: {
        registrationId: existing.registrationId,
        eventName: existing.event.name,
        participantUserId: existing.userId,
        via: "admin-registrations",
      },
    })

    return NextResponse.json(
      successResponse(updated, STATUS_MESSAGES[status] ?? "Registration updated."),
    )
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/registrations/[id]")
  }
}
