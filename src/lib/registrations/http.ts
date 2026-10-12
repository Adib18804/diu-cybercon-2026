// =============================================================================
// DIU CyberCon 2026 — Registration/Team route error mapping
// One place to translate domain errors into safe JSON responses.
// =============================================================================

import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

import { RegistrationError } from "@/lib/registrations/service"
import { errorResponse } from "@/lib/utils"

/**
 * Map any error thrown by a registration/team route into a clean response.
 * - RegistrationError  → its user-safe message/code/status
 * - Prisma P2002       → 409 duplicate (rare write races on unique keys)
 * - anything else      → logged server-side, generic 500 (never leaks internals)
 */
export function registrationErrorResponse(
  err: unknown,
  context: string,
): NextResponse {
  if (err instanceof RegistrationError) {
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
  console.error(`[${context}]`, err)
  return NextResponse.json(
    errorResponse("Something went wrong. Please try again.", "INTERNAL"),
    { status: 500 },
  )
}
