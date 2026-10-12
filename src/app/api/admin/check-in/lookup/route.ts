// =============================================================================
// POST /api/admin/check-in/lookup
// Resolve a participant for check-in from either:
// - a signed QR token (from the participant's dashboard pass), or
// - a manually typed registration ID (CYB26-XXXXXX) fallback.
//
// Requires "registrations:checkin". Returns a door-staff summary:
// participant identity, verification status, every registered event and the
// current check-in state. Mutations happen only through /check-in/action.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { verifyQrToken } from "@/lib/security/qr"
import { errorResponse, successResponse } from "@/lib/utils"
import { checkInLookupSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("registrations:checkin")
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

    const parsed = checkInLookupSchema.safeParse(body)
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

    // ── Resolve the registration ID ─────────────────────────────────────────
    let registrationId: string
    if (parsed.data.token) {
      try {
        ({ registrationId } = await verifyQrToken(parsed.data.token))
      } catch {
        throw new AdminError(
          "Invalid or expired QR code. Ask the participant to refresh their pass, or enter the registration ID manually.",
          "INVALID_QR",
          400,
        )
      }
    } else {
      registrationId = parsed.data.registrationId!.toUpperCase()
    }

    // ── Load the registration + participant summary ────────────────────────
    const registration = await prisma.eventRegistration.findUnique({
      where: { registrationId },
      select: {
        id: true,
        registrationId: true,
        status: true,
        checkInStatus: true,
        checkInTime: true,
        checkOutTime: true,
        createdAt: true,
        event: { select: { id: true, name: true, type: true } },
        team: { select: { id: true, name: true } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isSuspended: true,
            profile: {
              select: {
                fullName: true,
                studentId: true,
                department: true,
                phone: true,
                university: { select: { name: true, shortName: true } },
              },
            },
            studentVerifications: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { status: true },
            },
          },
        },
      },
    })

    if (!registration) {
      throw new AdminError(
        "No registration found for this ID. Check the code and try again.",
        "NOT_FOUND",
        404,
      )
    }

    // ── Every event this participant registered for ─────────────────────────
    const registeredEvents = await prisma.eventRegistration.findMany({
      where: { userId: registration.user.id },
      orderBy: { createdAt: "asc" },
      select: {
        registrationId: true,
        status: true,
        checkInStatus: true,
        event: { select: { name: true, type: true } },
      },
    })

    return NextResponse.json(
      successResponse({
        registration: {
          id: registration.id,
          registrationId: registration.registrationId,
          status: registration.status,
          checkInStatus: registration.checkInStatus,
          checkInTime: registration.checkInTime,
          checkOutTime: registration.checkOutTime,
          createdAt: registration.createdAt,
          event: registration.event,
          team: registration.team,
        },
        participant: {
          userId: registration.user.id,
          name:
            registration.user.profile?.fullName ||
            registration.user.name ||
            "Unnamed participant",
          email: registration.user.email,
          isSuspended: registration.user.isSuspended,
          studentId: registration.user.profile?.studentId ?? null,
          department: registration.user.profile?.department ?? null,
          phone: registration.user.profile?.phone ?? null,
          university: registration.user.profile?.university ?? null,
          verificationStatus:
            registration.user.studentVerifications[0]?.status ?? "NOT_SUBMITTED",
        },
        registeredEvents,
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "POST /api/admin/check-in/lookup")
  }
}
