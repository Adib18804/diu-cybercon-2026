// =============================================================================
// Sign Up Page — /signup
// =============================================================================

import type { Metadata } from "next"

import { SignupForm } from "./SignupForm"

export const metadata: Metadata = {
  title: "Create Account",
  description:
    "Create your DIU CyberCon 2026 account to register for events and manage your participation.",
  robots: { index: false, follow: false },
}

export default function SignupPage() {
  return <SignupForm />
}
