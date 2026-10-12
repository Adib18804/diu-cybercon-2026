// =============================================================================
// Forgot Password Page — /forgot-password
// =============================================================================

import type { Metadata } from "next"

import { ForgotPasswordForm } from "./ForgotPasswordForm"

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Request a password reset link for your DIU CyberCon 2026 account.",
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
