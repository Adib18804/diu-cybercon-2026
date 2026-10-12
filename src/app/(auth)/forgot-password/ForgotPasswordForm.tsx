"use client"

import { KeyRound, Mail, MailCheck } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { AuthCard } from "@/components/auth"
import { Alert, Button, Input } from "@/components/ui"
import { ERROR_MESSAGES } from "@/lib/constants"
import { forgotPasswordSchema } from "@/lib/validations/auth"

// =============================================================================
// ForgotPasswordForm — request a reset link (always generic success message)
// =============================================================================

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("")
  const [fieldError, setFieldError] = React.useState<string | undefined>()
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [sentTo, setSentTo] = React.useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) {
      return
    }
    setFormError(null)

    // ── Client validation (server validates independently) ────────────────
    const parsed = forgotPasswordSchema.safeParse({ email })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setFieldError(issue?.message ?? "Enter a valid email address")
      return
    }
    setFieldError(undefined)
    setSubmitting(true)

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: parsed.data.email }),
      })

      if (response.status === 429) {
        setFormError(
          "Too many reset requests. Please wait a few minutes and try again.",
        )
        return
      }

      const json = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null

      if (response.status === 422) {
        setFieldError(json?.error ?? "Enter a valid email address.")
        return
      }

      if (!response.ok || !json?.success) {
        setFormError(json?.error ?? ERROR_MESSAGES.INTERNAL)
        return
      }

      // Generic success — do not reveal whether the account exists
      setSentTo(parsed.data.email)
    } catch {
      setFormError(ERROR_MESSAGES.INTERNAL)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Sent state ────────────────────────────────────────────────────────────
  if (sentTo) {
    return (
      <AuthCard
        title="Check Your Email"
        subtitle="Password reset instructions are on their way."
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/5 shadow-glow-cyan-sm">
            <MailCheck size={28} className="text-cyan" aria-hidden="true" />
          </div>

          <p className="text-sm leading-relaxed text-text-muted">
            If an account with{" "}
            <span className="font-mono font-medium text-text-primary">
              {sentTo}
            </span>{" "}
            exists, we&apos;ve sent a password reset link to it.
          </p>

          <p className="text-xs text-text-faint">
            The link expires in 1 hour. Check your spam folder if it
            doesn&apos;t arrive within a few minutes.
          </p>

          <Link href="/login" className="btn-primary">
            Back to Sign In
          </Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Forgot Password"
      subtitle="Enter your account email and we'll send you a reset link."
      footer={
        <>
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-medium text-cyan transition-colors duration-150 hover:text-cyan-400"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-4"
        noValidate
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          leftIcon={<Mail size={16} />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldError}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={submitting}
          loadingText="Sending…"
          leftIcon={<KeyRound size={16} />}
          fullWidth
        >
          Send Reset Link
        </Button>
      </form>
    </AuthCard>
  )
}
