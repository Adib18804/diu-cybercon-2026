import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

import { z } from "zod"

const claimsSchema = z.object({
  purpose: z.literal("final-registration"),
  registrationId: z.string().min(1).max(64),
  userId: z.string().min(1).max(64),
  expiresAt: z.number().int().positive(),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{20,}$/),
})

export type FinalRegistrationClaims = z.infer<typeof claimsSchema>

function signingSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 characters")
  }
  return secret
}

function signature(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url")
}

export function createFinalRegistrationToken(
  registrationId: string,
  userId: string,
  lifetimeSeconds = 14 * 24 * 60 * 60,
): string {
  const claims: FinalRegistrationClaims = {
    purpose: "final-registration",
    registrationId,
    userId,
    expiresAt: Math.floor(Date.now() / 1000) + lifetimeSeconds,
    nonce: randomBytes(18).toString("base64url"),
  }
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url")
  return `${payload}.${signature(payload)}`
}

export function verifyFinalRegistrationToken(
  token: unknown,
): FinalRegistrationClaims | null {
  if (typeof token !== "string" || token.length > 2048) {
    return null
  }

  const parts = token.split(".")
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null
  }

  const [payload, providedSignature] = parts
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]+$/.test(providedSignature)) {
    return null
  }

  const expected = Buffer.from(signature(payload))
  const provided = Buffer.from(providedSignature)
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null
  }

  try {
    const parsed = claimsSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")))
    if (!parsed.success || parsed.data.expiresAt <= Math.floor(Date.now() / 1000)) {
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}
