// =============================================================================
// GET /api/schedule/[day]
// Single day schedule (day = 1, 2, or 3).
// =============================================================================

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"

import { EVENT_DATES } from "@/lib/constants"
import { prisma } from "@/lib/db"
import { successResponse, errorResponse } from "@/lib/utils"

export const revalidate = 120

const DAY_META = {
  1: { date: EVENT_DATES.day1.date, label: EVENT_DATES.day1.label, isOnline: true },
  2: { date: EVENT_DATES.day2.date, label: EVENT_DATES.day2.label, isOnline: false },
  3: { date: EVENT_DATES.day3.date, label: EVENT_DATES.day3.label, isOnline: false },
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ day: string }> },
): Promise<NextResponse> {
  const { day: dayParam } = await params
  const day = parseInt(dayParam, 10)

  if (!day || day < 1 || day > 3) {
    return NextResponse.json(
      errorResponse("Day must be 1, 2, or 3.", "VALIDATION"),
      { status: 400 },
    )
  }

  try {
    const items = await prisma.scheduleItem.findMany({
      where: { day },
      orderBy: { displayOrder: "asc" },
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
        event: {
          select: { id: true, name: true, slug: true, type: true },
        },
      },
    })

    const meta = DAY_META[day as 1 | 2 | 3]

    return NextResponse.json(
      successResponse({ day, ...meta, items }),
    )
  } catch (err) {
    console.error(`[GET /api/schedule/${day}]`, err)
    return NextResponse.json(
      errorResponse("Failed to fetch schedule.", "INTERNAL"),
      { status: 500 },
    )
  }
}
