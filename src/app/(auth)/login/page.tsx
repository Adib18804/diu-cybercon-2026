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
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // ── Sanitize callbackUrl — internal paths only (no open redirects) ────────
  const resolvedParams = await searchParams
  const raw = resolvedParams?.callbackUrl
  const callbackUrl =
    typeof raw === "string" &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.startsWith("/\\")
      ? raw
      : null

  return <LoginForm callbackUrl={callbackUrl} />
}
