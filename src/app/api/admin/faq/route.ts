// =============================================================================
// GET  /api/admin/faq — paginated FAQ list (faq:view)
// POST /api/admin/faq — create a FAQ entry (faq:edit)
//
// Filters:
// - category:    exact category match (free string — categories are open-ended)
// - isPublished: "true" | "false" (published entries vs drafts)
// - q:           question text
//
// Listed by manual display order, then newest first — the order the public
// FAQ page presents entries in.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { adminErrorResponse } from "@/lib/admin/http"
import { buildSearchOr, parseAdminListParams } from "@/lib/admin/query"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, paginationMeta, successResponse } from "@/lib/utils"
import { faqCreateSchema } from "@/lib/validations/admin"

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

// ─── GET — FAQ list ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("faq:view")
    if (error) {return error}

    const { page, pageSize, skip, take, q } = parseAdminListParams(request)
    const params = request.nextUrl.searchParams
    const isPublished = parseBooleanFilter(params, "isPublished")
    const category = (params.get("category") ?? "").trim()

    if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
      return NextResponse.json(
        errorResponse("Invalid pagination parameters.", "VALIDATION"),
        { status: 400 },
      )
    }

    const where = {
      ...(category ? { category } : {}),
      ...(isPublished !== undefined ? { isPublished } : {}),
      ...(q ? { OR: buildSearchOr(q, ["question"]) } : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.fAQ.findMany({
        where,
        skip,
        take,
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      }),
      prisma.fAQ.count({ where }),
    ])

    return NextResponse.json(
      successResponse({
        items,
        pagination: paginationMeta(total, page, pageSize),
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/faq")
  }
}

// ─── POST — create a FAQ entry ────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("faq:edit")
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

    const parsed = faqCreateSchema.safeParse(body)
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

    const created = await prisma.fAQ.create({ data: parsed.data })

    await auditLog({
      actorId: session.user.id,
      action: "FAQ_CREATED",
      targetType: "Faq",
      targetId: created.id,
      after: {
        question: created.question,
        category: created.category,
        displayOrder: created.displayOrder,
        isPublished: created.isPublished,
      },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
      metadata: {
        question: created.question,
        isPublished: created.isPublished,
      },
    })

    return NextResponse.json(
      successResponse(created, "FAQ entry created."),
      { status: 201 },
    )
  } catch (err) {
    return adminErrorResponse(err, "POST /api/admin/faq")
  }
}
