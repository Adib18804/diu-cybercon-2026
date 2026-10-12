// =============================================================================
// Verify Email Page — /verify-email?token=…
// =============================================================================

import type { Metadata } from "next"

import { VerifyEmailClient } from "./VerifyEmailClient"

export const metadata: Metadata = {
  title: "Verify Email",
  description: "Verify your email address to activate your DIU CyberCon 2026 account.",
  robots: { index: false, follow: false },
}

interface VerifyEmailPageProps {
  searchParams?: { [key: string]: string | string[] | undefined }
}

/** Accept only plausibly-shaped tokens (min 32 / max 512 chars, hex/base64url-safe) */
function sanitizeToken(raw: string | string[] | undefined): string | null {
  if (
    typeof raw !== "string" ||
    raw.length < 32 ||
    raw.length > 512 ||
    !/^[A-Za-z0-9_-]+$/.test(raw)
  ) {
    return null
  }
  return raw
}

export default function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const token = sanitizeToken(searchParams?.token)
  return <VerifyEmailClient token={token} />
}
