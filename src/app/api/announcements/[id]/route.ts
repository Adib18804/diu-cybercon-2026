// =============================================================================
// GET /api/announcements/[id]
// Single published announcement.
// =============================================================================

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { successResponse, errorResponse } from "@/lib/utils"

export const revalidate = 30

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params

  if (!id) {
    return NextResponse.json(errorResponse("Invalid announcement ID.", "VALIDATION"), { status: 400 })
  }

  try {
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      select: {
        id:          true,
        title:       true,
        content:     true,
        isPinned:    true,
        isPublished: true,
        publishedAt: true,
      },
    })

    if (!announcement || !announcement.isPublished) {
      return NextResponse.json(
        errorResponse("Announcement not found.", "NOT_FOUND"),
        { status: 404 },
      )
    }

    return NextResponse.json(successResponse(announcement))
  } catch (err) {
    console.error(`[GET /api/announcements/${id}]`, err)
    return NextResponse.json(
      errorResponse("Failed to fetch announcement.", "INTERNAL"),
      { status: 500 },
    )
  }
}
