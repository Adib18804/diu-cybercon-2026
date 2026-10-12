"use client"

import { AlertTriangle, CheckCircle2, Lock, ShieldCheck } from "lucide-react"
import Link from "next/link"
import * as React from "react"
import toast from "react-hot-toast"

import { AuthCard, PasswordStrengthMeter } from "@/components/auth"
import { Alert, Button, Input } from "@/components/ui"
import { ERROR_MESSAGES } from "@/lib/constants"
import { resetPasswordSchema } from "@/lib/validations/auth"

// =============================================================================
// ResetPasswordForm — consume reset token, set a new password
// =============================================================================

interface ResetPasswordFormProps {
  token: string | null
}

type FieldKey = "password" | "confirmPassword"

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [values, setValues] = React.useState({
    password: "",
    confirmPassword: "",
  })
  const [fieldErrors, setFieldErrors] = React.useState<
    Partial<Record<FieldKey, string>>
  >({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [fatalError, setFatalError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [succeeded, setSucceeded] = React.useState(false)

  function setField(key: FieldKey, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  // ── Missing / malformed token — dead end, offer a new link ────────────────
  if (!token) {
    return (
      <AuthCard
        title="Invalid Reset Link"
        subtitle="This link is missing its token or is malformed."
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-pink/30 bg-pink/5">
            <AlertTriangle size={28} className="text-pink" aria-hidden="true" />
          </div>
          <p className="text-sm leading-relaxed text-text-muted">
            Password reset links are single-use and expire after 1 hour. Please
            request a fresh link and open it directly from your email.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/forgot-password" className="btn-primary">
              Request New Link
            </Link>
            <Link href="/login" className="btn-secondary">
              Back to Sign In
            </Link>
          </div>
        </div>
      </AuthCard>
    )
  }

  // ── Fatal API error (invalid / expired / suspended) ───────────────────────
  if (fatalError) {
    return (
      <AuthCard
        title="Reset Link Unavailable"
        subtitle="We couldn't use this reset link."
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-pink/30 bg-pink/5">
            <AlertTriangle size={28} className="text-pink" aria-hidden="true" />
          </div>
          <p className="text-sm leading-relaxed text-text-muted">{fatalError}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/forgot-password" className="btn-primary">
              Request New Link
            </Link>
            <Link href="/login" className="btn-secondary">
              Back to Sign In
            </Link>
          </div>
        </div>
      </AuthCard>
    )
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (succeeded) {
    return (
      <AuthCard
        title="Password Updated"
        subtitle="Your password has been changed successfully."
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-neon/30 bg-neon/5">
            <CheckCircle2 size={28} className="text-neon" aria-hidden="true" />
          </div>
          <p className="text-sm leading-relaxed text-text-muted">
            You can now sign in with your new password. All previous sessions
            have been signed out for your security.
          </p>
          <Link href="/login" className="btn-primary">
            Sign In
          </Link>
        </div>
      </AuthCard>
    )
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || !token) {
      return
    }
    setFormError(null)

    // ── Client validation (server validates independently) ────────────────
    const parsed = resetPasswordSchema.safeParse({ ...values, token })
    if (!parsed.success) {
      const errors: Partial<Record<FieldKey, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if ((key === "password" || key === "confirmPassword") && !errors[key]) {
          errors[key] = issue.message
        }
      }
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setSubmitting(true)

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: parsed.data.password,
        }),
      })

      const json = (await response.json().catch(() => null)) as
        | {
            success?: boolean
            error?: string
            code?: string
            details?: unknown
          }
        | null

      if (response.status === 429) {
        setFormError(
          "Too many attempts. Please wait a few minutes and try again.",
        )
        return
      }

      // ── Fatal token problems ─────────────────────────────────────────
      if (
        response.status === 400 ||
        response.status === 403 ||
        json?.code === "INVALID_TOKEN" ||
        json?.code === "TOKEN_EXPIRED" ||
        json?.code === "SUSPENDED"
      ) {
        setFatalError(
          json?.error ??
            "This link is invalid or has already been used. Please request a new password reset.",
        )
        return
      }

      if (response.status === 422) {
        const details = json?.details
        if (details && typeof details === "object") {
          const mapped: Partial<Record<FieldKey, string>> = {}
          for (const key of ["password", "confirmPassword"] as const) {
            const messages = (details as Record<string, unknown>)[key]
            if (Array.isArray(messages) && typeof messages[0] === "string") {
              mapped[key] = messages[0]
            }
          }
          setFieldErrors(mapped)
        }
        setFormError(json?.error ?? "Please check your input and try again.")
        return
      }

      if (!response.ok || !json?.success) {
        setFormError(json?.error ?? ERROR_MESSAGES.INTERNAL)
        return
      }

      toast.success("Password updated successfully!")
      setSucceeded(true)
    } catch {
      setFormError(ERROR_MESSAGES.INTERNAL)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard
      title="Set New Password"
      subtitle="Choose a strong password you haven't used before."
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

        <div className="space-y-1.5">
          <Input
            label="New Password"
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="Enter a strong password"
            leftIcon={<Lock size={16} />}
            value={values.password}
            onChange={(e) => setField("password", e.target.value)}
            error={fieldErrors.password}
            required
          />

          {!fieldErrors.password && (
            <PasswordStrengthMeter password={values.password} />
          )}
        </div>

        <Input
          label="Confirm New Password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Re-enter your new password"
          leftIcon={<Lock size={16} />}
          value={values.confirmPassword}
          onChange={(e) => setField("confirmPassword", e.target.value)}
          error={fieldErrors.confirmPassword}
          success={
            values.confirmPassword.length > 0 &&
            values.confirmPassword === values.password &&
            !fieldErrors.confirmPassword
          }
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={submitting}
          loadingText="Updating password…"
          leftIcon={<ShieldCheck size={16} />}
          fullWidth
        >
          Update Password
        </Button>
      </form>
    </AuthCard>
  )
}
