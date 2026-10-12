// =============================================================================
// PATCH  /api/admin/speakers/[id] — update a speaker ("speakers:edit")
// DELETE /api/admin/speakers/[id] — delete a speaker ("speakers:edit")
//
// A speaker assigned to any panel cannot be deleted (409) — the Panelist
// relation is not cascaded from Speaker, so removal must be explicit.
// Updates are validated with speakerUpdateSchema and audited with
// before/after snapshots.
//
// Clearing semantics: URL fields transform "" → undefined in the schema, so
// the raw body keys are inspected — a present-but-empty key clears the
// column to NULL, an omitted key leaves it untouched.
// =============================================================================

import { Prisma } from "@prisma/client"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { speakerUpdateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasKey(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

/** Plain display snapshot for audit payloads (no Dates, no internals). */
function speakerSnapshot(speaker: {
  name: string
  title: string
  organization: string
  bio: string | null
  expertise: string[]
  photoKey: string | null
  linkedinUrl: string | null
  twitterUrl: string | null
  websiteUrl: string | null
  isVisible: boolean
  displayOrder: number
}): Record<string, unknown> {
  return {
    name: speaker.name,
    title: speaker.title,
    organization: speaker.organization,
    bio: speaker.bio,
    expertise: speaker.expertise,
    photoKey: speaker.photoKey,
    linkedinUrl: speaker.linkedinUrl,
    twitterUrl: speaker.twitterUrl,
    websiteUrl: speaker.websiteUrl,
    isVisible: speaker.isVisible,
    displayOrder: speaker.displayOrder,
  }
}

// ─── PATCH — update speaker ───────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("speakers:edit")
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

    const parsed = speakerUpdateSchema.safeParse(body)
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

    const existing = await prisma.speaker.findUnique({ where: { id } })
    if (!existing) {
      throw new AdminError("Speaker not found.", "NOT_FOUND", 404)
    }

    const data = parsed.data
    const raw = isRecord(body) ? body : {}
    const updateData: Prisma.SpeakerUpdateInput = {}

    if (data.name !== undefined) {updateData.name = data.name}
    if (data.title !== undefined) {updateData.title = data.title}
    if (data.organization !== undefined) {
      updateData.organization = data.organization
    }
    if (data.expertise !== undefined) {updateData.expertise = data.expertise}
    if (data.isVisible !== undefined) {updateData.isVisible = data.isVisible}
    if (data.displayOrder !== undefined) {
      updateData.displayOrder = data.displayOrder
    }

    // Long text keeps "" through validation — map it to NULL directly.
    if (data.bio !== undefined) {
      updateData.bio = data.bio.length > 0 ? data.bio : null
    } else if (hasKey(raw, "bio")) {
      updateData.bio = null
    }

    // URL fields: "" was transformed away — a present key means "clear".
    if (data.photoUrl !== undefined) {
      updateData.photoKey = data.photoUrl
    } else if (hasKey(raw, "photoUrl")) {
      updateData.photoKey = null
    }

    if (data.linkedinUrl !== undefined) {
      updateData.linkedinUrl = data.linkedinUrl
    } else if (hasKey(raw, "linkedinUrl")) {
      updateData.linkedinUrl = null
    }

    if (data.twitterUrl !== undefined) {
      updateData.twitterUrl = data.twitterUrl
    } else if (hasKey(raw, "twitterUrl")) {
      updateData.twitterUrl = null
    }

    if (data.websiteUrl !== undefined) {
      updateData.websiteUrl = data.websiteUrl
    } else if (hasKey(raw, "websiteUrl")) {
      updateData.websiteUrl = null
    }

    const updated = await prisma.speaker.update({
      where: { id },
      data: updateData,
    })

    await auditLog({
      actorId: session.user.id,
      action: "SPEAKER_UPDATED",
      targetType: "Speaker",
      targetId: id,
      before: speakerSnapshot(existing),
      after: speakerSnapshot(updated),
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(successResponse(updated, "Speaker updated."))
  } catch (err) {
    return adminErrorResponse(err, "PATCH /api/admin/speakers/[id]")
  }
}

// ─── DELETE — delete speaker ──────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("speakers:edit")
    if (error) {return error}

    const { id } = await params

    const existing = await prisma.speaker.findUnique({ where: { id } })
    if (!existing) {
      throw new AdminError("Speaker not found.", "NOT_FOUND", 404)
    }

    const panelAssignments = await prisma.panelist.count({
      where: { speakerId: id },
    })
    if (panelAssignments > 0) {
      throw new AdminError(
        "This speaker is assigned to a panel and cannot be deleted. Remove them from the panel first.",
        "HAS_PANEL_ASSIGNMENTS",
        409,
      )
    }

    await prisma.speaker.delete({ where: { id } })

    await auditLog({
      actorId: session.user.id,
      action: "SPEAKER_DELETED",
      targetType: "Speaker",
      targetId: id,
      before: speakerSnapshot(existing),
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(successResponse({ id }, "Speaker deleted."))
  } catch (err) {
    return adminErrorResponse(err, "DELETE /api/admin/speakers/[id]")
  }
}
