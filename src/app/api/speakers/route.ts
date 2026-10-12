// =============================================================================
// GET /api/speakers
// Visible speakers with panel memberships.
// =============================================================================

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { successResponse, errorResponse } from "@/lib/utils"

export const revalidate = 120

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const speakers = await prisma.speaker.findMany({
      where: { isVisible: true },
      orderBy: { displayOrder: "asc" },
      select: {
        id:           true,
        name:         true,
        title:        true,
        organization: true,
        bio:          true,
        expertise:    true,
        photoKey:     true,
        linkedinUrl:  true,
        twitterUrl:   true,
        websiteUrl:   true,
        displayOrder: true,
        panelists: {
          select: {
            role: true,
            panel: {
              select: {
                id:          true,
                topic:       true,
                sessionDate: true,
                status:      true,
              },
            },
          },
          where: {
            panel: { status: { not: "DRAFT" } },
          },
        },
      },
    })

    return NextResponse.json(successResponse(speakers))
  } catch (err) {
    console.error("[GET /api/speakers]", err)
    return NextResponse.json(
      errorResponse("Failed to fetch speakers.", "INTERNAL"),
      { status: 500 },
    )
  }
}
