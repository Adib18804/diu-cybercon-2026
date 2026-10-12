// =============================================================================
// GET  /api/admin/sponsors — paginated sponsor list (sponsors:view)
// POST /api/admin/sponsors — create a sponsor (sponsors:edit)
//
// Filters:
// - tier: any SponsorTier value (whitelisted against the full enum)
// - isActive: "true" | "false"
// - q: sponsor name
//
// Listed by manual display order, then newest first — the order the public
// sponsors page presents them in.
//
// The validation schema names the logo field `logoUrl`; the model stores it
// in the required `logoKey` column, so this route maps it and rejects a
// create without a logo with a field error instead of a Prisma failure.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import {
  buildSearchOr,
  parseAdminListParams,
  parseEnumFilter,
} from "@/lib/admin/query"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, paginationMeta, successResponse } from "@/lib/utils"
import { sponsorCreateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TIER_FILTERS = [
  "TITLE",
  "PLATINUM",
  "GOLD",
  "CUSTOM",
  "PARTNER",
  "MEDIA_PARTNER",
  "TECHNICAL_PARTNER",
  "OTHER_PARTNER",
] as const

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

// ─── GET — sponsor list ───────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("sponsors:view")
    if (error) {return error}

    const { page, pageSize, skip, take, q } = parseAdminListParams(request)
    const params = request.nextUrl.searchParams
    const tier = parseEnumFilter(params, "tier", TIER_FILTERS)
    const isActive = parseBooleanFilter(params, "isActive")

    if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
      return NextResponse.json(
        errorResponse("Invalid pagination parameters.", "VALIDATION"),
        { status: 400 },
      )
    }

    const where = {
      ...(tier ? { tier } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(q ? { OR: buildSearchOr(q, ["name"]) } : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.sponsor.findMany({
        where,
        skip,
        take,
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      }),
      prisma.sponsor.count({ where }),
    ])

    return NextResponse.json(
      successResponse({
        items,
        pagination: paginationMeta(total, page, pageSize),
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/sponsors")
  }
}

// ─── POST — create a sponsor ──────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("sponsors:edit")
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

    const parsed = sponsorCreateSchema.safeParse(body)
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

    // Sponsor.logoKey is required — fail with a field error, not a Prisma 500.
    if (!logoUrl) {
      throw new AdminError(
        "Please fix the highlighted fields and try again.",
        "VALIDATION",
        422,
        { logoUrl: ["Upload a logo for this sponsor."] },
      )
    }

    const created = await prisma.sponsor.create({
      data: { ...rest, logoKey: logoUrl },
    })

    await auditLog({
      actorId: session.user.id,
      action: "SPONSOR_CREATED",
      targetType: "Sponsor",
      targetId: created.id,
      metadata: { name: created.name, tier: created.tier },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json(
      successResponse(created, "Sponsor created."),
      { status: 201 },
    )
  } catch (err) {
    return adminErrorResponse(err, "POST /api/admin/sponsors")
  }
}
