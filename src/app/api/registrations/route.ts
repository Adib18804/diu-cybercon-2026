// =============================================================================
// POST /api/registrations
// Submit an event registration (solo or full team, leader-authenticated).
// Auth required. Rate-limited. Server-side validation + full business rules.
// =============================================================================

import { Prisma } from "@prisma/client"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { sendRegistrationConfirmationEmail } from "@/lib/email/resend"
import { requireAuth } from "@/lib/rbac"
import {
  RegistrationError,
  registerForEvent,
} from "@/lib/registrations/service"
import { generateQrDataUrl, signQrToken } from "@/lib/security/qr"
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit"
import { errorResponse, successResponse } from "@/lib/utils"
import { submitRegistrationSchema } from "@/lib/validations/registration"

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

    const parsed = submitRegistrationSchema.safeParse(body)
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
    const result = await registerForEvent({
      userId: session.user.id,
      input: parsed.data,
    })

    // ── Post-transaction: QR codes, audit, emails ─────────────────────────────
    const ipAddress = extractIpAddress(request)
    const userAgent = extractUserAgent(request)

    // QR codes — the token contains ONLY the signed registration ID (no PII).
    const registrations = await Promise.all(
      result.registrations.map(async (reg) => {
        let qrDataUrl: string | null = null
        try {
          const token = await signQrToken(reg.registrationId)
          qrDataUrl = await generateQrDataUrl(token)
        } catch (err) {
          console.error("[POST /api/registrations] QR generation failed:", err)
        }
        return { ...reg, qrDataUrl }
      }),
    )

    // Audit trail
    for (const reg of registrations) {
      await auditLog({
        actorId: session.user.id,
        action: "REGISTRATION_CREATED",
        targetType: "EventRegistration",
        targetId: reg.registrationId,
        after: {
          eventId: result.eventId,
          eventType: result.eventType,
          registrationId: reg.registrationId,
          participant: reg.participantName,
          isLeader: reg.isLeader,
          teamId: result.teamId,
        },
        ipAddress,
        userAgent,
      })
    }
    if (result.teamId) {
      await auditLog({
        actorId: session.user.id,
        action: "TEAM_CREATED",
        targetType: "Team",
        targetId: result.teamId,
        after: {
          name: result.teamName,
          eventId: result.eventId,
          size: result.registrations.length,
        },
        ipAddress,
        userAgent,
      })
      for (const member of result.registrations.filter((r) => !r.isLeader)) {
        await auditLog({
          actorId: session.user.id,
          action: "TEAM_MEMBER_ADDED",
          targetType: "TeamMember",
          targetId: member.registrationId,
          metadata: { teamId: result.teamId, memberEmail: member.email },
          ipAddress,
          userAgent,
        })
      }
    }

    // Confirmation emails — one per participant, never blocking the response.
    const emailResults = await Promise.all(
      registrations.map((reg) =>
        sendRegistrationConfirmationEmail({
          to: reg.email,
          name: reg.participantName,
          registrationId: reg.registrationId,
          eventName: result.eventName,
          teamName: result.teamName ?? undefined,
        }),
      ),
    )
    const emailSent = emailResults[0]?.success ?? false

    // ── Response ──────────────────────────────────────────────────────────────
    return NextResponse.json(
      successResponse(
        {
          eventId: result.eventId,
          eventName: result.eventName,
          eventType: result.eventType,
          teamName: result.teamName,
          emailSent,
          registrations: registrations.map((reg) => ({
            registrationId: reg.registrationId,
            participantName: reg.participantName,
            isLeader: reg.isLeader,
            qrDataUrl: reg.qrDataUrl,
          })),
        },
        "Registration confirmed.",
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
          "This registration was just submitted. Please check your dashboard.",
          "DUPLICATE_REGISTRATION",
        ),
        { status: 409 },
      )
    }
    console.error("[POST /api/registrations]", err)
    return NextResponse.json(
      errorResponse("Something went wrong. Please try again.", "INTERNAL"),
      { status: 500 },
    )
  }
}
