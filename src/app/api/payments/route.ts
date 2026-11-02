import { Prisma } from "@prisma/client"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/rbac"
import { verifyFinalRegistrationToken } from "@/lib/registrations/finalization"
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit"
import { errorResponse, successResponse } from "@/lib/utils"
import { paymentSubmissionSchema } from "@/lib/validations/payment"

export const runtime = "nodejs"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { session, error } = await requireAuth()
  if (error) {return error}

  const rate = await checkRateLimit("registration", session.user.id)
  if (!rate.success) {return rateLimitExceededResponse(rate.retryAfter)}

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(errorResponse("Invalid JSON body.", "INVALID_JSON"), { status: 400 })
  }

  const parsed = paymentSubmissionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      errorResponse("Please fix the highlighted fields and try again.", "VALIDATION", parsed.error.flatten().fieldErrors as Record<string, string[]>),
      { status: 422 },
    )
  }

  const registration = await prisma.eventRegistration.findUnique({
    where: { registrationId: parsed.data.registrationId.toUpperCase() },
    select: {
      id: true,
      registrationId: true,
      userId: true,
      status: true,
      registrationPhase: true,
      team: { select: { id: true, leaderId: true } },
      event: { select: { name: true, type: true, registrationFee: true } },
      payments: {
        where: { status: { in: ["VERIFIED", "PENDING"] } },
        select: { id: true, status: true },
      },
    },
  })
  if (!registration || registration.userId !== session.user.id) {
    return NextResponse.json(errorResponse("Registration not found.", "NOT_FOUND"), { status: 404 })
  }
  if (
    registration.status !== "PRELIM_APPROVED" &&
    registration.status !== "PAYMENT_PENDING" &&
    registration.status !== "PENDING_PAYMENT"
  ) {
    return NextResponse.json(errorResponse("This registration is not awaiting payment.", "INVALID_STATUS"), { status: 409 })
  }
  if (registration.registrationPhase === "FINAL") {
    const claims = verifyFinalRegistrationToken(parsed.data.finalizationToken)
    if (
      !claims ||
      claims.registrationId !== registration.registrationId ||
      claims.userId !== session.user.id
    ) {
      return NextResponse.json(errorResponse("Use the valid final-registration link sent to your email.", "INVALID_FINAL_LINK"), { status: 403 })
    }
    if (registration.status !== "PRELIM_APPROVED") {
      return NextResponse.json(errorResponse("A payment is already awaiting review.", "PAYMENT_PENDING"), { status: 409 })
    }
  }
  if (registration.event.type === "CTF") {
    if (!registration.team || registration.team.leaderId !== session.user.id) {
      return NextResponse.json(errorResponse("The CTF team leader must submit the team's single payment.", "TEAM_LEADER_PAYMENT_REQUIRED"), { status: 403 })
    }
    const teamRegistrations = await prisma.eventRegistration.findMany({
      where: { teamId: registration.team.id },
      select: { status: true, registrationPhase: true },
    })
    if (teamRegistrations.length === 0 || teamRegistrations.some((member) => member.status !== "PRELIM_APPROVED" || member.registrationPhase !== "FINAL")) {
      return NextResponse.json(errorResponse("Every CTF team member must be preliminarily approved before the team leader submits payment.", "TEAM_APPROVALS_PENDING"), { status: 409 })
    }
  }
  if (registration.event.registrationFee.lessThanOrEqualTo(0)) {
    return NextResponse.json(errorResponse("No payment is due for this event.", "NO_PAYMENT_DUE"), { status: 409 })
  }
  if (registration.payments.some((payment) => payment.status === "VERIFIED")) {
    return NextResponse.json(errorResponse("This registration already has a verified payment.", "ALREADY_PAID"), { status: 409 })
  }
  if (registration.payments.some((payment) => payment.status === "PENDING")) {
    return NextResponse.json(errorResponse("A payment is already awaiting verification.", "PAYMENT_PENDING"), { status: 409 })
  }

  try {
    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          registrationId: registration.id,
          amount: new Prisma.Decimal(registration.event.registrationFee),
          method: "BKASH",
          transactionId: parsed.data.transactionId,
          status: "PENDING",
        },
        select: { id: true, amount: true, status: true },
      })
      await tx.eventRegistration.update({
        where: { id: registration.id },
        data: { status: registration.registrationPhase === "FINAL" ? "PAYMENT_PENDING" : "PENDING_PAYMENT" },
      })
      return created
    })

    await auditLog({
      actorId: session.user.id,
      action: "PAYMENT_SUBMITTED",
      targetType: "Payment",
      targetId: payment.id,
      after: { amount: payment.amount.toString(), method: "BKASH", status: payment.status },
      metadata: { registrationId: registration.registrationId, eventName: registration.event.name },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(successResponse({
      paymentId: payment.id,
      amount: payment.amount.toString(),
      status: payment.status,
      registrationStatus: registration.registrationPhase === "FINAL" ? "PAYMENT_PENDING" : "PENDING_PAYMENT",
    }, "Payment submitted for verification."), { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(errorResponse("This transaction ID has already been submitted.", "DUPLICATE_TRANSACTION"), { status: 409 })
    }
    console.error("[POST /api/payments]", err)
    return NextResponse.json(errorResponse("Could not submit payment. Please try again.", "INTERNAL"), { status: 500 })
  }
}
