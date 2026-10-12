// =============================================================================
// GET /api/events/[slug]
// Single event detail — full description, rules, eligibility, prizes.
// =============================================================================

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { successResponse, errorResponse, isDeadlinePassed } from "@/lib/utils"

export const revalidate = 60

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params

  if (!slug || typeof slug !== "string") {
    return NextResponse.json(
      errorResponse("Invalid event slug.", "VALIDATION"),
      { status: 400 },
    )
  }

  try {
    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id:                   true,
        type:                 true,
        name:                 true,
        slug:                 true,
        shortDescription:     true,
        fullDescription:      true,
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
        prizes:               true,
        rules:                true,
        eligibility:          true,
        displayOrder:         true,
        iconName:             true,
        accentColor:          true,
        _count: { select: { registrations: true } },
      },
    })

    if (!event) {
      return NextResponse.json(
        errorResponse("Event not found.", "NOT_FOUND"),
        { status: 404 },
      )
    }

    // Don't expose DRAFT events publicly
    if (event.status === "DRAFT") {
      return NextResponse.json(
        errorResponse("Event not found.", "NOT_FOUND"),
        { status: 404 },
      )
    }

    const deadlinePassed = event.registrationDeadline
      ? isDeadlinePassed(event.registrationDeadline)
      : false

    return NextResponse.json(
      successResponse({
        ...event,
        registrationCount: event._count.registrations,
        isDeadlinePassed:  deadlinePassed,
        canRegister:
          event.registrationOpen &&
          event.status === "OPEN" &&
          !deadlinePassed &&
          (event.participantLimit
            ? event._count.registrations < event.participantLimit
            : true),
        _count: undefined,
      }),
    )
  } catch (err) {
    console.error(`[GET /api/events/${slug}]`, err)
    return NextResponse.json(
      errorResponse("Failed to fetch event.", "INTERNAL"),
      { status: 500 },
    )
  }
}
