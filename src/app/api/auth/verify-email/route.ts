// =============================================================================
// POST /api/auth/verify-email
// Consume a signed email verification token and activate the account.
// =============================================================================

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"

import { auditLog, extractIpAddress } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit"
import { errorResponse, successResponse } from "@/lib/utils"
import { verifyEmailSchema } from "@/lib/validations/auth"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = extractIpAddress(request)

  // ── 1. Rate limiting ───────────────────────────────────────────────────────
  const rateResult = await checkRateLimit("global", ip)
  if (!rateResult.success) {
    return rateLimitExceededResponse(rateResult.retryAfter)
  }

  // ── 2. Parse and validate ──────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      errorResponse("Invalid request body", "VALIDATION"),
      { status: 400 },
    )
  }

  const parsed = verifyEmailSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      errorResponse("Invalid or missing verification token.", "VALIDATION"),
      { status: 422 },
    )
  }

  const { token } = parsed.data

  // ── 3. Look up token ───────────────────────────────────────────────────────
  const verification = await prisma.emailVerification.findUnique({
    where: { token },
    include: {
      user: {
        select: { id: true, email: true, emailVerified: true, isSuspended: true },
      },
    },
  })

  // Token not found — use generic message to prevent oracle attacks
  if (!verification) {
    return NextResponse.json(
      errorResponse(
        "This verification link is invalid or has already been used.",
        "INVALID_TOKEN",
      ),
      { status: 400 },
    )
  }

  // ── 4. Token expiry check ──────────────────────────────────────────────────
  if (verification.expiresAt < new Date()) {
    // Clean up expired token
    void prisma.emailVerification.delete({ where: { id: verification.id } }).catch(() => null)

    return NextResponse.json(
      errorResponse(
        "This verification link has expired. Please sign up again to receive a new link.",
        "TOKEN_EXPIRED",
      ),
      { status: 400 },
    )
  }

  // ── 5. Already verified ────────────────────────────────────────────────────
  if (verification.user.emailVerified) {
    return NextResponse.json(
      successResponse({ email: verification.user.email }, "Your email is already verified. You can sign in."),
    )
  }

  // ── 6. Activate account in a transaction ──────────────────────────────────
  try {
    await prisma.$transaction(async (tx) => {
      // Mark email as verified
      await tx.user.update({
        where: { id: verification.userId },
        data: { emailVerified: new Date() },
      })

      // Consume (delete) the token — one-time use
      await tx.emailVerification.delete({ where: { id: verification.id } })
    })
  } catch (err) {
    console.error("[VerifyEmail] DB error:", err)
    return NextResponse.json(
      errorResponse("Verification failed. Please try again.", "INTERNAL"),
      { status: 500 },
    )
  }

  // ── 7. Audit log ───────────────────────────────────────────────────────────
  void auditLog({
    actorId:    verification.userId,
    action:     "EMAIL_VERIFIED",
    targetType: "User",
    targetId:   verification.userId,
    ipAddress:  ip,
    metadata:   { email: verification.user.email },
  })

  return NextResponse.json(
    successResponse(
      { email: verification.user.email },
      "Email verified successfully. You can now sign in.",
    ),
  )
}
