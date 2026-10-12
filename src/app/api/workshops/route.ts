// =============================================================================
// GET /api/workshops
// All open workshops with seat availability.
// =============================================================================

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { successResponse, errorResponse, isDeadlinePassed } from "@/lib/utils"

export const revalidate = 30

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const workshops = await prisma.workshop.findMany({
      where: {
        status: { in: ["OPEN", "CLOSED", "COMPLETED"] },
      },
      orderBy: [{ date: "asc" }, { displayOrder: "asc" }],
      select: {
        id:                   true,
        title:                true,
        instructorName:       true,
        instructorOrg:        true,
        description:          true,
        skillLevel:           true,
        date:                 true,
        startTime:            true,
        endTime:              true,
        venue:                true,
        totalSeats:           true,
        registeredCount:      true,
        registrationDeadline: true,
        requiredEquipment:    true,
        prerequisites:        true,
        status:               true,
        displayOrder:         true,
      },
    })

    const enriched = workshops.map((w) => ({
      ...w,
      seatsRemaining:   Math.max(0, w.totalSeats - w.registeredCount),
      isDeadlinePassed: isDeadlinePassed(w.registrationDeadline),
      isOpen:
        w.status === "OPEN" &&
        !isDeadlinePassed(w.registrationDeadline) &&
        w.registeredCount < w.totalSeats,
    }))

    return NextResponse.json(successResponse(enriched))
  } catch (err) {
    console.error("[GET /api/workshops]", err)
    return NextResponse.json(
      errorResponse("Failed to fetch workshops.", "INTERNAL"),
      { status: 500 },
    )
  }
}
