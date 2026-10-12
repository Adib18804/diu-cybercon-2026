"use client"

import { Lock, Mail } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import * as React from "react"
import toast from "react-hot-toast"

import { AuthCard } from "@/components/auth"
import { Alert, Button, Input } from "@/components/ui"
import { APP_EMAIL, ERROR_MESSAGES } from "@/lib/constants"
import { signInSchema } from "@/lib/validations/auth"

// =============================================================================
// LoginForm — client-side credentials sign-in
// =============================================================================

// Friendly messages keyed by sign-in error code / error
const ERROR_FRIENDLY: Record<string, string> = {
  CredentialsSignin: "Invalid email or password. Please try again.",
  EMAIL_NOT_VERIFIED:
    "Your email is not verified yet. Check your inbox for the verification link we sent you.",
  ACCOUNT_SUSPENDED: `This account has been suspended. Please contact ${APP_EMAIL} for assistance.`,
  RATE_LIMITED: "Too many sign-in attempts. Please wait a few minutes and try again.",
  Configuration: ERROR_MESSAGES.INTERNAL,
}

interface LoginFormProps {
  callbackUrl: string | null
}

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter()

  const [values, setValues] = React.useState({ email: "", password: "" })
  const [fieldErrors, setFieldErrors] = React.useState<{
    email?: string
    password?: string
  }>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) {
      return
    }
    setFormError(null)

    // ── Client validation (server validates independently) ────────────────
    const parsed = signInSchema.safeParse(values)
    if (!parsed.success) {
      const errors: { email?: string; password?: string } = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if ((key === "email" || key === "password") && !errors[key]) {
          errors[key] = issue.message
        }
      }
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setSubmitting(true)

    try {
      const result = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      })

      if (result?.error) {
        // Prefer the specific `code` (EMAIL_NOT_VERIFIED, ACCOUNT_SUSPENDED, …)
        const key =
          result.code && ERROR_FRIENDLY[result.code]
            ? result.code
            : (result.error ?? "CredentialsSignin")
        setFormError(
          ERROR_FRIENDLY[key] ?? "Invalid email or password. Please try again.",
        )
        return
      }

      toast.success("Welcome back!")
      router.push((callbackUrl ?? "/dashboard") as Route)
      router.refresh()
    } catch {
      setFormError(ERROR_MESSAGES.INTERNAL)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthCard
      title="Welcome Back"
      subtitle="Sign in to manage your registrations and submissions."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-cyan transition-colors duration-150 hover:text-cyan-400"
          >
            Create one
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
          value={values.email}
          onChange={(e) =>
            setValues((v) => ({ ...v, email: e.target.value }))
          }
          error={fieldErrors.email}
          required
        />

        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••"
          leftIcon={<Lock size={16} />}
          value={values.password}
          onChange={(e) =>
            setValues((v) => ({ ...v, password: e.target.value }))
          }
          error={fieldErrors.password}
          required
        />

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs text-text-muted transition-colors duration-150 hover:text-cyan"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={submitting}
          loadingText="Signing in…"
          fullWidth
        >
          Sign In
        </Button>
      </form>
    </AuthCard>
  )
}
