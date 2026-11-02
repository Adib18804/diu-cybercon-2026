// =============================================================================
// DIU_CYBERCON 2026 — QR Code Signing & Verification
// QR tokens contain ONLY a signed registrationId — never PII.
// =============================================================================

import { SignJWT, jwtVerify } from "jose"

import { AUTH } from "@/lib/constants"
import type { QRPayload } from "@/types/index"

function getQrSecret(): Uint8Array {
  const secret = process.env.QR_SIGNING_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("QR_SIGNING_SECRET is missing or too short (min 32 chars)")
  }
  return new TextEncoder().encode(secret)
}

/**
 * Sign a QR token for a registration ID.
 * Token contains: { rid, iat, exp } — nothing else.
 */
export async function signQrToken(registrationId: string): Promise<string> {
  const secret = getQrSecret()
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({ rid: registrationId } satisfies Omit<QRPayload, "iat" | "exp">)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + AUTH.qrTokenExpiry)
    .setIssuer("diucybercon.com")
    .setAudience("diucybercon-checkin")
    .sign(secret)
}

/**
 * Verify a QR token and return the registrationId.
 * Throws if invalid, expired, or tampered.
 */
export async function verifyQrToken(
  token: string,
): Promise<{ registrationId: string }> {
  const secret = getQrSecret()

  const { payload } = await jwtVerify(token, secret, {
    issuer: "diucybercon.com",
    audience: "diucybercon-checkin",
    algorithms: ["HS256"],
  })

  const rid = payload["rid"]
  if (typeof rid !== "string" || !rid) {
    throw new Error("Invalid QR token payload")
  }

  return { registrationId: rid }
}

/**
 * Generate a QR code image as a data URL.
 * Uses the qrcode package (server-side only).
 *
 * style:
 * - "neon"  → cyan-on-dark, for the screen (dashboard pass cards)
 * - "print" → black-on-white, high contrast for embedding in printable
 *             documents (registration confirmation PDF)
 */
export async function generateQrDataUrl(
  token: string,
  style: "neon" | "print" = "neon",
): Promise<string> {
  const QRCode = await import("qrcode")
  return QRCode.toDataURL(token, {
    width: 300,
    margin: 2,
    color:
      style === "print"
        ? { dark: "#000000", light: "#ffffff" }
        : { dark: "#000000", light: "#FFFFFF" },
    errorCorrectionLevel: "M",
  })
}
