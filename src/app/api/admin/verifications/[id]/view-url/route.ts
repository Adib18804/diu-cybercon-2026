// =============================================================================
// POST /api/admin/verifications/[id]/view-url
// Mints a short-lived (≤ 5 minute) HMAC-signed URL for viewing a stored
// student ID document.
//
// The URL alone is NOT enough to read the file: /api/files/verification/[id]
// independently re-checks the admin session + "verification:view" permission
// and re-verifies the signature, then logs every access (VerificationAccessLog
// + STUDENT_ID_VIEWED audit entry). Minting a URL does not itself expose the
// document — so no access log is written here.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { adminErrorResponse } from "@/lib/admin/http"
import { ERROR_MESSAGES, SIGNED_URL } from "@/lib/constants"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { createSignedViewUrl } from "@/lib/storage"
import { errorResponse, successResponse } from "@/lib/utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("verification:view")
    if (error) {return error}

    const { id } = await params

    const exists = await prisma.studentVerification.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!exists) {
      return NextResponse.json(
        errorResponse(ERROR_MESSAGES.NOT_FOUND, "NOT_FOUND"),
        { status: 404 },
      )
    }

    const url = createSignedViewUrl(id)

    return NextResponse.json(
      successResponse({
        url,
        expiresInSeconds: SIGNED_URL.ttlSeconds,
      }),
    )
  } catch (err) {
    return adminErrorResponse(
      err,
      "POST /api/admin/verifications/[id]/view-url",
    )
  }
}
