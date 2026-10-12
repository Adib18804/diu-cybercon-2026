// =============================================================================
// GET   /api/admin/projects/[id] — full project submission + submitter
// PATCH /api/admin/projects/[id] — review a project (projects:review)
//
// PATCH validates with projectReviewSchema (status / reviewNote / isFeatured;
// a note is mandatory for REJECTED and REVISION_REQUIRED), stamps the reviewer
// and, when the project is published for the first time, the publish time.
// Every change is written to the audit log as PROJECT_STATUS_CHANGED.
//
// Project.userId is a plain string with NO Prisma relation — the submitter is
// resolved with an explicit user lookup.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { sendSubmissionStatusEmail, type SubmissionReviewStatus } from "@/lib/email/resend"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { projectReviewSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

const STATUS_MESSAGES: Record<string, string> = {
  SUBMITTED: "Project moved back to submitted.",
  UNDER_REVIEW: "Project moved to under review.",
  APPROVED: "Project approved.",
  REJECTED: "Project rejected.",
  REVISION_REQUIRED: "Revision requested for the project.",
  PUBLISHED: "Project published.",
}

/** Review statuses that trigger a notification email to the submitter. */
const NOTIFY_STATUSES = new Set(["APPROVED", "REJECTED", "REVISION_REQUIRED", "PUBLISHED"])

// ─── GET — full submission detail ─────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("projects:view")
    if (error) {return error}

    const { id } = await params

    const project = await prisma.project.findUnique({ where: { id } })

    if (!project || project.deletedAt) {
      throw new AdminError("Project not found.", "NOT_FOUND", 404)
    }

    // Project.userId has no Prisma relation — resolve the submitter manually.
    const submitter = await prisma.user.findUnique({
      where: { id: project.userId },
      select: { id: true, name: true, email: true },
    })

    // Strip the soft-delete marker — it is an internal column.
    const { deletedAt: _deletedAt, ...safeProject } = project
    void _deletedAt

    return NextResponse.json(
      successResponse({ project: { ...safeProject, user: submitter } }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/projects/[id]")
  }
}

// ─── PATCH — review decision ──────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("projects:review")
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

    const parsed = projectReviewSchema.safeParse(body)
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

    const data = parsed.data

    const existing = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        projectName: true,
        status: true,
        publishedAt: true,
        deletedAt: true,
      },
    })

    if (!existing || existing.deletedAt) {
      throw new AdminError("Project not found.", "NOT_FOUND", 404)
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        status: data.status,
        reviewNote: data.reviewNote ?? null,
        ...(data.isFeatured !== undefined ? { isFeatured: data.isFeatured } : {}),
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        ...(data.status === "PUBLISHED" && existing.publishedAt === null
          ? { publishedAt: new Date() }
          : {}),
      },
      select: {
        id: true,
        status: true,
        reviewNote: true,
        isFeatured: true,
        reviewedAt: true,
        publishedAt: true,
        updatedAt: true,
      },
    })

    await auditLog({
      actorId: session.user.id,
      action: "PROJECT_STATUS_CHANGED",
      targetType: "Project",
      targetId: id,
      before: { status: existing.status },
      after: { status: updated.status },
      metadata: {
        reviewNote: updated.reviewNote,
        isFeatured: updated.isFeatured,
      },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    // ── Notify the submitter on a review decision (best-effort) ──────────────
    if (existing.status !== data.status && NOTIFY_STATUSES.has(data.status)) {
      const submitter = await prisma.user.findUnique({
        where: { id: existing.userId },
        select: { id: true, name: true, email: true },
      })
      if (submitter) {
        const result = await sendSubmissionStatusEmail({
          to: submitter.email,
          name: submitter.name?.trim() || submitter.email.split("@")[0] || "there",
          kind: "project",
          submissionName: existing.projectName,
          status: data.status as SubmissionReviewStatus,
          reviewNote: updated.reviewNote ?? undefined,
          userId: submitter.id,
        })
        if (!result.success) {
          console.error(
            "[PATCH /api/admin/projects/[id]] status email failed:",
            result.error,
          )
        }
      }
    }

    return NextResponse.json(
      successResponse(updated, STATUS_MESSAGES[data.status] ?? "Project updated."),
    )
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/projects/[id]")
  }
}
