// =============================================================================
// Email unsubscribe tokens
// -----------------------------------------------------------------------------
// Announcement broadcasts must offer a one-click unsubscribe. Links carry a
// long-lived signed JWT that encodes only the user id — no PII, no database
// lookup needed to verify integrity.
//
// The signing key is derived from AUTH_SECRET with HKDF under a dedicated
// "email-unsubscribe" context string, so broadcast-link signing is
// cryptographically separate from session signing. No extra env var needed.
// =============================================================================

import { hkdfSync } from "node:crypto"

import { SignJWT, jwtVerify } from "jose"

import { APP_URL } from "@/lib/constants"

const TOKEN_ISSUER = "diu-cybercon-2026"
const TOKEN_AUDIENCE = "email-unsubscribe"
const TOKEN_TTL = "365d"

function getSigningKey(): Uint8Array {
  const root = process.env.AUTH_SECRET
  if (!root || root.length < 16) {
    throw new Error("AUTH_SECRET must be configured to sign unsubscribe links")
  }
  const derived = hkdfSync("sha256", root, TOKEN_ISSUER, TOKEN_AUDIENCE, 32)
  return new Uint8Array(derived)
}

/** Mints a signed unsubscribe token for a user id. */
export async function createUnsubscribeToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getSigningKey())
}

/** Returns the user id carried by a valid token, or null when invalid/expired. */
export async function verifyUnsubscribeToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
      algorithms: ["HS256"],
    })
    return typeof payload.sub === "string" && payload.sub.length > 0
      ? payload.sub
      : null
  } catch {
    return null
  }
}

/** Full URL to the unsubscribe endpoint for one user. */
export async function buildUnsubscribeUrl(userId: string): Promise<string> {
  const token = await createUnsubscribeToken(userId)
  return `${APP_URL}/api/email/unsubscribe?token=${encodeURIComponent(token)}`
}
