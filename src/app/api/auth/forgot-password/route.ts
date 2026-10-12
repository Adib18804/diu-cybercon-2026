// =============================================================================
// POST /api/auth/forgot-password
// Send a signed, time-limited password reset email.
// Rate limited per email AND per IP. Always returns the same response
// to prevent user enumeration.
// =============================================================================

import { randomBytes } from "crypto"

import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"


import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { AUTH } from "@/lib/constants"
import { prisma } from "@/lib/db"
import { sendPasswordResetEmail } from "@/lib/email/resend"
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit"
import { errorResponse, successResponse } from "@/lib/utils"
import { forgotPasswordSchema } from "@/lib/validations/auth"

// Generic success response — same regardless of whether the email exists
const GENERIC_SUCCESS = successResponse(
  null,
  "If an account with that email exists, you will receive a password reset link shortly.",
)

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = extractIpAddress(request)

  // ── 1. Rate limiting by IP ─────────────────────────────────────────────────
  const ipRateResult = await checkRateLimit("login", ip)
  if (!ipRateResult.success) {
    return rateLimitExceededResponse(ipRateResult.retryAfter)
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

  const parsed = forgotPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      errorResponse("Enter a valid email address.", "VALIDATION"),
      { status: 422 },
    )
  }

  const { email } = parsed.data

  // ── 3. Rate limiting by email (prevents spam to a single address) ──────────
  const emailRateResult = await checkRateLimit("passwordReset", email)
  if (!emailRateResult.success) {
    // Return generic message — don't reveal the email is known
    return NextResponse.json(GENERIC_SUCCESS)
  }

  // ── 4. Look up user — ALWAYS return generic success if not found ───────────
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, emailVerified: true, isSuspended: true },
  })

  if (!user || !user.emailVerified || user.isSuspended) {
    // Return generic message — do not reveal account existence or state
    return NextResponse.json(GENERIC_SUCCESS)
  }

  // ── 5. Invalidate existing reset tokens ────────────────────────────────────
  await prisma.passwordReset.deleteMany({
    where: { userId: user.id, usedAt: null },
  })

  // ── 6. Create new reset token ──────────────────────────────────────────────
  const rawToken = randomBytes(48).toString("hex")
  const tokenExpiry = new Date(Date.now() + AUTH.passwordResetExpiry * 1000) // 1 hour

  try {
    await prisma.passwordReset.create({
      data: {
        userId:    user.id,
        token:     rawToken,
        expiresAt: tokenExpiry,
        ipAddress: ip,
      },
    })
  } catch (err) {
    console.error("[ForgotPassword] DB error:", err)
    return NextResponse.json(GENERIC_SUCCESS) // Don't reveal the error
  }

  // ── 7. Dispatch reset email (fire-and-forget) ──────────────────────────────
  void sendPasswordResetEmail({
    to:    email,
    name:  user.name ?? "there",
    token: rawToken,
  }).then((result) => {
    if (!result.success) {
      console.error(`[ForgotPassword] Email send failed for ${email}:`, result.error)
    }
  })

  // ── 8. Audit log ───────────────────────────────────────────────────────────
  void auditLog({
    actorId:    user.id,
    action:     "PASSWORD_RESET_REQUESTED",
    targetType: "User",
    targetId:   user.id,
    ipAddress:  ip,
    userAgent:  extractUserAgent(request),
  })

  return NextResponse.json(GENERIC_SUCCESS)
}
