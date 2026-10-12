// =============================================================================
// GET  /api/admin/gallery — paginated gallery list (gallery:view)
// POST /api/admin/gallery — add a gallery image (gallery:edit)
//
// Filters:
// - category: any category string. Categories are admin-authored free text
//   (the public /api/gallery endpoint uses the same open taxonomy), so the
//   value is passed through trimmed rather than whitelisted against an enum.
// - year: numeric event year (non-numeric or missing means "all years")
// - q: image title / alt text
//
// Listed by manual display order, then newest first — the order the public
// gallery page presents images in.
//
// The validation schema names the image field `imageUrl`; the model stores it
// in the required `imageKey` column, so this route maps it (same pattern as
// sponsors' logoUrl → logoKey).
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { adminErrorResponse } from "@/lib/admin/http"
import { buildSearchOr, parseAdminListParams } from "@/lib/admin/query"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, paginationMeta, successResponse } from "@/lib/utils"
import { galleryCreateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ─── GET — gallery list ───────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("gallery:view")
    if (error) {return error}

    const { page, pageSize, skip, take, q } = parseAdminListParams(request)
    const params = request.nextUrl.searchParams
    const category = params.get("category")?.trim() || undefined
    const rawYear = (params.get("year") ?? "").trim()
    const year = /^\d+$/.test(rawYear)
      ? Number.parseInt(rawYear, 10)
      : undefined

    if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
      return NextResponse.json(
        errorResponse("Invalid pagination parameters.", "VALIDATION"),
        { status: 400 },
      )
    }

    const where = {
      ...(category ? { category } : {}),
      ...(year !== undefined ? { year } : {}),
      ...(q ? { OR: buildSearchOr(q, ["title", "altText"]) } : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.galleryImage.findMany({
        where,
        skip,
        take,
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      }),
      prisma.galleryImage.count({ where }),
    ])

    return NextResponse.json(
      successResponse({
        items,
        pagination: paginationMeta(total, page, pageSize),
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/gallery")
  }
}

// ─── POST — add a gallery image ───────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("gallery:edit")
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

    const parsed = galleryCreateSchema.safeParse(body)
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

    const { imageUrl, ...rest } = parsed.data

    const created = await prisma.galleryImage.create({
      data: {
        ...rest,
        imageKey: imageUrl,
        uploadedBy: session.user.id,
      },
    })

    await auditLog({
      actorId: session.user.id,
      action: "GALLERY_IMAGE_ADDED",
      targetType: "GalleryImage",
      targetId: created.id,
      metadata: {
        title: created.title,
        category: created.category,
        year: created.year,
      },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse(created, "Gallery image added."),
      { status: 201 },
    )
  } catch (err) {
    return adminErrorResponse(err, "POST /api/admin/gallery")
  }
}
