// =============================================================================
// GET   /api/admin/sponsor-apps/[id] — full application record
//       (sponsor_apps:view)
// PATCH /api/admin/sponsor-apps/[id] — update pipeline status, internal
//       notes, or assignee (sponsor_apps:edit)
//
// Applications are never hard-deleted — the pipeline keeps the full history
// (there is deliberately no DELETE route). Every PATCH audits
// SPONSOR_APPLICATION_STATUS_CHANGED with only the fields that actually
// changed, plus a statusChanged flag in the metadata.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { sendSponsorStatusEmail } from "@/lib/email/resend"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { sponsorAppUpdateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

type AuditValue = string | number | boolean | null

/** undefined/null → null, Date → ISO string, primitives kept, else stringified. */
function toAuditValue(value: unknown): AuditValue {
  if (value === undefined || value === null) {return null}
  if (value instanceof Date) {return value.toISOString()}
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value
  }
  return JSON.stringify(value) ?? null
}

// ─── GET — application detail ─────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("sponsor_apps:view")
    if (error) {return error}

    const { id } = await params

    const application = await prisma.sponsorApplication.findUnique({
      where: { id },
    })
    if (!application) {
      throw new AdminError("Application not found.", "NOT_FOUND", 404)
    }

    return NextResponse.json(successResponse(application))
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/sponsor-apps/[id]")
  }
}

// ─── PATCH — update the pipeline record ───────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("sponsor_apps:edit")
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

    const parsed = sponsorAppUpdateSchema.safeParse(body)
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

    const existing = await prisma.sponsorApplication.findUnique({
      where: { id },
    })
    if (!existing) {
      throw new AdminError("Application not found.", "NOT_FOUND", 404)
    }

    const data = parsed.data

    // Only keys present in the payload AND different from the stored row go
    // into the audit trail.
    const changedKeys = (Object.keys(data) as Array<keyof typeof data>).filter(
      (key) => {
        const next = data[key]
        if (next === undefined) {return false}
        return existing[key] !== next
      },
    )

    const updated = await prisma.sponsorApplication.update({
      where: { id },
      data,
    })

    const before: Record<string, AuditValue> = {}
    const after: Record<string, AuditValue> = {}
    for (const key of changedKeys) {
      before[key] = toAuditValue(existing[key])
      after[key] = toAuditValue(updated[key])
    }

    await auditLog({
      actorId: session.user.id,
      action: "SPONSOR_APPLICATION_STATUS_CHANGED",
      targetType: "SponsorApplication",
      targetId: id,
      before,
      after,
      metadata: { statusChanged: changedKeys.includes("status") },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    // ── Notify the applicant when the pipeline status changes (best-effort) ──
    if (changedKeys.includes("status")) {
      const result = await sendSponsorStatusEmail({
        to: existing.email,
        name: existing.contactPerson,
        orgName: existing.orgName,
        status: updated.status,
      })
      if (!result.success) {
        console.error("[PATCH /api/admin/sponsor-apps/[id]] status email failed:", result.error)
      }
    }

    return NextResponse.json(
      successResponse(updated, "Application updated."),
    )
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/sponsor-apps/[id]")
  }
}
