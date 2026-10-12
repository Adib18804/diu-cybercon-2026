// =============================================================================
// RegisterAuthGate — shown on /register when the visitor is not signed in.
// Explains why an account is needed and routes to sign-in / sign-up with a
// return path back to the wizard.
// =============================================================================

import { CalendarCheck, MailCheck, ShieldCheck, UserPlus } from "lucide-react"
import Link from "next/link"

import { AuthCard } from "@/components/auth"

const STEPS = [
  {
    icon: UserPlus,
    title: "Create your account",
    description: "One account for all events, teams, and your QR entry pass.",
  },
  {
    icon: MailCheck,
    title: "Verify your email",
    description: "We send a one-time link to confirm it is really you.",
  },
  {
    icon: CalendarCheck,
    title: "Pick your events",
    description: "Register for CTF, showcases, posters, and workshops.",
  },
] as const

export function RegisterAuthGate() {
  return (
    <AuthCard
      title="Sign In to Register"
      subtitle="Registration is tied to your account so your team, student verification, and QR pass stay in one secure place."
      footer={
        <>
          Already registered?{" "}
          <Link
            href="/dashboard"
            className="font-medium text-cyan transition-colors duration-150 hover:text-cyan-400"
          >
            Go to your dashboard
          </Link>
        </>
      }
    >
      {/* Why an account — three quick steps */}
      <ul className="space-y-4">
        {STEPS.map((step) => (
          <li key={step.title} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-cyan/30 bg-cyan/5">
              <step.icon size={16} className="text-cyan" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">
                {step.title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {/* Actions */}
      <div className="mt-6 space-y-3">
        <Link
          href="/login?callbackUrl=/register"
          className="btn-primary flex h-11 w-full items-center justify-center gap-2"
        >
          Sign In &amp; Continue
        </Link>
        <Link
          href="/signup"
          className="btn-secondary flex h-11 w-full items-center justify-center gap-2"
        >
          Create an Account
        </Link>
      </div>

      <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-text-faint">
        <ShieldCheck
          size={14}
          className="mt-0.5 shrink-0 text-neon"
          aria-hidden="true"
        />
        Your student ID is stored privately, viewable only by the verification
        team, and never shared publicly.
      </p>
    </AuthCard>
  )
}
