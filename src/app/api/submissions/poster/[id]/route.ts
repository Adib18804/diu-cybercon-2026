// =============================================================================
// PATCH  /api/submissions/poster/[id] — edit a poster submission (owner only,
//   only while editable). A successful edit resets the status to SUBMITTED.
// DELETE /api/submissions/poster/[id] — soft-delete (owner only, only while
//   not approved/published).
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { requireAuth } from "@/lib/rbac"
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit"
import { submissionErrorResponse } from "@/lib/submissions/http"
import {
  deletePosterSubmission,
  updatePosterSubmission,
} from "@/lib/submissions/service"
import { errorResponse, successResponse } from "@/lib/utils"
import { posterSubmissionUpdateSchema } from "@/lib/validations/submission"

export const runtime = "nodejs"

type RouteParams = { params: Promise<{ id: string }> }

// ─── PATCH — edit ─────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error } = await requireAuth()
    if (error) {return error}

    const limit = await checkRateLimit("submission", session.user.id)
    if (!limit.success) {
      return rateLimitExceededResponse(limit.retryAfter)
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json(
        errorResponse("Submission not found.", "NOT_FOUND"),
        { status: 404 },
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        errorResponse("Invalid request body.", "INVALID_JSON"),
        { status: 400 },
      )
    }

    const parsed = posterSubmissionUpdateSchema.safeParse(body)
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

    const submission = await updatePosterSubmission({
      userId: session.user.id,
      submissionId: id,
      input: parsed.data,
    })

    await auditLog({
      actorId: session.user.id,
      action: "POSTER_UPDATED",
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

    return NextResponse.json(
      successResponse(
        submission,
        "Poster updated. It will be re-reviewed with your changes.",
      ),
    )
  } catch (err) {
    return submissionErrorResponse(err, "PATCH /api/submissions/poster/[id]")
  }
}

// ─── DELETE — soft delete ─────────────────────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { session, error } = await requireAuth()
    if (error) {return error}

    const limit = await checkRateLimit("submission", session.user.id)
    if (!limit.success) {
      return rateLimitExceededResponse(limit.retryAfter)
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json(
        errorResponse("Submission not found.", "NOT_FOUND"),
        { status: 404 },
      )
    }

    await deletePosterSubmission({
      userId: session.user.id,
      submissionId: id,
    })

    await auditLog({
      actorId: session.user.id,
      action: "POSTER_DELETED",
      targetType: "Poster",
      targetId: id,
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse({ deleted: true }, "Poster submission deleted."),
    )
  } catch (err) {
    return submissionErrorResponse(err, "DELETE /api/submissions/poster/[id]")
  }
}
