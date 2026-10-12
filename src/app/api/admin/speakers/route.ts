// =============================================================================
// GET  /api/admin/speakers — paginated speaker list ("speakers:view")
// POST /api/admin/speakers — create a speaker ("speakers:edit")
//
// Filters:
// - isVisible: "true" | "false" (whitelist — anything else is ignored)
// - q:         name / organization / title (case-insensitive contains)
//
// Writes are validated with speakerCreateSchema and recorded in the audit
// log. The form field `photoUrl` maps to the DB column `photoKey` (an
// absolute URL produced by /api/admin/upload).
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { adminErrorResponse } from "@/lib/admin/http"
import {
  buildSearchOr,
  parseAdminListParams,
  parseEnumFilter,
} from "@/lib/admin/query"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, paginationMeta, successResponse } from "@/lib/utils"
import { speakerCreateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const VISIBILITY_FILTERS = ["true", "false"] as const

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

// ─── GET — speaker list ───────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("speakers:view")
    if (error) {return error}

    const { page, pageSize, skip, take, q } = parseAdminListParams(request)
    const visibility = parseEnumFilter(
      request.nextUrl.searchParams,
      "isVisible",
      VISIBILITY_FILTERS,
    )

    if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
      return NextResponse.json(
        errorResponse("Invalid pagination parameters.", "VALIDATION"),
        { status: 400 },
      )
    }

    const searchOr = buildSearchOr(q, ["name", "organization", "title"])

    const where = {
      ...(visibility !== undefined ? { isVisible: visibility === "true" } : {}),
      ...(searchOr ? { OR: searchOr } : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.speaker.findMany({
        where,
        skip,
        take,
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          title: true,
          organization: true,
          bio: true,
          expertise: true,
          photoKey: true,
          linkedinUrl: true,
          twitterUrl: true,
          websiteUrl: true,
          isVisible: true,
          displayOrder: true,
        },
      }),
      prisma.speaker.count({ where }),
    ])

    return NextResponse.json(
      successResponse({
        items,
        pagination: paginationMeta(total, page, pageSize),
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/speakers")
  }
}

// ─── POST — create speaker ────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("speakers:edit")
    if (error) {return error}

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        errorResponse("Invalid JSON body.", "INVALID_JSON"),
        { status: 400 },
      )
    }

    const parsed = speakerCreateSchema.safeParse(body)
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

    const created = await prisma.speaker.create({
      data: {
        name: data.name,
        title: data.title,
        organization: data.organization,
        bio: data.bio && data.bio.length > 0 ? data.bio : null,
        expertise: data.expertise,
        photoKey: data.photoUrl ?? null,
        linkedinUrl: data.linkedinUrl ?? null,
        twitterUrl: data.twitterUrl ?? null,
        websiteUrl: data.websiteUrl ?? null,
        isVisible: data.isVisible,
        displayOrder: data.displayOrder,
      },
    })

    await auditLog({
      actorId: session.user.id,
      action: "SPEAKER_CREATED",
      targetType: "Speaker",
      targetId: created.id,
      after: speakerSnapshot(created),
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse(created, "Speaker created."),
      { status: 201 },
    )
  } catch (err) {
    return adminErrorResponse(err, "POST /api/admin/speakers")
  }
}
