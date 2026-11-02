import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { sendPaymentRejectedEmail, sendRegistrationConfirmationEmail } from "@/lib/email/resend"
import { requirePermission } from "@/lib/rbac"
import { buildRegistrationInvoicePdf } from "@/lib/registrations/invoice-pdf"
import { errorResponse, successResponse } from "@/lib/utils"
import { paymentDecisionSchema, paymentIdSchema } from "@/lib/validations/payment"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("payments:verify")
    if (error) {return error}

    const idResult = paymentIdSchema.safeParse((await params).id)
    if (!idResult.success) {
      return NextResponse.json(errorResponse("Payment not found.", "NOT_FOUND"), { status: 404 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(errorResponse("Invalid JSON body.", "INVALID_JSON"), { status: 400 })
    }
    const parsed = paymentDecisionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse("Please fix the highlighted fields and try again.", "VALIDATION", parsed.error.flatten().fieldErrors as Record<string, string[]>),
        { status: 422 },
      )
    }

    const existing = await prisma.payment.findUnique({
      where: { id: idResult.data },
      select: {
        id: true,
        amount: true,
        method: true,
        transactionId: true,
        status: true,
        registration: {
          select: {
            id: true,
            registrationId: true,
            status: true,
            registrationPhase: true,
            userId: true,
            user: {
              select: { email: true, name: true, profile: { select: { fullName: true } } },
            },
            event: { select: { name: true, type: true, registrationFee: true } },
            team: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!existing) {throw new AdminError("Payment not found.", "NOT_FOUND", 404)}
    if (existing.status !== "PENDING") {
      throw new AdminError("This payment has already been reviewed.", "ALREADY_REVIEWED", 409)
    }

    const reviewedAt = new Date()
    if (parsed.data.status === "REJECTED") {
      const updated = await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.update({
          where: { id: existing.id },
          data: { status: "REJECTED", verifiedBy: session.user.id, verifiedAt: reviewedAt },
          select: { id: true, status: true },
        })
        if (
          existing.registration.registrationPhase === "FINAL" &&
          existing.registration.status === "PAYMENT_PENDING"
        ) {
          await tx.eventRegistration.update({
            where: { id: existing.registration.id },
            data: { status: "PRELIM_APPROVED" },
          })
        }
        return payment
      })
      await auditLog({
        actorId: session.user.id,
        action: "PAYMENT_REJECTED",
        targetType: "Payment",
        targetId: existing.id,
        before: { status: existing.status },
        after: { status: updated.status },
        metadata: {
          registrationId: existing.registration.registrationId,
          reason: parsed.data.reason,
        },
        ipAddress: extractIpAddress(request),
        userAgent: extractUserAgent(request),
      })
      const name = existing.registration.user.profile?.fullName ?? existing.registration.user.name ?? "Participant"
      const email = await sendPaymentRejectedEmail({
        to: existing.registration.user.email,
        name,
        eventName: existing.registration.event.name,
        reason: parsed.data.reason!,
        userId: existing.registration.userId,
      })
      return NextResponse.json(successResponse({
        id: updated.id,
        status: updated.status,
        registrationStatus: existing.registration.registrationPhase === "FINAL" ? "PRELIM_APPROVED" : existing.registration.status,
        emailSent: email.success,
      }, "Payment rejected."))
    }

    if (
      existing.registration.status !== "PAYMENT_PENDING" &&
      existing.registration.status !== "PENDING_PAYMENT"
    ) {
      throw new AdminError("The registration is not awaiting payment verification.", "INVALID_STATUS", 409)
    }
    if (!existing.transactionId) {
      throw new AdminError("The payment transaction could not be verified.", "INVALID_PAYMENT", 409)
    }

    const name = existing.registration.user.profile?.fullName ?? existing.registration.user.name ?? "Participant"
    const invoicePdf = await buildRegistrationInvoicePdf({
      registrationId: existing.registration.registrationId,
      participantName: name,
      eventName: existing.registration.event.name,
      teamName: existing.registration.team?.name ?? null,
      amount: existing.amount.toString(),
      issuedAt: reviewedAt,
      payment: {
        method: existing.method,
        transactionId: existing.transactionId,
        paidAt: reviewedAt,
      },
    })

    const updated = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { id: existing.id },
        data: { status: "VERIFIED", verifiedBy: session.user.id, verifiedAt: reviewedAt },
        select: { id: true, status: true },
      })
      if (existing.registration.event.type === "CTF" && existing.registration.team) {
        await tx.eventRegistration.updateMany({
          where: { teamId: existing.registration.team.id, registrationPhase: "FINAL", status: { in: ["PRELIM_APPROVED", "PAYMENT_PENDING"] } },
          data: { status: "CONFIRMED" },
        })
      } else {
        await tx.eventRegistration.update({
          where: { id: existing.registration.id },
          data: { status: "CONFIRMED" },
        })
      }
      return payment
    })

    await auditLog({
      actorId: session.user.id,
      action: "PAYMENT_VERIFIED",
      targetType: "Payment",
      targetId: existing.id,
      before: { status: existing.status, registrationStatus: existing.registration.status },
      after: { status: updated.status, registrationStatus: "CONFIRMED" },
      metadata: { registrationId: existing.registration.registrationId, eventName: existing.registration.event.name },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    const teamRegistrations =
      existing.registration.event.type === "CTF" && existing.registration.team
        ? await prisma.eventRegistration.findMany({
            where: { teamId: existing.registration.team.id, status: "CONFIRMED" },
            select: {
              registrationId: true,
              userId: true,
              user: { select: { email: true, name: true, profile: { select: { fullName: true } } } },
            },
          })
        : []
    const emailResults = teamRegistrations.length > 0
      ? await Promise.all(teamRegistrations.map((registration) => sendRegistrationConfirmationEmail({
          to: registration.user.email,
          name: registration.user.profile?.fullName ?? registration.user.name ?? "Participant",
          registrationId: registration.registrationId,
          eventName: existing.registration.event.name,
          teamName: existing.registration.team?.name ?? undefined,
          invoicePdf,
          userId: registration.userId,
        })))
      : [await sendRegistrationConfirmationEmail({
          to: existing.registration.user.email,
          name,
          registrationId: existing.registration.registrationId,
          eventName: existing.registration.event.name,
          teamName: existing.registration.team?.name ?? undefined,
          invoicePdf,
          userId: existing.registration.userId,
        })]
    return NextResponse.json(successResponse({
      id: updated.id,
      status: updated.status,
      registrationStatus: "CONFIRMED",
      emailSent: emailResults.every((email) => email.success),
    }, "Payment verified and registration confirmed."))
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/payments/[id]")
  }
}
