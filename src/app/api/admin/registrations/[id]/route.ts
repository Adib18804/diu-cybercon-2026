// =============================================================================
// PATCH /api/admin/registrations/[id]
// Change a registration's status (PENDING / CONFIRMED / REJECTED / CANCELLED /
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
import { APP_URL } from "@/lib/constants"
import { sendFinalRegistrationInvitationEmail, sendRegistrationConfirmationEmail, sendRegistrationRejectedEmail } from "@/lib/email/resend"
import { requirePermission } from "@/lib/rbac"
import { createFinalRegistrationToken } from "@/lib/registrations/finalization"
import { buildRegistrationInvoicePdf } from "@/lib/registrations/invoice-pdf"
import { errorResponse, successResponse } from "@/lib/utils"
import { registrationStatusUpdateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

const STATUS_MESSAGES: Record<string, string> = {
  PENDING: "Registration moved back to pending.",
  PRELIM_APPROVED: "Preliminary registration approved. The participant has been invited to complete final registration and payment.",
  CONFIRMED: "Registration confirmed.",
  REJECTED: "Registration rejected.",
  CANCELLED: "Registration cancelled.",
  WAITLISTED: "Registration moved to the waitlist.",
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "pending",
  PRELIM_APPROVED: "preliminary approved",
  PAYMENT_PENDING: "payment pending",
  CONFIRMED: "confirmed",
  REJECTED: "rejected",
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

    const { status, reason } = parsed.data

    const existing = await prisma.eventRegistration.findUnique({
      where: { id },
      select: {
        id: true,
        registrationId: true,
        status: true,
        registrationPhase: true,
        checkInStatus: true,
        userId: true,
        user: {
          select: {
            email: true,
            name: true,
            profile: { select: { fullName: true } },
          },
        },
        event: { select: { name: true, type: true, registrationFee: true } },
        team: { select: { id: true, name: true, leaderId: true } },
      },
    })

    if (!existing) {
      throw new AdminError("Registration not found.", "NOT_FOUND", 404)
    }
    if (status === "PENDING_PAYMENT" || status === "PAYMENT_PENDING") {
      throw new AdminError(
        "Payment status is managed through the payment verification workflow.",
        "INVALID_TRANSITION",
        409,
      )
    }
    if (status === "PRELIM_APPROVED" && (
      existing.status !== "PENDING" ||
      existing.registrationPhase !== "PRELIMINARY" ||
      !["CTF", "INNOVATION_SYMPOSIUM"].includes(existing.event.type)
    )) {
      throw new AdminError(
        "Only pending preliminary CTF or Innovation Symposium registrations can be approved for the final phase.",
        "INVALID_TRANSITION",
        409,
      )
    }
    if (existing.status === status) {
      throw new AdminError(
        `This registration is already ${STATUS_LABELS[status] ?? status.toLowerCase()}.`,
        "ALREADY_IN_STATUS",
        409,
      )
    }
    if (status === "REJECTED" && existing.status !== "PENDING") {
      throw new AdminError(
        "Only pending registrations can be rejected.",
        "INVALID_TRANSITION",
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
    if (status === "CONFIRMED" && existing.event.registrationFee.greaterThan(0)) {
      const verifiedPayment = await prisma.payment.findFirst({
        where: { registrationId: existing.id, status: "VERIFIED" },
        select: { id: true },
      })
      if (!verifiedPayment) {
        throw new AdminError(
          "Verify the registration payment before confirming this registration.",
          "PAYMENT_REQUIRED",
          409,
        )
      }
    }

    const approvalInvoice =
      status === "CONFIRMED" && existing.status === "PENDING"
        ? await buildRegistrationInvoicePdf({
            registrationId: existing.registrationId,
            participantName:
              existing.user.profile?.fullName ?? existing.user.name ?? existing.user.email,
            eventName: existing.event.name,
            teamName: existing.team?.name ?? null,
            amount: existing.event.registrationFee.toString(),
            issuedAt: new Date(),
          })
        : undefined

    const updated = await prisma.eventRegistration.update({
      where: { id },
      data: {
        status,
        ...(status === "PRELIM_APPROVED" ? { registrationPhase: "FINAL" as const } : {}),
      },
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
        ...(status === "REJECTED" && reason ? { rejectionReason: reason } : {}),
        via: "admin-registrations",
      },
    })

    let emailSent: boolean | undefined
    if (
      status === "PRELIM_APPROVED" &&
      (existing.event.type !== "CTF" || !existing.team || existing.team.leaderId === existing.userId)
    ) {
      const token = createFinalRegistrationToken(existing.registrationId, existing.userId)
      const finalRegistrationUrl = new URL("/dashboard/events", APP_URL)
      finalRegistrationUrl.searchParams.set("registration", existing.registrationId)
      finalRegistrationUrl.searchParams.set("finalToken", token)
      const bkashSetting = await prisma.siteSetting.findUnique({
        where: { key: "payment.bkashNumber" },
        select: { value: true },
      }).catch(() => null)
      const email = await sendFinalRegistrationInvitationEmail({
        to: existing.user.email,
        name: existing.user.profile?.fullName ?? existing.user.name ?? "Participant",
        registrationId: existing.registrationId,
        eventName: existing.event.name,
        registrationFee: existing.event.registrationFee.toString(),
        bkashNumber: bkashSetting?.value.trim() ?? "",
        finalRegistrationUrl: finalRegistrationUrl.toString(),
        userId: existing.userId,
      })
      emailSent = email.success
    } else if (approvalInvoice) {
      const email = await sendRegistrationConfirmationEmail({
        to: existing.user.email,
        name: existing.user.profile?.fullName ?? existing.user.name ?? "Participant",
        registrationId: existing.registrationId,
        eventName: existing.event.name,
        teamName: existing.team?.name ?? undefined,
        invoicePdf: approvalInvoice,
        userId: existing.userId,
      })
      emailSent = email.success
    } else if (status === "REJECTED" && existing.status === "PENDING" && reason) {
      const email = await sendRegistrationRejectedEmail({
        to: existing.user.email,
        name: existing.user.profile?.fullName ?? existing.user.name ?? "Participant",
        registrationId: existing.registrationId,
        eventName: existing.event.name,
        reason,
        userId: existing.userId,
      })
      emailSent = email.success
    }

    return NextResponse.json(
      successResponse(
        { ...updated, ...(emailSent !== undefined ? { emailSent } : {}) },
        STATUS_MESSAGES[status] ?? "Registration updated.",
      ),
    )
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/registrations/[id]")
  }
}
