// =============================================================================
// Reset Password Page — /reset-password?token=…
// =============================================================================

import type { Metadata } from "next"

import { ResetPasswordForm } from "./ResetPasswordForm"

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Set a new password for your DIU CyberCon 2026 account.",
  robots: { index: false, follow: false },
}

interface ResetPasswordPageProps {
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

export default function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const token = sanitizeToken(searchParams?.token)
  return <ResetPasswordForm token={token} />
}
