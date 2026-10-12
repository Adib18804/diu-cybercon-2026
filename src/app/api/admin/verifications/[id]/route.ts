// =============================================================================
// GET   /api/admin/verifications/[id] — full verification detail (metadata)
// PATCH /api/admin/verifications/[id] — record a decision
//        (VERIFIED / REJECTED / REVISION_REQUIRED)
//
// SECURITY:
// - GET requires "verification:view", PATCH requires "verification:decide"
// - The document file is NOT served here — only metadata. Bytes are reachable
//   exclusively via short-lived signed URLs (see [id]/view-url).
// - Every decision writes an immutable audit record (before/after status)
//   and notifies the applicant by email (email failure never blocks the
//   decision itself).
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { ERROR_MESSAGES } from "@/lib/constants"
import { prisma } from "@/lib/db"
import { sendVerificationStatusEmail } from "@/lib/email/resend"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { verificationDecisionSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ─── GET — detail with access history ─────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("verification:view")
    if (error) {return error}

    const { id } = await params

    const verification = await prisma.studentVerification.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        fileName: true,
        fileMimeType: true,
        fileSizeBytes: true,
        reviewNote: true,
        reviewedBy: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isSuspended: true,
            createdAt: true,
            profile: {
              select: {
                fullName: true,
                studentId: true,
                department: true,
                phone: true,
                tshirtSize: true,
                university: { select: { name: true, shortName: true } },
              },
            },
          },
        },
        teamMember: {
          select: {
            id: true,
            isLeader: true,
            team: {
              select: {
                id: true,
                name: true,
                event: { select: { name: true, type: true } },
              },
            },
          },
        },
      },
    })

    if (!verification) {
      return NextResponse.json(
        errorResponse(ERROR_MESSAGES.NOT_FOUND, "NOT_FOUND"),
        { status: 404 },
      )
    }

    // Reviewer identity (reviewedBy is a plain id, no relation) + access log
    const [reviewedByUser, accessLogs] = await Promise.all([
      verification.reviewedBy
        ? prisma.user.findUnique({
            where: { id: verification.reviewedBy },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve(null),
      prisma.verificationAccessLog.findMany({
        where: { verificationId: id },
        orderBy: { accessedAt: "desc" },
        take: 10,
        select: {
          id: true,
          adminId: true,
          ipAddress: true,
          accessedAt: true,
        },
      }),
    ])

    const adminIds = [...new Set(accessLogs.map((log) => log.adminId))]
    const admins =
      adminIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: adminIds } },
            select: { id: true, name: true, email: true },
          })
        : []
    const adminNames = new Map(
      admins.map((admin) => [admin.id, admin.name ?? admin.email]),
    )

    return NextResponse.json(
      successResponse({
        verification: { ...verification, reviewedByUser },
        accessLogs: accessLogs.map((log) => ({
          id: log.id,
          adminName: adminNames.get(log.adminId) ?? "Admin",
          ipAddress: log.ipAddress,
          accessedAt: log.accessedAt,
        })),
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/verifications/[id]")
  }
}

// ─── PATCH — decision ─────────────────────────────────────────────────────────

const DECISION_MESSAGES: Record<string, string> = {
  VERIFIED: "Applicant verified successfully.",
  REJECTED: "Verification rejected. The applicant has been notified.",
  REVISION_REQUIRED:
    "Revision requested. The applicant has been notified by email.",
}

const DECISION_ACTIONS = {
  VERIFIED: "STUDENT_ID_VERIFIED",
  REJECTED: "STUDENT_ID_REJECTED",
  REVISION_REQUIRED: "STUDENT_ID_REVISION_REQUESTED",
} as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("verification:decide")
    if (error) {return error}

    const { id } = await params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        errorResponse("Invalid request body.", "INVALID_JSON"),
        { status: 400 },
      )
    }

    const parsed = verificationDecisionSchema.safeParse(body)
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

    const { decision, note } = parsed.data

    const existing = await prisma.studentVerification.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        userId: true,
        user: {
          select: {
            email: true,
            name: true,
            profile: { select: { fullName: true } },
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json(
        errorResponse(ERROR_MESSAGES.NOT_FOUND, "NOT_FOUND"),
        { status: 404 },
      )
    }

    const updated = await prisma.studentVerification.update({
      where: { id },
      data: {
        status: decision,
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        reviewNote: note ?? null,
      },
      select: {
        id: true,
        status: true,
        reviewNote: true,
        reviewedAt: true,
      },
    })

    // Immutable audit trail — who decided what, when, from where
    await auditLog({
      actorId: session.user.id,
      action: DECISION_ACTIONS[decision],
      targetType: "StudentVerification",
      targetId: id,
      before: { status: existing.status },
      after: { status: decision, note: note ?? null },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
      metadata: { applicantUserId: existing.userId },
    })

    // Notify the applicant — failure here never blocks the decision
    try {
      const recipientName =
        existing.user.profile?.fullName ||
        existing.user.name ||
        "Participant"
      const emailResult = await sendVerificationStatusEmail({
        to: existing.user.email,
        name: recipientName,
        status: decision,
        note,
      })
      if (!emailResult.success) {
        console.error(
          "[PATCH /api/admin/verifications/[id]] status email failed:",
          emailResult.error,
        )
      }
    } catch (emailErr) {
      console.error(
        "[PATCH /api/admin/verifications/[id]] status email threw:",
        emailErr,
      )
    }

    return NextResponse.json(
      successResponse(updated, DECISION_MESSAGES[decision]),
    )
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/verifications/[id]")
  }
}
