// =============================================================================
// PATCH  /api/submissions/project/[id] — edit a project submission (owner only,
//   only while the submission is editable). A successful edit resets the
//   status to SUBMITTED so the review workflow always runs on latest content.
// DELETE /api/submissions/project/[id] — soft-delete a project submission
//   (owner only, only while not approved/published).
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { requireAuth } from "@/lib/rbac"
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit"
import { submissionErrorResponse } from "@/lib/submissions/http"
import {
  deleteProjectSubmission,
  updateProjectSubmission,
} from "@/lib/submissions/service"
import { errorResponse, successResponse } from "@/lib/utils"
import { projectSubmissionUpdateSchema } from "@/lib/validations/submission"

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

    const parsed = projectSubmissionUpdateSchema.safeParse(body)
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

    const submission = await updateProjectSubmission({
      userId: session.user.id,
      submissionId: id,
      input: parsed.data,
    })

    await auditLog({
      actorId: session.user.id,
      action: "PROJECT_UPDATED",
      targetType: "Project",
      targetId: submission.id,
      after: {
        projectName: submission.projectName,
        teamName: submission.teamName,
        status: submission.status,
      },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse(
        submission,
        "Project updated. It will be re-reviewed with your changes.",
      ),
    )
  } catch (err) {
    return submissionErrorResponse(err, "PATCH /api/submissions/project/[id]")
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

    await deleteProjectSubmission({
      userId: session.user.id,
      submissionId: id,
    })

    await auditLog({
      actorId: session.user.id,
      action: "PROJECT_DELETED",
      targetType: "Project",
      targetId: id,
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse({ deleted: true }, "Project submission deleted."),
    )
  } catch (err) {
    return submissionErrorResponse(err, "DELETE /api/submissions/project/[id]")
  }
}
