"use client"

import { CheckCircle2, Lock, Mail, MailCheck, User } from "lucide-react"
import Link from "next/link"
import * as React from "react"
import toast from "react-hot-toast"

import { AuthCard, PasswordStrengthMeter } from "@/components/auth"
import { Alert, Button, Input } from "@/components/ui"
import { ERROR_MESSAGES } from "@/lib/constants"
import { signUpSchema } from "@/lib/validations/auth"

// =============================================================================
// SignupForm — account creation with password strength meter
// =============================================================================

type FieldKey = "name" | "email" | "password" | "confirmPassword"

const KNOWN_FIELDS: readonly FieldKey[] = [
  "name",
  "email",
  "password",
  "confirmPassword",
]

export function SignupForm() {
  const [values, setValues] = React.useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [fieldErrors, setFieldErrors] = React.useState<
    Partial<Record<FieldKey, string>>
  >({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [registeredEmail, setRegisteredEmail] = React.useState<string | null>(null)

  function setField(key: FieldKey, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  /** Map server `details` (Record<string, string[]>) onto known form fields */
  function applyServerDetails(details: unknown) {
    if (!details || typeof details !== "object") {
      return
    }
    const mapped: Partial<Record<FieldKey, string>> = {}
    for (const key of KNOWN_FIELDS) {
      const messages = (details as Record<string, unknown>)[key]
      if (Array.isArray(messages) && typeof messages[0] === "string") {
        mapped[key] = messages[0]
      }
    }
    setFieldErrors((prev) => ({ ...prev, ...mapped }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) {
      return
    }
    setFormError(null)

    // ── Client validation (server validates independently) ────────────────
    const parsed = signUpSchema.safeParse(values)
    if (!parsed.success) {
      const errors: Partial<Record<FieldKey, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (KNOWN_FIELDS.includes(key as FieldKey) && !errors[key as FieldKey]) {
          errors[key as FieldKey] = issue.message
        }
      }
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setSubmitting(true)

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: parsed.data.name,
          email: parsed.data.email,
          password: parsed.data.password,
        }),
      })

      const json = (await response.json().catch(() => null)) as
        | {
            success?: boolean
            error?: string
            code?: string
            details?: unknown
            data?: { email?: string }
            message?: string
          }
        | null

      if (response.status === 429) {
        setFormError(
          "Too many sign-up attempts. Please wait a few minutes and try again.",
        )
        return
      }

      if (response.status === 422 && json) {
        applyServerDetails(json.details)
        setFormError(json.error ?? "Please check your input and try again.")
        return
      }

      if (!response.ok || !json?.success) {
        setFormError(json?.error ?? ERROR_MESSAGES.INTERNAL)
        return
      }

      // ── Success — show "check your email" state ─────────────────────────
      const email = json.data?.email ?? parsed.data.email
      setRegisteredEmail(email)
      toast.success("Account created! Check your email to verify.")
    } catch {
      setFormError(ERROR_MESSAGES.INTERNAL)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success state: verification email sent ────────────────────────────────
  if (registeredEmail) {
    return (
      <AuthCard
        title="Check Your Email"
        subtitle="One last step to activate your account."
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/5 shadow-glow-cyan-sm">
            <MailCheck size={28} className="text-cyan" aria-hidden="true" />
          </div>

          <p className="text-sm leading-relaxed text-text-muted">
            We sent a verification link to{" "}
            <span className="font-mono font-medium text-text-primary">
              {registeredEmail}
            </span>
            . Click the link to activate your account, then sign in.
          </p>

          <p className="text-xs text-text-faint">
            The link expires in 24 hours. Don&apos;t see it? Check your spam
            folder.
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
      title="Create Account"
      subtitle="Join DIU CyberCon 2026 — register for events and track your participation."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-cyan transition-colors duration-150 hover:text-cyan-400"
          >
            Sign in
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
          label="Full Name"
          type="text"
          name="name"
          autoComplete="name"
          placeholder="e.g. Rafid Ahmed"
          leftIcon={<User size={16} />}
          value={values.name}
          onChange={(e) => setField("name", e.target.value)}
          error={fieldErrors.name}
          required
        />

        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          leftIcon={<Mail size={16} />}
          value={values.email}
          onChange={(e) => setField("email", e.target.value)}
          error={fieldErrors.email}
          required
        />

        <div className="space-y-1.5">
          <Input
            label="Password"
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="Create a strong password"
            leftIcon={<Lock size={16} />}
            value={values.password}
            onChange={(e) => setField("password", e.target.value)}
            error={fieldErrors.password}
            required
          />

          {/* ── Strength meter ─────────────────────────────────────────── */}
          {!fieldErrors.password && (
            <PasswordStrengthMeter password={values.password} />
          )}
        </div>

        <Input
          label="Confirm Password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Re-enter your password"
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

        <div className="rounded-md border border-border bg-bg-elevated/60 px-3 py-2.5">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-text-muted">
            <CheckCircle2
              size={14}
              className="mt-0.5 shrink-0 text-cyan"
              aria-hidden="true"
            />
            After signing up, verify your email to activate your account. You can
            then register for CTF, Project Showcasing, and other events.
          </p>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={submitting}
          loadingText="Creating account…"
          fullWidth
        >
          Create Account
        </Button>
      </form>
    </AuthCard>
  )
}
