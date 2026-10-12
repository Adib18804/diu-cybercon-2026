// =============================================================================
// GET /api/sponsors
// Active sponsors grouped by tier, for current year.
// =============================================================================

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"

import { APP_YEAR } from "@/lib/constants"
import { prisma } from "@/lib/db"
import { successResponse, errorResponse } from "@/lib/utils"

export const revalidate = 300 // 5 minutes

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const sponsors = await prisma.sponsor.findMany({
      where: { isActive: true, year: APP_YEAR },
      orderBy: [{ displayOrder: "asc" }],
      select: {
        id:          true,
        name:        true,
        tier:        true,
        logoKey:     true,
        websiteUrl:  true,
        description: true,
        year:        true,
        displayOrder: true,
      },
    })

    // Group by tier
    const grouped = sponsors.reduce(
      (acc, sponsor) => {
        const tier = sponsor.tier
        if (!acc[tier]) {acc[tier] = []}
        acc[tier].push(sponsor)
        return acc
      },
      {} as Record<string, typeof sponsors>,
    )

    return NextResponse.json(
      successResponse({
        sponsors: grouped,
        total: sponsors.length,
        year: APP_YEAR,
      }),
    )
  } catch (err) {
    console.error("[GET /api/sponsors]", err)
    return NextResponse.json(
      errorResponse("Failed to fetch sponsors.", "INTERNAL"),
      { status: 500 },
    )
  }
}
