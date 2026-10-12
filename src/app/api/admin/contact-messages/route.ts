// =============================================================================
// GET /api/admin/contact-messages — paginated inbox list (contact_messages:view)
//
// Filters:
// - isRead: "true" | "false" (read vs unread messages)
// - q:      sender name, email, or subject
//
// Newest first — the inbox is worked top-down. This domain is read-only from
// the admin console: there is no POST here (messages only arrive through the
// public contact form) and no DELETE (messages are never destroyed).
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { adminErrorResponse } from "@/lib/admin/http"
import { buildSearchOr, parseAdminListParams } from "@/lib/admin/query"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, paginationMeta, successResponse } from "@/lib/utils"

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

// ─── GET — contact message list ───────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("contact_messages:view")
    if (error) {return error}

    const { page, pageSize, skip, take, q } = parseAdminListParams(request)
    const params = request.nextUrl.searchParams
    const isRead = parseBooleanFilter(params, "isRead")

    if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
      return NextResponse.json(
        errorResponse("Invalid pagination parameters.", "VALIDATION"),
        { status: 400 },
      )
    }

    const where = {
      ...(isRead !== undefined ? { isRead } : {}),
      ...(q ? { OR: buildSearchOr(q, ["name", "email", "subject"]) } : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.contactMessage.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.contactMessage.count({ where }),
    ])

    return NextResponse.json(
      successResponse({
        items,
        pagination: paginationMeta(total, page, pageSize),
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/contact-messages")
  }
}
