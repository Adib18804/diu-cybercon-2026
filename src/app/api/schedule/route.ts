// =============================================================================
// GET /api/schedule
// Full 3-day schedule grouped by day.
// =============================================================================

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"

import { EVENT_DATES } from "@/lib/constants"
import { prisma } from "@/lib/db"
import { successResponse, errorResponse } from "@/lib/utils"

export const revalidate = 120

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const items = await prisma.scheduleItem.findMany({
      orderBy: [{ day: "asc" }, { displayOrder: "asc" }],
      select: {
        id:          true,
        day:         true,
        date:        true,
        startTime:   true,
        endTime:     true,
        title:       true,
        description: true,
        venue:       true,
        type:        true,
        isHighlight: true,
        displayOrder: true,
        speakerId:   true,
        event: {
          select: {
            id:   true,
            name: true,
            slug: true,
            type: true,
          },
        },
      },
    })

    // Group by day
    const dayMeta = [
      { day: 1, date: EVENT_DATES.day1.date, label: EVENT_DATES.day1.label, isOnline: true,  description: EVENT_DATES.day1.description },
      { day: 2, date: EVENT_DATES.day2.date, label: EVENT_DATES.day2.label, isOnline: false, description: EVENT_DATES.day2.description },
      { day: 3, date: EVENT_DATES.day3.date, label: EVENT_DATES.day3.label, isOnline: false, description: EVENT_DATES.day3.description },
    ]

    const schedule = dayMeta.map((meta) => ({
      ...meta,
      items: items.filter((item) => item.day === meta.day),
    }))

    return NextResponse.json(successResponse(schedule))
  } catch (err) {
    console.error("[GET /api/schedule]", err)
    return NextResponse.json(
      errorResponse("Failed to fetch schedule.", "INTERNAL"),
      { status: 500 },
    )
  }
}
