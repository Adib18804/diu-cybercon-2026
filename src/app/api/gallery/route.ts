// =============================================================================
// GET /api/gallery
// Published gallery images. Supports ?year=N and ?category=X filtering.
// =============================================================================

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"

import { APP_YEAR } from "@/lib/constants"
import { prisma } from "@/lib/db"
import { successResponse, errorResponse, getPaginationParams } from "@/lib/utils"

export const revalidate = 300

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const year     = parseInt(searchParams.get("year") ?? String(APP_YEAR), 10)
  const category = searchParams.get("category") ?? undefined
  const pageParam     = parseInt(searchParams.get("page") ?? "1", 10)
  const pageSizeParam = parseInt(searchParams.get("pageSize") ?? "24", 10)

  const { skip, take } = getPaginationParams(pageParam, pageSizeParam, 100)

  const where = {
    isPublished: true,
    year,
    ...(category ? { category } : {}),
  }

  try {
    const [total, images] = await Promise.all([
      prisma.galleryImage.count({ where }),
      prisma.galleryImage.findMany({
        where,
        orderBy: { displayOrder: "asc" },
        skip,
        take,
        select: {
          id:          true,
          title:       true,
          imageKey:    true,
          publicUrl:   true,
          category:    true,
          altText:     true,
          year:        true,
          displayOrder: true,
        },
      }),
    ])

    return NextResponse.json(
      successResponse({ images, total, year, category: category ?? "all" }),
      {
        headers: { "X-Total-Count": String(total) },
      },
    )
  } catch (err) {
    console.error("[GET /api/gallery]", err)
    return NextResponse.json(
      errorResponse("Failed to fetch gallery.", "INTERNAL"),
      { status: 500 },
    )
  }
}
