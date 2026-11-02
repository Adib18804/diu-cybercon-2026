import type { Metadata } from "next"

import { LoginForm } from "./LoginForm"

// =============================================================================
// Login Page (server) — sanitizes callbackUrl, renders the client form
// =============================================================================

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your DIU_CYBERCON 2026 account.",
  robots: { index: false, follow: false },
}

interface LoginPageProps {
  searchParams?: { [key: string]: string | string[] | undefined }
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  // ── Sanitize callbackUrl — internal paths only (no open redirects) ────────
  const raw = searchParams?.callbackUrl
  const callbackUrl =
    typeof raw === "string" &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.startsWith("/\\")
      ? raw
      : null

  return <LoginForm callbackUrl={callbackUrl} />
}
