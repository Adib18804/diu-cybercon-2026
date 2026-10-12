// =============================================================================
// POST /api/admin/check-in/action
// Check a participant in or out. State machine (duplicates rejected):
//
//   NOT_ARRIVED  → CHECK_IN   ✔ (first entry)
//   CHECKED_IN   → CHECK_OUT  ✔ (leaving)
//   CHECKED_OUT  → CHECK_IN   ✔ (re-entry)
//   CHECKED_IN   → CHECK_IN   ✖ 409 ALREADY_CHECKED_IN
//   CHECKED_OUT  → CHECK_OUT  ✖ 409 ALREADY_CHECKED_OUT
//   NOT_ARRIVED  → CHECK_OUT  ✖ 409 NOT_CHECKED_IN
//
// Every transition stores the acting admin, timestamps, and writes an
// immutable audit entry (PARTICIPANT_CHECKED_IN / PARTICIPANT_CHECKED_OUT)
// with actor + IP + before/after state.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { checkInActionSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("registrations:checkin")
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

    const parsed = checkInActionSchema.safeParse(body)
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

    const { registrationId, action } = parsed.data

    const existing = await prisma.eventRegistration.findUnique({
      where: { registrationId },
      select: {
        id: true,
        registrationId: true,
        status: true,
        checkInStatus: true,
        checkInTime: true,
        checkOutTime: true,
        userId: true,
        event: { select: { name: true } },
      },
    })

    if (!existing) {
      throw new AdminError(
        "No registration found for this ID. Check the code and try again.",
        "NOT_FOUND",
        404,
      )
    }

    if (existing.status === "CANCELLED") {
      throw new AdminError(
        "This registration has been cancelled — check-in is not allowed.",
        "REGISTRATION_CANCELLED",
        409,
      )
    }

    // ── State-machine guards ────────────────────────────────────────────────
    if (action === "CHECK_IN" && existing.checkInStatus === "CHECKED_IN") {
      throw new AdminError(
        "This participant is already checked in.",
        "ALREADY_CHECKED_IN",
        409,
      )
    }
    if (action === "CHECK_OUT" && existing.checkInStatus === "NOT_ARRIVED") {
      throw new AdminError(
        "This participant has not checked in yet.",
        "NOT_CHECKED_IN",
        409,
      )
    }
    if (action === "CHECK_OUT" && existing.checkInStatus === "CHECKED_OUT") {
      throw new AdminError(
        "This participant is already checked out.",
        "ALREADY_CHECKED_OUT",
        409,
      )
    }

    const now = new Date()

    // On (re-)entry: reset the checkout timestamp so the card reads cleanly.
    // Previous values remain recorded in the audit trail.
    const updated = await prisma.eventRegistration.update({
      where: { id: existing.id },
      data:
        action === "CHECK_IN"
          ? {
              checkInStatus: "CHECKED_IN",
              checkInTime: now,
              checkOutTime: null,
              checkInAdminId: session.user.id,
            }
          : {
              checkInStatus: "CHECKED_OUT",
              checkOutTime: now,
              checkInAdminId: session.user.id,
            },
      select: {
        id: true,
        registrationId: true,
        checkInStatus: true,
        checkInTime: true,
        checkOutTime: true,
      },
    })

    await auditLog({
      actorId: session.user.id,
      action:
        action === "CHECK_IN"
          ? "PARTICIPANT_CHECKED_IN"
          : "PARTICIPANT_CHECKED_OUT",
      targetType: "EventRegistration",
      targetId: existing.id,
      before: {
        checkInStatus: existing.checkInStatus,
        checkInTime: existing.checkInTime,
        checkOutTime: existing.checkOutTime,
      },
      after: {
        checkInStatus: updated.checkInStatus,
        checkInTime: updated.checkInTime,
        checkOutTime: updated.checkOutTime,
      },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
      metadata: {
        registrationId: existing.registrationId,
        eventName: existing.event.name,
        participantUserId: existing.userId,
        portal: "admin-check-in",
      },
    })

    return NextResponse.json(
      successResponse(
        updated,
        action === "CHECK_IN"
          ? "Checked in successfully."
          : "Checked out successfully.",
      ),
    )
  } catch (err) {
    return adminErrorResponse(err, "POST /api/admin/check-in/action")
  }
}
