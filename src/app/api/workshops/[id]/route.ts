// =============================================================================
// GET /api/workshops/[id]
// Single workshop detail with live seat count.
// =============================================================================

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { successResponse, errorResponse, isDeadlinePassed } from "@/lib/utils"

export const revalidate = 10

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params

  if (!id) {
    return NextResponse.json(errorResponse("Invalid workshop ID.", "VALIDATION"), { status: 400 })
  }

  try {
    const workshop = await prisma.workshop.findUnique({
      where: { id },
      select: {
        id:                   true,
        title:                true,
        instructorName:       true,
        instructorOrg:        true,
        instructorBio:        true,
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
      },
    })

    if (!workshop || workshop.status === "DRAFT") {
      return NextResponse.json(errorResponse("Workshop not found.", "NOT_FOUND"), { status: 404 })
    }

    const deadlinePassed = isDeadlinePassed(workshop.registrationDeadline)
    const seatsRemaining = Math.max(0, workshop.totalSeats - workshop.registeredCount)

    return NextResponse.json(
      successResponse({
        ...workshop,
        seatsRemaining,
        isDeadlinePassed: deadlinePassed,
        isOpen:
          workshop.status === "OPEN" &&
          !deadlinePassed &&
          seatsRemaining > 0,
      }),
    )
  } catch (err) {
    console.error(`[GET /api/workshops/${id}]`, err)
    return NextResponse.json(
      errorResponse("Failed to fetch workshop.", "INTERNAL"),
      { status: 500 },
    )
  }
}
