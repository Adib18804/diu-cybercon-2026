// =============================================================================
// PATCH  /api/admin/partners/[id] — edit a partner (partners:edit)
// DELETE /api/admin/partners/[id] — hard-delete a partner (partners:edit)
//
// PATCH accepts any subset of the partner fields; the schema's `logoUrl`
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
import { partnerUpdateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

type AuditValue = string | number | boolean | null

// ─── PATCH — edit a partner ───────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("partners:edit")
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

    const parsed = partnerUpdateSchema.safeParse(body)
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

    const existing = await prisma.partner.findUnique({ where: { id } })
    if (!existing) {
      throw new AdminError("Partner not found.", "NOT_FOUND", 404)
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
      category: existing.category,
      logoKey: existing.logoKey,
      websiteUrl: existing.websiteUrl,
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

    const updated = await prisma.partner.update({
      where: { id },
      data: updateData,
    })

    const updatedValues: Record<string, AuditValue> = {
      name: updated.name,
      category: updated.category,
      logoKey: updated.logoKey,
      websiteUrl: updated.websiteUrl,
      isActive: updated.isActive,
      displayOrder: updated.displayOrder,
    }

    const after: Record<string, AuditValue> = {}
    for (const key of changedKeys) {
      after[key] = updatedValues[key] ?? null
    }

    await auditLog({
      actorId: session.user.id,
      action: "PARTNER_UPDATED",
      targetType: "Partner",
      targetId: id,
      before,
      after,
      metadata: { name: updated.name, changedKeys },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse(updated, "Partner updated."),
    )
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/partners/[id]")
  }
}

// ─── DELETE — hard-delete a partner ───────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("partners:edit")
    if (error) {return error}

    const { id } = await params

    const existing = await prisma.partner.findUnique({
      where: { id },
      select: { id: true, name: true, category: true },
    })
    if (!existing) {
      throw new AdminError("Partner not found.", "NOT_FOUND", 404)
    }

    await prisma.partner.delete({ where: { id } })

    await auditLog({
      actorId: session.user.id,
      action: "PARTNER_DELETED",
      targetType: "Partner",
      targetId: id,
      before: { name: existing.name, category: existing.category },
      metadata: { name: existing.name },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse({ id }, "Partner deleted."),
    )
  } catch (err) {
    return adminErrorResponse(err, "DELETE /api/admin/partners/[id]")
  }
}
