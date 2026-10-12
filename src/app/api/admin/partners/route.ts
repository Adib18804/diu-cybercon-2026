// =============================================================================
// GET  /api/admin/partners — paginated partner list (partners:view)
// POST /api/admin/partners — create a partner (partners:edit)
//
// Filters:
// - category: exact match on the free-text category (only when non-empty)
// - isActive: "true" | "false"
// - q: partner name
//
// Listed by manual display order, then newest first — the order the public
// partners page presents them in.
//
// The validation schema names the logo field `logoUrl`; the model stores it
// in the required `logoKey` column, so this route maps it and rejects a
// create without a logo with a field error instead of a Prisma failure.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { buildSearchOr, parseAdminListParams } from "@/lib/admin/query"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, paginationMeta, successResponse } from "@/lib/utils"
import { partnerCreateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_CATEGORY_FILTER_LENGTH = 100

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

/** Free-text category — trimmed, capped, undefined when empty. */
function parseCategoryFilter(params: URLSearchParams): string | undefined {
  const raw = (params.get("category") ?? "")
    .trim()
    .slice(0, MAX_CATEGORY_FILTER_LENGTH)
  return raw.length > 0 ? raw : undefined
}

// ─── GET — partner list ───────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("partners:view")
    if (error) {return error}

    const { page, pageSize, skip, take, q } = parseAdminListParams(request)
    const params = request.nextUrl.searchParams
    const category = parseCategoryFilter(params)
    const isActive = parseBooleanFilter(params, "isActive")

    if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
      return NextResponse.json(
        errorResponse("Invalid pagination parameters.", "VALIDATION"),
        { status: 400 },
      )
    }

    const where = {
      ...(category ? { category } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(q ? { OR: buildSearchOr(q, ["name"]) } : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.partner.findMany({
        where,
        skip,
        take,
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      }),
      prisma.partner.count({ where }),
    ])

    return NextResponse.json(
      successResponse({
        items,
        pagination: paginationMeta(total, page, pageSize),
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/partners")
  }
}

// ─── POST — create a partner ──────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("partners:edit")
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

    const parsed = partnerCreateSchema.safeParse(body)
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

    const { logoUrl, ...rest } = parsed.data

    // Partner.logoKey is required — fail with a field error, not a Prisma 500.
    if (!logoUrl) {
      throw new AdminError(
        "Please fix the highlighted fields and try again.",
        "VALIDATION",
        422,
        { logoUrl: ["Upload a logo for this partner."] },
      )
    }

    const created = await prisma.partner.create({
      data: { ...rest, logoKey: logoUrl },
    })

    await auditLog({
      actorId: session.user.id,
      action: "PARTNER_CREATED",
      targetType: "Partner",
      targetId: created.id,
      metadata: { name: created.name, category: created.category },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse(created, "Partner created."),
      { status: 201 },
    )
  } catch (err) {
    return adminErrorResponse(err, "POST /api/admin/partners")
  }
}
