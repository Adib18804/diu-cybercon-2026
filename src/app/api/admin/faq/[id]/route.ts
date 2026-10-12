// =============================================================================
// PATCH  /api/admin/faq/[id] — edit a FAQ entry (faq:edit)
// DELETE /api/admin/faq/[id] — hard-delete a FAQ entry (faq:edit)
//
// FAQ entries have no soft-delete column, so DELETE removes the row entirely
// (the audit trail keeps the record of what was removed). PATCH only writes
// the fields that actually changed and lists them in the audit entry.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { faqUpdateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

type AuditValue = string | number | boolean | null

// ─── PATCH — edit a FAQ entry ─────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("faq:edit")
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

    const parsed = faqUpdateSchema.safeParse(body)
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

    const existing = await prisma.fAQ.findUnique({ where: { id } })
    if (!existing) {
      throw new AdminError("FAQ entry not found.", "NOT_FOUND", 404)
    }

    const data = parsed.data

    // Only fields present in the payload and different from the stored row
    // are written and recorded in the audit trail.
    const before: Record<string, AuditValue> = {}
    const after: Record<string, AuditValue> = {}
    const changedKeys: string[] = []
    const updateData: {
      question?: string
      answer?: string
      category?: string
      displayOrder?: number
      isPublished?: boolean
    } = {}

    if (data.question !== undefined && data.question !== existing.question) {
      changedKeys.push("question")
      before.question = existing.question
      after.question = data.question
      updateData.question = data.question
    }
    if (data.answer !== undefined && data.answer !== existing.answer) {
      changedKeys.push("answer")
      before.answer = existing.answer
      after.answer = data.answer
      updateData.answer = data.answer
    }
    if (data.category !== undefined && data.category !== existing.category) {
      changedKeys.push("category")
      before.category = existing.category
      after.category = data.category
      updateData.category = data.category
    }
    if (
      data.displayOrder !== undefined &&
      data.displayOrder !== existing.displayOrder
    ) {
      changedKeys.push("displayOrder")
      before.displayOrder = existing.displayOrder
      after.displayOrder = data.displayOrder
      updateData.displayOrder = data.displayOrder
    }
    if (
      data.isPublished !== undefined &&
      data.isPublished !== existing.isPublished
    ) {
      changedKeys.push("isPublished")
      before.isPublished = existing.isPublished
      after.isPublished = data.isPublished
      updateData.isPublished = data.isPublished
    }

    if (changedKeys.length === 0) {
      return NextResponse.json(
        successResponse(existing, "No changes to save."),
      )
    }

    const updated = await prisma.fAQ.update({
      where: { id },
      data: updateData,
    })

    await auditLog({
      actorId: session.user.id,
      action: "FAQ_UPDATED",
      targetType: "Faq",
      targetId: id,
      before,
      after,
      metadata: { question: updated.question, changedKeys },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse(updated, "FAQ entry updated."),
    )
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/faq/[id]")
  }
}

// ─── DELETE — hard-delete a FAQ entry ─────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("faq:edit")
    if (error) {return error}

    const { id } = await params

    const existing = await prisma.fAQ.findUnique({
      where: { id },
      select: {
        id: true,
        question: true,
        category: true,
        displayOrder: true,
        isPublished: true,
      },
    })
    if (!existing) {
      throw new AdminError("FAQ entry not found.", "NOT_FOUND", 404)
    }

    // FAQ entries are hard-deleted — the model has no deletedAt column.
    await prisma.fAQ.delete({ where: { id } })

    await auditLog({
      actorId: session.user.id,
      action: "FAQ_DELETED",
      targetType: "Faq",
      targetId: id,
      before: {
        question: existing.question,
        category: existing.category,
        displayOrder: existing.displayOrder,
        isPublished: existing.isPublished,
      },
      metadata: { question: existing.question, hardDelete: true },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse({ id }, "FAQ entry deleted."),
    )
  } catch (err) {
    return adminErrorResponse(err, "DELETE /api/admin/faq/[id]")
  }
}
