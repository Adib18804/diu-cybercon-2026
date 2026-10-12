// =============================================================================
// POST /api/auth/register
// Create a new participant account.
// Rate limited · argon2id hashing · email verification dispatch
// =============================================================================

import { randomBytes } from "crypto"

import argon2 from "argon2"
import type { NextRequest} from "next/server";
import { NextResponse } from "next/server"


import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { AUTH } from "@/lib/constants"
import { prisma } from "@/lib/db"
import { sendVerificationEmail } from "@/lib/email/resend"
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit"
import { errorResponse, successResponse } from "@/lib/utils"
import { signUpServerSchema } from "@/lib/validations/auth"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = extractIpAddress(request)

  // ── 1. Rate limiting ───────────────────────────────────────────────────────
  const rateResult = await checkRateLimit("registration", ip)
  if (!rateResult.success) {
    return rateLimitExceededResponse(rateResult.retryAfter)
  }

  // ── 2. Parse body ──────────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      errorResponse("Invalid request body", "VALIDATION"),
      { status: 400 },
    )
  }

  // ── 3. Validate input (server-side, independently of client) ───────────────
  const parsed = signUpServerSchema.safeParse(body)
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors as Record<string, string[]>
    return NextResponse.json(
      errorResponse("Please check your input and try again.", "VALIDATION", details),
      { status: 422 },
    )
  }

  const { email, password, name } = parsed.data

  // ── 4. Duplicate email check ───────────────────────────────────────────────
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })

  if (existing) {
    // Return same message as "success" to prevent email enumeration
    return NextResponse.json(
      successResponse(
        null,
        "If this email is not registered, you will receive a verification email shortly.",
      ),
      { status: 200 },
    )
  }

  // ── 5. Hash password with argon2id ─────────────────────────────────────────
  let passwordHash: string
  try {
    passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,  // 64 MB
      timeCost:   3,
      parallelism: 4,
    })
  } catch {
    return NextResponse.json(
      errorResponse("Account creation failed. Please try again.", "INTERNAL"),
      { status: 500 },
    )
  }

  // ── 6. Generate email verification token ───────────────────────────────────
  const rawToken = randomBytes(48).toString("hex") // 96 hex chars
  const tokenExpiry = new Date(Date.now() + AUTH.emailVerificationExpiry * 1000)

  // ── 7. Create user + verification token in a transaction ──────────────────
  let userId: string
  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          // emailVerified stays null until token is consumed
        },
      })

      await tx.emailVerification.create({
        data: {
          userId:    user.id,
          token:     rawToken,
          expiresAt: tokenExpiry,
        },
      })

      return user
    })

    userId = result.id
  } catch (err) {
    console.error("[Register] DB error:", err)
    return NextResponse.json(
      errorResponse("Account creation failed. Please try again.", "INTERNAL"),
      { status: 500 },
    )
  }

  // ── 8. Dispatch verification email (fire-and-forget — don't block response) ─
  void sendVerificationEmail({ to: email, name, token: rawToken }).then((result) => {
    if (!result.success) {
      console.error(`[Register] Failed to send verification email to ${email}:`, result.error)
    }
  })

  // ── 9. Audit log ───────────────────────────────────────────────────────────
  void auditLog({
    actorId:    userId,
    action:     "USER_REGISTER",
    targetType: "User",
    targetId:   userId,
    ipAddress:  ip,
    userAgent:  extractUserAgent(request),
    metadata:   { email, name },
  })

  return NextResponse.json(
    successResponse(
      { email },
      "Account created. Please check your email to verify your account before signing in.",
    ),
    { status: 201 },
  )
}
