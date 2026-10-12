// =============================================================================
// GET /api/registrations/[id]/confirmation
// Download the registration confirmation pass as a PDF.
// [id] = human-readable registration ID (e.g. CYB26-ABC123).
//
// Access: the registration owner, or an admin with registrations:view.
// The embedded QR contains ONLY the signed registration ID — no PII.
// Every download is audit-logged.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { hasPermission, isAdminRole, requireAuth } from "@/lib/rbac"
import { buildRegistrationConfirmationPdf } from "@/lib/registrations/confirmation-pdf"
import { generateQrDataUrl, signQrToken } from "@/lib/security/qr"
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit"
import { errorResponse } from "@/lib/utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteParams = { params: Promise<{ id: string }> }

/** Registration IDs are generated as CYB26-XXXXXX — keep lookups tight. */
const REGISTRATION_ID_PATTERN = /^[A-Za-z0-9]{2,12}-[A-Za-z0-9]{4,12}$/

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const { session, error } = await requireAuth()
    if (error) {return error}

    const limit = await checkRateLimit(
      "global",
      `confirmation:${session.user.id}`,
    )
    if (!limit.success) {
      return rateLimitExceededResponse(limit.retryAfter)
    }

    // ── Locate the registration ───────────────────────────────────────────────
    const { id } = await params
    if (!id || id.length > 40 || !REGISTRATION_ID_PATTERN.test(id)) {
      return NextResponse.json(
        errorResponse("Registration not found.", "NOT_FOUND"),
        { status: 404 },
      )
    }

    const registration = await prisma.eventRegistration.findUnique({
      where: { registrationId: id },
      select: {
        registrationId: true,
        userId: true,
        status: true,
        user: { select: { name: true, email: true } },
        event: { select: { name: true } },
        team: { select: { name: true } },
      },
    })
    if (!registration) {
      return NextResponse.json(
        errorResponse("Registration not found.", "NOT_FOUND"),
        { status: 404 },
      )
    }

    // ── Authorization: owner or admin with registrations:view ─────────────────
    const isOwner = session.user.id === registration.userId
    const isAdminViewer =
      isAdminRole(session.user.role) &&
      hasPermission(session.user.adminRole, "registrations:view")
    if (!isOwner && !isAdminViewer) {
      return NextResponse.json(
        errorResponse(
          "You do not have permission to view this confirmation.",
          "FORBIDDEN",
        ),
        { status: 403 },
      )
    }

    if (registration.status === "CANCELLED") {
      return NextResponse.json(
        errorResponse(
          "This registration was cancelled — a confirmation pass is not available.",
          "REGISTRATION_CANCELLED",
        ),
        { status: 409 },
      )
    }

    // ── Participant display name (profile full name → account name → email) ──
    const profile = await prisma.participantProfile.findUnique({
      where: { userId: registration.userId },
      select: { fullName: true },
    })
    const participantName =
      profile?.fullName ?? registration.user.name ?? registration.user.email

    // ── QR (signed registration ID only) + PDF ────────────────────────────────
    const token = await signQrToken(registration.registrationId)
    const qrDataUrl = await generateQrDataUrl(token, "print")

    const pdfBytes = await buildRegistrationConfirmationPdf({
      registrationId: registration.registrationId,
      participantName,
      eventName: registration.event.name,
      teamName: registration.team?.name ?? null,
      qrDataUrl,
    })

    // ── Audit ─────────────────────────────────────────────────────────────────
    await auditLog({
      actorId: session.user.id,
      action: "REGISTRATION_CONFIRMATION_DOWNLOADED",
      targetType: "EventRegistration",
      targetId: registration.registrationId,
      metadata: {
        eventName: registration.event.name,
        downloadedBy: isOwner ? "self" : "admin",
      },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    // ── Response — private, never cached, never indexed ───────────────────────
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="DIU-CyberCon-2026-${registration.registrationId}.pdf"`,
        "Content-Length": String(pdfBytes.length),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (err) {
    console.error("[GET /api/registrations/[id]/confirmation]", err)
    return NextResponse.json(
      errorResponse(
        "Could not generate the confirmation right now. Please try again.",
        "INTERNAL",
      ),
      { status: 500 },
    )
  }
}
