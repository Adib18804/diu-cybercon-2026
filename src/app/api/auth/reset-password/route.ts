// =============================================================================
// POST /api/auth/reset-password
// Consume a valid reset token and update the user's password.
// Token is one-time use. Invalidates all existing sessions on success.
// =============================================================================

import argon2 from "argon2"
import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"

import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit"
import { errorResponse, successResponse } from "@/lib/utils"
import { resetPasswordServerSchema } from "@/lib/validations/auth"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = extractIpAddress(request)

  // ── 1. Rate limiting ───────────────────────────────────────────────────────
  const rateResult = await checkRateLimit("login", ip)
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

  const parsed = resetPasswordServerSchema.safeParse(body)
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors as Record<string, string[]>
    return NextResponse.json(
      errorResponse("Please check your input and try again.", "VALIDATION", details),
      { status: 422 },
    )
  }

  const { token, password } = parsed.data

  // ── 3. Look up the reset token ─────────────────────────────────────────────
  const resetRecord = await prisma.passwordReset.findUnique({
    where: { token },
    include: {
      user: {
        select: { id: true, email: true, isSuspended: true },
      },
    },
  })

  // Generic message — prevent oracle attacks
  const INVALID_TOKEN_RESPONSE = NextResponse.json(
    errorResponse(
      "This link is invalid or has already been used. Please request a new password reset.",
      "INVALID_TOKEN",
    ),
    { status: 400 },
  )

  if (!resetRecord) {return INVALID_TOKEN_RESPONSE}

  // ── 4. Already used ────────────────────────────────────────────────────────
  if (resetRecord.usedAt) {return INVALID_TOKEN_RESPONSE}

  // ── 5. Expired ────────────────────────────────────────────────────────────
  if (resetRecord.expiresAt < new Date()) {
    void prisma.passwordReset.delete({ where: { id: resetRecord.id } }).catch(() => null)
    return NextResponse.json(
      errorResponse(
        "This reset link has expired. Please request a new one.",
        "TOKEN_EXPIRED",
      ),
      { status: 400 },
    )
  }

  // ── 6. Suspended account ──────────────────────────────────────────────────
  if (resetRecord.user.isSuspended) {
    return NextResponse.json(
      errorResponse(
        "Your account has been suspended. Please contact support.",
        "SUSPENDED",
      ),
      { status: 403 },
    )
  }

  // ── 7. Hash the new password ──────────────────────────────────────────────
  let newHash: string
  try {
    newHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost:   3,
      parallelism: 4,
    })
  } catch {
    return NextResponse.json(
      errorResponse("Password update failed. Please try again.", "INTERNAL"),
      { status: 500 },
    )
  }

  // ── 8. Update password + mark token used + invalidate all sessions ─────────
  try {
    await prisma.$transaction(async (tx) => {
      // Update password
      await tx.user.update({
        where: { id: resetRecord.userId },
        data:  { passwordHash: newHash },
      })

      // Mark token as used (keep for audit trail — don't delete)
      await tx.passwordReset.update({
        where: { id: resetRecord.id },
        data:  { usedAt: new Date() },
      })

      // Invalidate all existing sessions (session rotation on password change)
      await tx.session.deleteMany({
        where: { userId: resetRecord.userId },
      })
    })
  } catch (err) {
    console.error("[ResetPassword] DB error:", err)
    return NextResponse.json(
      errorResponse("Password update failed. Please try again.", "INTERNAL"),
      { status: 500 },
    )
  }

  // ── 9. Audit log ───────────────────────────────────────────────────────────
  void auditLog({
    actorId:    resetRecord.userId,
    action:     "PASSWORD_RESET_COMPLETED",
    targetType: "User",
    targetId:   resetRecord.userId,
    ipAddress:  ip,
    userAgent:  extractUserAgent(request),
    metadata:   { initiatorIp: resetRecord.ipAddress },
  })

  return NextResponse.json(
    successResponse(
      null,
      "Password updated successfully. You can now sign in with your new password.",
    ),
  )
}
