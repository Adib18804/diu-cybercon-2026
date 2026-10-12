// =============================================================================
// POST /api/submissions/poster — create a Poster Presentation submission
// Auth required. Rate-limited. Server-side validation + business rules.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { sendSubmissionReceivedEmail } from "@/lib/email/resend"
import { requireAuth } from "@/lib/rbac"
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit"
import { submissionErrorResponse } from "@/lib/submissions/http"
import { createPosterSubmission } from "@/lib/submissions/service"
import { errorResponse, successResponse } from "@/lib/utils"
import { posterSubmissionSchema } from "@/lib/validations/submission"

export const runtime = "nodejs"

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const { session, error } = await requireAuth()
    if (error) {return error}

    // ── Rate limit per account ────────────────────────────────────────────────
    const limit = await checkRateLimit("submission", session.user.id)
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

    const parsed = posterSubmissionSchema.safeParse(body)
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

    // ── Business rules (registration gate, duplicates, upload token) ─────────
    const submission = await createPosterSubmission({
      userId: session.user.id,
      input: parsed.data,
    })

    // ── Audit trail ──────────────────────────────────────────────────────────
    await auditLog({
      actorId: session.user.id,
      action: "POSTER_SUBMITTED",
      targetType: "Poster",
      targetId: submission.id,
      after: {
        title: submission.title,
        teamName: submission.teamName,
        status: submission.status,
      },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    // ── Receipt email (best-effort — never blocks the submission) ────────────
    const receipt = await sendSubmissionReceivedEmail({
      to: session.user.email,
      name: session.user.name?.trim() || session.user.email.split("@")[0] || "there",
      kind: "poster",
      submissionName: submission.title,
      userId: session.user.id,
    })
    if (!receipt.success) {
      console.error("[POST /api/submissions/poster] receipt email failed:", receipt.error)
    }

    return NextResponse.json(
      successResponse(
        submission,
        "Poster submitted. The review team will get back to you soon.",
      ),
      { status: 201 },
    )
  } catch (err) {
    return submissionErrorResponse(err, "POST /api/submissions/poster")
  }
}
