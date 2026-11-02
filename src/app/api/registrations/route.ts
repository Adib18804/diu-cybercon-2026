// =============================================================================
// POST /api/registrations
// Submit an event registration (solo or full team, leader-authenticated).
// Auth required. Rate-limited. Server-side validation + full business rules.
// =============================================================================

import { Prisma } from "@prisma/client"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/rbac"
import {
  RegistrationError,
  registerForEvent,
} from "@/lib/registrations/service"
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit"
import { errorResponse, successResponse } from "@/lib/utils"
import {
  ctfRegistrationSchema,
  innovationSymposiumRegistrationSchema,
  submitRegistrationSchema,
} from "@/lib/validations/registration"

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

    const selectedEvent = await prisma.event.findUnique({
      where: { id: parsed.data.eventId },
      select: { type: true },
    })
    if (!selectedEvent) {
      return NextResponse.json(errorResponse("Event not found.", "EVENT_NOT_FOUND"), { status: 404 })
    }

    const eventSchema = selectedEvent.type === "INNOVATION_SYMPOSIUM"
      ? innovationSymposiumRegistrationSchema
      : selectedEvent.type === "CTF"
        ? ctfRegistrationSchema
      : submitRegistrationSchema
    const eventParsed = eventSchema.safeParse(body)
    if (!eventParsed.success) {
      return NextResponse.json(
        errorResponse(
          "Please fix the highlighted fields and try again.",
          "VALIDATION_ERROR",
          eventParsed.error.flatten().fieldErrors as Record<string, string[]>,
        ),
        { status: 422 },
      )
    }

    // ── Business rules + transaction ──────────────────────────────────────────
    const result = await registerForEvent({
      userId: session.user.id,
      input: eventParsed.data,
    })

    // ── Post-transaction: audit ────────────────────────────────────────────────
    const ipAddress = extractIpAddress(request)
    const userAgent = extractUserAgent(request)

    const registrations = result.registrations.map((reg) => ({
      ...reg,
      qrDataUrl: null,
    }))

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
          registrationPhase: "PRELIMINARY",
          status: "PENDING",
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

    // ── Response ──────────────────────────────────────────────────────────────
    return NextResponse.json(
      successResponse(
        {
          eventId: result.eventId,
          eventName: result.eventName,
          eventType: result.eventType,
          registrationPhase: "PRELIMINARY",
          status: "PENDING",
          teamName: result.teamName,
          emailSent: false,
          registrations: registrations.map((reg) => ({
            registrationId: reg.registrationId,
            participantName: reg.participantName,
            isLeader: reg.isLeader,
            qrDataUrl: reg.qrDataUrl,
          })),
        },
        "Registration submitted for review.",
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
