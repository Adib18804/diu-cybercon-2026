// =============================================================================
// GET   /api/admin/participants/[id]  — full participant profile
// PATCH /api/admin/participants/[id]  — edit profile fields (participants:edit)
//
// GET returns the profile, every event registration (with check-in state),
// workshop registrations, and the latest student-ID verification status —
// plus the caller's own capabilities so the UI can gate edit controls
// (the server ALWAYS re-checks on PATCH regardless).
//
// Student ID documents are NOT returned here — only status metadata. The
// file itself stays behind the signed-URL flow in /admin/verifications.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { hasPermission, requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { participantUpdateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

// ─── GET — participant detail ─────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("participants:view")
    if (error) {return error}

    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isSuspended: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        profile: {
          select: {
            fullName: true,
            studentId: true,
            department: true,
            phone: true,
            tshirtSize: true,
            createdAt: true,
            updatedAt: true,
            university: { select: { id: true, name: true, shortName: true } },
          },
        },
        eventRegistrations: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            registrationId: true,
            status: true,
            checkInStatus: true,
            checkInTime: true,
            checkOutTime: true,
            createdAt: true,
            event: { select: { id: true, name: true, type: true } },
            team: { select: { id: true, name: true } },
          },
        },
        workshopRegistrations: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
            workshop: {
              select: {
                id: true,
                title: true,
                date: true,
                startTime: true,
                endTime: true,
                venue: true,
              },
            },
          },
        },
        studentVerifications: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            reviewNote: true,
            createdAt: true,
            reviewedAt: true,
          },
        },
      },
    })

    if (!user || user.deletedAt) {
      throw new AdminError("Participant not found.", "NOT_FOUND", 404)
    }

    // Strip the soft-delete marker — it is an internal column.
    const { deletedAt: _deletedAt, ...safeUser } = user
    void _deletedAt

    const permissions = {
      canEdit: hasPermission(session.user.adminRole, "participants:edit"),
      canSuspend: hasPermission(session.user.adminRole, "participants:edit"),
      canViewVerification: hasPermission(
        session.user.adminRole,
        "verification:view",
      ),
    }

    return NextResponse.json(
      successResponse({ user: safeUser, permissions }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/participants/[id]")
  }
}

// ─── PATCH — edit profile ─────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("participants:edit")
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

    const parsed = participantUpdateSchema.safeParse(body)
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

    const existing = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        deletedAt: true,
        email: true,
        profile: {
          select: {
            id: true,
            fullName: true,
            studentId: true,
            department: true,
            phone: true,
            tshirtSize: true,
          },
        },
      },
    })

    if (!existing || existing.deletedAt) {
      throw new AdminError("Participant not found.", "NOT_FOUND", 404)
    }
    if (existing.role !== "PARTICIPANT") {
      throw new AdminError(
        "This is an admin or staff account — edit it through Roles & Access.",
        "WRONG_ACCOUNT_TYPE",
        400,
      )
    }
    if (!existing.profile) {
      throw new AdminError(
        "This account has no participant profile yet, so there is nothing to edit.",
        "NO_PROFILE",
        400,
      )
    }

    const data = parsed.data

    // Friendly duplicate check before hitting the DB constraint.
    const duplicate = await prisma.participantProfile.findFirst({
      where: { studentId: data.studentId, NOT: { userId: id } },
      select: { userId: true },
    })
    if (duplicate) {
      throw new AdminError(
        "That student ID is already used by another participant.",
        "DUPLICATE_STUDENT_ID",
        409,
      )
    }

    const updated = await prisma.participantProfile.update({
      where: { userId: id },
      data: {
        fullName: data.fullName,
        department: data.department,
        phone: data.phone,
        tshirtSize: data.tshirtSize,
        studentId: data.studentId,
      },
      select: {
        fullName: true,
        studentId: true,
        department: true,
        phone: true,
        tshirtSize: true,
        updatedAt: true,
      },
    })

    await auditLog({
      actorId: session.user.id,
      action: "PROFILE_UPDATED",
      targetType: "User",
      targetId: id,
      before: {
        fullName: existing.profile.fullName,
        studentId: existing.profile.studentId,
        department: existing.profile.department,
        phone: existing.profile.phone,
        tshirtSize: existing.profile.tshirtSize,
      },
      after: {
        fullName: updated.fullName,
        studentId: updated.studentId,
        department: updated.department,
        phone: updated.phone,
        tshirtSize: updated.tshirtSize,
      },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
      metadata: { email: existing.email, via: "admin-participants" },
    })

    return NextResponse.json(
      successResponse(updated, "Profile updated."),
    )
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/participants/[id]")
  }
}
