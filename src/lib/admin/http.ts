// =============================================================================
// DIU_CYBERCON 2026 — Admin route helpers
// One place for admin route error mapping + shared domain errors.
// =============================================================================

import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

import { errorResponse } from "@/lib/utils"

/**
 * Domain error for admin operations. Thrown by services/routes when the
 * request is valid but the operation cannot proceed (not found, state
 * conflict, business-rule violation, …).
 */
export class AdminError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400,
    public details?: Record<string, string[]>,
  ) {
    super(message)
    this.name = "AdminError"
  }
}

/**
 * Map any error thrown by an admin route into a clean JSON response.
 * - AdminError          → its user-safe message/code/status
 * - Prisma P2002        → 409 duplicate (unique-key races)
 * - Prisma P2025        → 404 record not found (update/delete on missing row)
 * - anything else       → logged server-side, generic 500 (never leaks internals)
 */
export function adminErrorResponse(
  err: unknown,
  context: string,
): NextResponse {
  if (err instanceof AdminError) {
    return NextResponse.json(
      errorResponse(err.message, err.code, err.details),
      { status: err.status },
    )
  }
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    return NextResponse.json(
      errorResponse(
        "This action conflicts with an existing record. Please review and try again.",
        "DUPLICATE",
      ),
      { status: 409 },
    )
  }
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2025"
  ) {
    return NextResponse.json(
      errorResponse("The requested record was not found.", "NOT_FOUND"),
      { status: 404 },
    )
  }
  console.error(`[${context}]`, err)
  return NextResponse.json(
    errorResponse("Something went wrong. Please try again.", "INTERNAL"),
    { status: 500 },
  )
}
