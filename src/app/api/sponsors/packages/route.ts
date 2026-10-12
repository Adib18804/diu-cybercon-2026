// =============================================================================
// GET /api/sponsors/packages
// Sponsor tier definitions + benefit comparison matrix.
// Static — from constants (matches official proposal).
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { SPONSOR_TIERS, SPONSOR_BENEFITS } from "@/lib/constants"
import { successResponse } from "@/lib/utils"

export const revalidate = 3600 // Static data — 1 hour cache

export function GET(_request: NextRequest) {
  return NextResponse.json(
    successResponse({
      tiers:    SPONSOR_TIERS,
      benefits: SPONSOR_BENEFITS,
    }),
  )
}
