// =============================================================================
// GET   /api/admin/contact-messages/[id] — full message detail (contact_messages:view)
// PATCH /api/admin/contact-messages/[id] — read/replied bookkeeping (contact_messages:view)
//
// Body (contactMessageUpdateSchema):
// - isRead: true      → mark the message as read (replied fields untouched)
// - markReplied: true → stamp repliedAt/repliedBy and (if needed) mark as read
//
// This domain has no separate edit permission, so PATCH is gated on the same
// read permission. There is no DELETE — messages are never destroyed. The only
// audit action for this domain is CONTACT_MESSAGE_READ, so both mutations are
// recorded under it with before/after read+replied state.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { contactMessageUpdateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

// ─── GET — full message detail ────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("contact_messages:view")
    if (error) {return error}

    const { id } = await params

    const message = await prisma.contactMessage.findUnique({ where: { id } })
    if (!message) {
      throw new AdminError("Message not found.", "NOT_FOUND", 404)
    }

    return NextResponse.json(successResponse(message))
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/contact-messages/[id]")
  }
}

// ─── PATCH — mark as read / mark as replied ───────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("contact_messages:view")
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

    const parsed = contactMessageUpdateSchema.safeParse(body)
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

    const existing = await prisma.contactMessage.findUnique({ where: { id } })
    if (!existing) {
      throw new AdminError("Message not found.", "NOT_FOUND", 404)
    }

    const data = parsed.data
    const updates: {
      isRead?: boolean
      repliedAt?: Date
      repliedBy?: string
    } = {}
    let markedReplied = false

    // Explicit read/unread toggle — leaves repliedAt/repliedBy untouched.
    if (data.isRead !== undefined && data.isRead !== existing.isRead) {
      updates.isRead = data.isRead
    }

    // Reply stamping is only applied once — re-marking keeps the original
    // replier and timestamp intact.
    if (data.markReplied === true && existing.repliedAt === null) {
      updates.repliedAt = new Date()
      updates.repliedBy = session.user.id
      if (!existing.isRead) {updates.isRead = true}
      markedReplied = true
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        successResponse(existing, "No changes to save."),
      )
    }

    const updated = await prisma.contactMessage.update({
      where: { id },
      data: updates,
    })

    await auditLog({
      actorId: session.user.id,
      action: "CONTACT_MESSAGE_READ",
      targetType: "ContactMessage",
      targetId: id,
      before: {
        isRead: existing.isRead,
        replied: existing.repliedAt !== null,
      },
      after: {
        isRead: updated.isRead,
        replied: updated.repliedAt !== null,
      },
      metadata: {
        isRead: updated.isRead,
        replied: updated.repliedAt !== null,
        markedReplied,
      },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse(
        updated,
        markedReplied ? "Message marked as replied." : "Message updated.",
      ),
    )
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/contact-messages/[id]")
  }
}
