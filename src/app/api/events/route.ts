// =============================================================================
// GET /api/events
// All active/open event modules with registration status.
// Public — no auth required. Cached with ISR.
// =============================================================================

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { successResponse, errorResponse, isDeadlinePassed } from "@/lib/utils"

export const revalidate = 60 // ISR: revalidate every 60 seconds

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const events = await prisma.event.findMany({
      where: {
        status: { in: ["OPEN", "CLOSED", "COMPLETED"] },
      },
      orderBy: { displayOrder: "asc" },
      select: {
        id:                   true,
        type:                 true,
        name:                 true,
        slug:                 true,
        shortDescription:     true,
        status:               true,
        registrationOpen:     true,
        registrationDeadline: true,
        participantLimit:     true,
        isTeamEvent:          true,
        minTeamSize:          true,
        maxTeamSize:          true,
        eventDay:             true,
        startDate:            true,
        endDate:              true,
        venue:                true,
        displayOrder:         true,
        iconName:             true,
        accentColor:          true,
        // Count registrations for public stats
        _count: { select: { registrations: true } },
      },
    })

    const enriched = events.map((event) => ({
      ...event,
      registrationCount:   event._count.registrations,
      isDeadlinePassed:    event.registrationDeadline
        ? isDeadlinePassed(event.registrationDeadline)
        : false,
      canRegister:
        event.registrationOpen &&
        event.status === "OPEN" &&
        (event.registrationDeadline
          ? !isDeadlinePassed(event.registrationDeadline)
          : true) &&
        (event.participantLimit
          ? event._count.registrations < event.participantLimit
          : true),
      _count: undefined,
    }))

    return NextResponse.json(successResponse(enriched))
  } catch (err) {
    console.error("[GET /api/events]", err)
    return NextResponse.json(
      errorResponse("Failed to fetch events.", "INTERNAL"),
      { status: 500 },
    )
  }
}
