// =============================================================================
// PATCH  /api/admin/sponsors/[id] — edit a sponsor (sponsors:edit)
// DELETE /api/admin/sponsors/[id] — hard-delete a sponsor (sponsors:edit)
//
// PATCH accepts any subset of the sponsor fields; the schema's `logoUrl`
// maps onto the model's required `logoKey` column (only written when a new
// logo URL is actually provided). Only the fields that actually changed are
// written to the audit trail. DELETE removes the row and audits the removal.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { sponsorUpdateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

type AuditValue = string | number | boolean | null

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("sponsors:view")
    if (error) {return error}

    const { id } = await params
    const sponsor = await prisma.sponsor.findUnique({ where: { id } })
    if (!sponsor) {
      throw new AdminError("Sponsor not found.", "NOT_FOUND", 404)
    }
    return NextResponse.json(successResponse(sponsor))
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/sponsors/[id]")
  }
}

// ─── PATCH — edit a sponsor ───────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("sponsors:edit")
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

    const parsed = sponsorUpdateSchema.safeParse(body)
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

    const existing = await prisma.sponsor.findUnique({ where: { id } })
    if (!existing) {
      throw new AdminError("Sponsor not found.", "NOT_FOUND", 404)
    }

    const { logoUrl, ...rest } = parsed.data
    const updateData = {
      ...rest,
      ...(logoUrl !== undefined ? { logoKey: logoUrl } : {}),
    }

    // Only the fields present in the payload and different from the stored
    // row belong in the audit trail.
    const currentValues: Record<string, AuditValue> = {
      name: existing.name,
      tier: existing.tier,
      logoKey: existing.logoKey,
      websiteUrl: existing.websiteUrl,
      description: existing.description,
      year: existing.year,
      isActive: existing.isActive,
      displayOrder: existing.displayOrder,
    }

    const changedKeys: string[] = []
    const before: Record<string, AuditValue> = {}
    for (const [key, value] of Object.entries(updateData)) {
      if (value === undefined) {continue}
      const current = currentValues[key]
      if (current === value) {continue}
      changedKeys.push(key)
      before[key] = current ?? null
    }

    const updated = await prisma.sponsor.update({
      where: { id },
      data: updateData,
    })

    const updatedValues: Record<string, AuditValue> = {
      name: updated.name,
      tier: updated.tier,
      logoKey: updated.logoKey,
      websiteUrl: updated.websiteUrl,
      description: updated.description,
      year: updated.year,
      isActive: updated.isActive,
      displayOrder: updated.displayOrder,
    }

    const after: Record<string, AuditValue> = {}
    for (const key of changedKeys) {
      after[key] = updatedValues[key] ?? null
    }

    await auditLog({
      actorId: session.user.id,
      action: "SPONSOR_UPDATED",
      targetType: "Sponsor",
      targetId: id,
      before,
      after,
      metadata: { name: updated.name, changedKeys },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse(updated, "Sponsor updated."),
    )
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/sponsors/[id]")
  }
}

// ─── DELETE — hard-delete a sponsor ───────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("sponsors:edit")
    if (error) {return error}

    const { id } = await params

    const existing = await prisma.sponsor.findUnique({
      where: { id },
      select: { id: true, name: true, tier: true },
    })
    if (!existing) {
      throw new AdminError("Sponsor not found.", "NOT_FOUND", 404)
    }

    await prisma.sponsor.delete({ where: { id } })

    await auditLog({
      actorId: session.user.id,
      action: "SPONSOR_DELETED",
      targetType: "Sponsor",
      targetId: id,
      before: { name: existing.name, tier: existing.tier },
      metadata: { name: existing.name },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse({ id }, "Sponsor deleted."),
    )
  } catch (err) {
    return adminErrorResponse(err, "DELETE /api/admin/sponsors/[id]")
  }
}
