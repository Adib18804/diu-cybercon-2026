// =============================================================================
// POST /api/registrations/workshop
// Register for a Hands-on Activity (workshop). Auth required, rate-limited,
// atomic seat claim so concurrent submissions can never oversell capacity.
// =============================================================================

import { Prisma } from "@prisma/client"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { sendWorkshopConfirmationEmail } from "@/lib/email/resend"
import { requireAuth } from "@/lib/rbac"
import {
  RegistrationError,
  registerForWorkshop,
} from "@/lib/registrations/service"
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit"
import { errorResponse, formatDate, successResponse } from "@/lib/utils"
import { workshopRegistrationSchema } from "@/lib/validations/registration"

export const runtime = "nodejs"

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const { session, error } = await requireAuth()
    if (error) {return error}

    // ── Rate limit per account ────────────────────────────────────────────────
    const limit = await checkRateLimit("registration", session.user.id)
    if (!limit.success) {
      return rateLimitExceededResponse(limit.retryAfter)
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

    const parsed = workshopRegistrationSchema.safeParse(body)
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

    // ── Business rules + transaction ──────────────────────────────────────────
    const result = await registerForWorkshop({
      userId: session.user.id,
      input: parsed.data,
    })

    // ── Post-transaction: audit + confirmation email ──────────────────────────
    const ipAddress = extractIpAddress(request)
    const userAgent = extractUserAgent(request)

    await auditLog({
      actorId: session.user.id,
      action: "WORKSHOP_REGISTERED",
      targetType: "Workshop",
      targetId: result.workshopId,
      after: {
        title: result.workshopTitle,
        seatsRemaining: result.seatsRemaining,
      },
      ipAddress,
      userAgent,
    })

    const emailResult = await sendWorkshopConfirmationEmail({
      to: session.user.email,
      name: parsed.data.participant.fullName,
      workshopTitle: result.workshopTitle,
      dateLabel: formatDate(result.workshopDate),
      startTime: result.startTime,
      endTime: result.endTime,
      venue: result.venue,
    })

    // ── Response ──────────────────────────────────────────────────────────────
    return NextResponse.json(
      successResponse(
        {
          workshopId: result.workshopId,
          workshopTitle: result.workshopTitle,
          seatsRemaining: result.seatsRemaining,
          emailSent: emailResult.success,
        },
        "Workshop registration confirmed.",
      ),
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json(
        errorResponse(err.message, err.code, err.details),
        { status: err.status },
      )
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        errorResponse(
          "You are already registered for this workshop.",
          "DUPLICATE_WORKSHOP_REGISTRATION",
        ),
        { status: 409 },
      )
    }
    console.error("[POST /api/registrations/workshop]", err)
    return NextResponse.json(
      errorResponse("Something went wrong. Please try again.", "INTERNAL"),
      { status: 500 },
    )
  }
}
