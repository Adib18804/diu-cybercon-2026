// =============================================================================
// GET    /api/admin/workshops/[id] — workshop detail + registrations
// PATCH  /api/admin/workshops/[id] — edit a workshop (workshops:edit)
// DELETE /api/admin/workshops/[id] — hard-delete a workshop (workshops:edit)
//
// GET returns the full workshop row (including registeredCount) together with
// every workshop registration and its participant context.
//
// DELETE is refused while registrations exist — the workshop must be closed
// (status CLOSED) instead, so participant records are never cascade-lost.
// Every mutation is written to the audit log with the changed fields.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { workshopUpdateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

// ─── Audit helpers ────────────────────────────────────────────────────────────

type AuditValue = string | number | null

/** Date → ISO string, undefined/null → null, everything else kept as-is. */
function toAuditValue(value: unknown): AuditValue {
  if (value === undefined || value === null) {return null}
  if (value instanceof Date) {return value.toISOString()}
  if (typeof value === "string" || typeof value === "number") {return value}
  return JSON.stringify(value) ?? null
}

// ─── GET — workshop detail ────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("workshops:view")
    if (error) {return error}

    const { id } = await params

    const workshop = await prisma.workshop.findUnique({ where: { id } })
    if (!workshop) {
      throw new AdminError("Workshop not found.", "NOT_FOUND", 404)
    }

    const registrations = await prisma.workshopRegistration.findMany({
      where: { workshopId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profile: { select: { fullName: true, studentId: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(
      successResponse({ workshop, registrations }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/workshops/[id]")
  }
}

// ─── PATCH — edit a workshop ──────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("workshops:edit")
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

    const parsed = workshopUpdateSchema.safeParse(body)
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

    const existing = await prisma.workshop.findUnique({ where: { id } })
    if (!existing) {
      throw new AdminError("Workshop not found.", "NOT_FOUND", 404)
    }

    const data = parsed.data

    // Only the keys actually present in the payload and different from the
    // stored row belong in the audit trail.
    const changedKeys = (Object.keys(data) as Array<keyof typeof data>).filter(
      (key) => {
        const next = data[key]
        if (next === undefined) {return false}
        const current = existing[key]
        if (current instanceof Date && next instanceof Date) {
          return current.getTime() !== next.getTime()
        }
        return current !== next
      },
    )

    const updated = await prisma.workshop.update({
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
      action: "WORKSHOP_UPDATED",
      targetType: "Workshop",
      targetId: id,
      before,
      after,
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
      metadata: { title: updated.title, changedKeys },
    })

    return NextResponse.json(
      successResponse(updated, "Workshop updated."),
    )
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/workshops/[id]")
  }
}

// ─── DELETE — hard-delete a workshop (only without registrations) ─────────────

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("workshops:edit")
    if (error) {return error}

    const { id } = await params

    const existing = await prisma.workshop.findUnique({
      where: { id },
      select: { id: true, title: true, status: true, date: true },
    })
    if (!existing) {
      throw new AdminError("Workshop not found.", "NOT_FOUND", 404)
    }

    const registrationCount = await prisma.workshopRegistration.count({
      where: { workshopId: id },
    })
    if (registrationCount > 0) {
      throw new AdminError(
        "This workshop has registrations and cannot be deleted. Close registration instead.",
        "HAS_REGISTRATIONS",
        409,
      )
    }

    await prisma.workshop.delete({ where: { id } })

    await auditLog({
      actorId: session.user.id,
      action: "WORKSHOP_DELETED",
      targetType: "Workshop",
      targetId: id,
      before: {
        title: existing.title,
        status: existing.status,
        date: existing.date.toISOString(),
      },
      metadata: { title: existing.title },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse({ id }, "Workshop deleted."),
    )
  } catch (err) {
    return adminErrorResponse(err, "DELETE /api/admin/workshops/[id]")
  }
}
