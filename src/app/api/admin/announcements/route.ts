// =============================================================================
// GET  /api/admin/announcements — paginated announcement list (announcements:view)
// POST /api/admin/announcements — create an announcement (announcements:edit)
//
// Filters:
// - isPublished: "true" | "false" (live posts vs drafts)
// - q: announcement title
//
// Soft-deleted rows (deletedAt set) are never returned. Pinned announcements
// come first, then newest first — the order the public announcements page
// presents them in.
//
// Creating an already-published announcement stamps publishedAt immediately
// and records both an ANNOUNCEMENT_CREATED and an ANNOUNCEMENT_PUBLISHED
// audit entry.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { adminErrorResponse } from "@/lib/admin/http"
import { buildSearchOr, parseAdminListParams } from "@/lib/admin/query"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, paginationMeta, successResponse } from "@/lib/utils"
import { announcementCreateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** "true"/"false" → boolean; anything else means "no filter". */
function parseBooleanFilter(
  params: URLSearchParams,
  key: string,
): boolean | undefined {
  const raw = params.get(key)
  if (raw === "true") {return true}
  if (raw === "false") {return false}
  return undefined
}

// ─── GET — announcement list ──────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("announcements:view")
    if (error) {return error}

    const { page, pageSize, skip, take, q } = parseAdminListParams(request)
    const params = request.nextUrl.searchParams
    const isPublished = parseBooleanFilter(params, "isPublished")

    if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
      return NextResponse.json(
        errorResponse("Invalid pagination parameters.", "VALIDATION"),
        { status: 400 },
      )
    }

    const where = {
      deletedAt: null,
      ...(isPublished !== undefined ? { isPublished } : {}),
      ...(q ? { OR: buildSearchOr(q, ["title"]) } : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.announcement.findMany({
        where,
        skip,
        take,
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      }),
      prisma.announcement.count({ where }),
    ])

    return NextResponse.json(
      successResponse({
        items,
        pagination: paginationMeta(total, page, pageSize),
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/announcements")
  }
}

// ─── POST — create an announcement ────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("announcements:edit")
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

    const parsed = announcementCreateSchema.safeParse(body)
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
    const publishedAt = data.isPublished ? new Date() : null

    const created = await prisma.announcement.create({
      data: {
        ...data,
        authorId: session.user.id,
        publishedAt,
      },
    })

    await auditLog({
      actorId: session.user.id,
      action: "ANNOUNCEMENT_CREATED",
      targetType: "Announcement",
      targetId: created.id,
      metadata: {
        title: created.title,
        isPinned: created.isPinned,
        isPublished: created.isPublished,
      },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    if (created.isPublished) {
      await auditLog({
        actorId: session.user.id,
        action: "ANNOUNCEMENT_PUBLISHED",
        targetType: "Announcement",
        targetId: created.id,
        metadata: {
          title: created.title,
          publishedAt: created.publishedAt?.toISOString() ?? null,
        },
        ipAddress: extractIpAddress(request),
        userAgent: extractUserAgent(request),
      })
    }

    return NextResponse.json(
      successResponse(created, "Announcement created."),
      { status: 201 },
    )
  } catch (err) {
    return adminErrorResponse(err, "POST /api/admin/announcements")
  }
}
