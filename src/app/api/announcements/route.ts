// =============================================================================
// GET /api/announcements
// Published announcements, newest first, pinned at top.
// Supports ?limit=N and ?page=N&pageSize=N query params.
// =============================================================================

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { successResponse, errorResponse, getPaginationParams } from "@/lib/utils"

export const revalidate = 30

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const limitParam    = searchParams.get("limit")
  const pageParam     = parseInt(searchParams.get("page") ?? "1", 10)
  const pageSizeParam = parseInt(searchParams.get("pageSize") ?? "10", 10)

  try {
    const { skip, take, page, pageSize } = limitParam
      ? { skip: 0, take: parseInt(limitParam, 10), page: 1, pageSize: parseInt(limitParam, 10) }
      : getPaginationParams(pageParam, pageSizeParam, 50)

    const where = { isPublished: true, deletedAt: null }

    const [total, announcements] = await Promise.all([
      prisma.announcement.count({ where }),
      prisma.announcement.findMany({
        where,
        orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
        skip,
        take,
        select: {
          id:          true,
          title:       true,
          content:     true,
          isPinned:    true,
          publishedAt: true,
          authorId:    true,
        },
      }),
    ])

    return NextResponse.json(
      successResponse(announcements, undefined),
      {
        headers: {
          "X-Total-Count": String(total),
          "X-Page":        String(page),
          "X-Page-Size":   String(pageSize),
        },
      },
    )
  } catch (err) {
    console.error("[GET /api/announcements]", err)
    return NextResponse.json(
      errorResponse("Failed to fetch announcements.", "INTERNAL"),
      { status: 500 },
    )
  }
}
