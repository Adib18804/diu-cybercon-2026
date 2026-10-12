"use client"

import { CheckCircle2, MailWarning, RefreshCw, XCircle } from "lucide-react"
import Link from "next/link"
import * as React from "react"
import toast from "react-hot-toast"

import { AuthCard } from "@/components/auth"
import { Button } from "@/components/ui"
import { ERROR_MESSAGES } from "@/lib/constants"

// =============================================================================
// VerifyEmailClient — auto-POSTs the token on mount, shows result states
// =============================================================================

interface VerifyEmailClientProps {
  token: string | null
}

type State =
  | { status: "verifying" }
  | { status: "success"; email: string | null }
  | { status: "error"; message: string; retryable: boolean }

export function VerifyEmailClient({ token }: VerifyEmailClientProps) {
  const [state, setState] = React.useState<State>(
    token ? { status: "verifying" } : { status: "error", message: "", retryable: false },
  )

  async function verify() {
    if (!token) {
      return
    }
    setState({ status: "verifying" })

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })

      const json = (await response.json().catch(() => null)) as
        | {
            success?: boolean
            error?: string
            code?: string
            data?: { email?: string }
            message?: string
          }
        | null

      if (response.status === 429) {
        setState({
          status: "error",
          message:
            "Too many verification attempts. Please wait a few minutes and try again.",
          retryable: true,
        })
        return
      }

      if (!response.ok || !json?.success) {
        const retryable = !json?.code || json.code === "INTERNAL"
        setState({
          status: "error",
          message:
            json?.error ??
            "This verification link is invalid or has already been used.",
          retryable,
        })
        return
      }

      toast.success("Email verified successfully!")
      setState({ status: "success", email: json.data?.email ?? null })
    } catch {
      setState({
        status: "error",
        message: ERROR_MESSAGES.INTERNAL,
        retryable: true,
      })
    }
  }

  // Auto-verify once on mount (ref guard survives StrictMode double-effect)
  const startedRef = React.useRef(false)
  React.useEffect(() => {
    if (startedRef.current || !token) {
      return
    }
    startedRef.current = true
    void verify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // ── No token in URL ───────────────────────────────────────────────────────
  if (!token) {
    return (
      <AuthCard
        title="Verification Link Missing"
        subtitle="This page expects a verification token in the URL."
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-amber/30 bg-amber/5">
            <MailWarning size={28} className="text-amber" aria-hidden="true" />
          </div>
          <p className="text-sm leading-relaxed text-text-muted">
            Open the verification link directly from the email we sent you. If
            it has expired, sign up again to receive a fresh link.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/signup" className="btn-primary">
              Sign Up Again
            </Link>
            <Link href="/login" className="btn-secondary">
              Back to Sign In
            </Link>
          </div>
        </div>
      </AuthCard>
    )
  }

  // ── Verifying ─────────────────────────────────────────────────────────────
  if (state.status === "verifying") {
    return (
      <AuthCard
        title="Verifying Your Email"
        subtitle="This only takes a moment."
      >
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="spinner-lg" aria-hidden="true" />
          <p className="text-sm text-text-muted" role="status">
            Confirming your verification token…
          </p>
        </div>
      </AuthCard>
    )
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (state.status === "success") {
    return (
      <AuthCard
        title="Email Verified"
        subtitle="Your account is now active."
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-neon/30 bg-neon/5">
            <CheckCircle2 size={28} className="text-neon" aria-hidden="true" />
          </div>
          <p className="text-sm leading-relaxed text-text-muted">
            {state.email ? (
              <>
                <span className="font-mono font-medium text-text-primary">
                  {state.email}
                </span>{" "}
                has been verified. Sign in to register for events.
              </>
            ) : (
              "Your email has been verified. Sign in to register for events."
            )}
          </p>
          <Link href="/login" className="btn-primary">
            Sign In
          </Link>
        </div>
      </AuthCard>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  return (
    <AuthCard
      title="Verification Failed"
      subtitle="We couldn't verify this link."
    >
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-pink/30 bg-pink/5">
          <XCircle size={28} className="text-pink" aria-hidden="true" />
        </div>
        <p className="text-sm leading-relaxed text-text-muted">
          {state.message}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {state.retryable && (
            <Button
              type="button"
              variant="primary"
              leftIcon={<RefreshCw size={16} />}
              onClick={() => void verify()}
            >
              Try Again
            </Button>
          )}
          <Link href="/signup" className="btn-secondary">
            Sign Up Again
          </Link>
          <Link href="/login" className="btn-ghost">
            Back to Sign In
          </Link>
        </div>
      </div>
    </AuthCard>
  )
}
