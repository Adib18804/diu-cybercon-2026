"use client"

import { Send } from "lucide-react"
import * as React from "react"
import toast from "react-hot-toast"

import { Button, Input, Select, Textarea } from "@/components/ui"
import { SPONSOR_TIERS } from "@/lib/constants"

// =============================================================================
// SponsorApplicationForm — client form for /sponsors (#apply)
// Posts to /api/sponsors/apply (rate limited + server-validated). Client-side
// validation mirrors the server zod schema so users get instant feedback,
// while the server remains the source of truth.
// =============================================================================

const TIER_OPTIONS = (["TITLE", "PLATINUM", "GOLD", "CUSTOM"] as const).map((key) => {
  const tier = SPONSOR_TIERS[key]
  return { value: key, label: `${tier.label} — ${tier.priceDisplay}` }
})

interface FormState {
  orgName: string
  contactPerson: string
  email: string
  phone: string
  website: string
  tier: string
  message: string
  hp: string // honeypot — always empty for humans
}

type FieldErrors = Partial<
  Record<"orgName" | "contactPerson" | "email" | "phone" | "website" | "tier" | "message", string>
>

interface ApiSuccess {
  success: true
  data: unknown
  message?: string
}

interface ApiError {
  success: false
  error: string
  code?: string
  details?: Record<string, string[]>
}

type ApiResponse = ApiSuccess | ApiError

const EMPTY_FORM: FormState = {
  orgName: "",
  contactPerson: "",
  email: "",
  phone: "",
  website: "",
  tier: "",
  message: "",
  hp: "",
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {}

  const orgName = form.orgName.trim()
  if (orgName.length < 2) {errors.orgName = "Please enter your organization name (at least 2 characters)."}
  else if (orgName.length > 200) {errors.orgName = "Organization name must be under 200 characters."}

  const contactPerson = form.contactPerson.trim()
  if (contactPerson.length < 2) {errors.contactPerson = "Please enter a contact person (at least 2 characters)."}
  else if (contactPerson.length > 100) {errors.contactPerson = "Contact name must be under 100 characters."}

  const email = form.email.trim()
  if (!EMAIL_RE.test(email)) {errors.email = "Enter a valid email address."}
  else if (email.length > 254) {errors.email = "Email must be under 254 characters."}

  const phone = form.phone.trim()
  if (phone.length < 7) {errors.phone = "Enter a valid phone number (at least 7 characters)."}
  else if (phone.length > 20) {errors.phone = "Phone number must be under 20 characters."}

  const website = form.website.trim()
  if (website.length > 0) {
    if (website.length > 500) {errors.website = "Website URL must be under 500 characters."}
    else if (!isValidUrl(website)) {errors.website = "Enter a valid URL including https://"}
  }

  if (form.tier.length === 0) {errors.tier = "Please select a preferred package."}

  const message = form.message.trim()
  if (message.length > 2000) {errors.message = "Message must be under 2000 characters."}

  return errors
}

function SponsorApplicationForm() {
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const [submitting, setSubmitting] = React.useState(false)

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!(key in prev)) {return prev}
      const next = { ...prev }
      delete next[key as keyof FieldErrors]
      return next
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // Honeypot — bots that fill this are silently discarded.
    if (form.hp.length > 0) {
      toast.success("Your sponsorship application has been received. We will contact you shortly.")
      setForm(EMPTY_FORM)
      return
    }

    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please check the highlighted fields.")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/sponsors/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: form.orgName.trim(),
          contactPerson: form.contactPerson.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          website: form.website.trim(),
          tier: form.tier,
          message: form.message.trim() || undefined,
        }),
      })

      const payload = (await response.json().catch(() => null)) as ApiResponse | null

      if (response.ok && payload?.success) {
        toast.success(
          payload.message ??
            "Your sponsorship application has been received. We will contact you shortly.",
        )
        setForm(EMPTY_FORM)
        return
      }

      // Map server-side field errors (422) back onto the form.
      if (payload && !payload.success && payload.details) {
        const mapped: FieldErrors = {}
        for (const key of [
          "orgName",
          "contactPerson",
          "email",
          "phone",
          "website",
          "tier",
          "message",
        ] as const) {
          const first = payload.details[key]?.[0]
          if (first) {mapped[key] = first}
        }
        setErrors(mapped)
      }

      toast.error(
        payload && !payload.success
          ? payload.error
          : "Failed to submit application. Please try again.",
      )
    } catch {
      toast.error("Network error. Please check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event)
      }}
      noValidate
      className="rounded-xl border border-border bg-bg-panel p-6 sm:p-8"
    >
      <p className="section-label">{"// Sponsor application"}</p>
      <h2 className="mt-2 font-display text-xl font-bold tracking-tight text-text-primary">
        Apply to become a sponsor
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        Tell us about your organization and preferred package — the sponsorship
        team will follow up with next steps.
      </p>

      <div className="mt-6 space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Input
            label="Organization"
            required
            value={form.orgName}
            error={errors.orgName}
            autoComplete="organization"
            placeholder="Company / organization name"
            onChange={(e) => setField("orgName", e.target.value)}
          />
          <Input
            label="Contact person"
            required
            value={form.contactPerson}
            error={errors.contactPerson}
            autoComplete="name"
            placeholder="Full name"
            onChange={(e) => setField("contactPerson", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            error={errors.email}
            autoComplete="email"
            placeholder="you@company.com"
            onChange={(e) => setField("email", e.target.value)}
          />
          <Input
            label="Phone"
            type="tel"
            required
            value={form.phone}
            error={errors.phone}
            autoComplete="tel"
            placeholder="+880 1XXX-XXXXXX"
            onChange={(e) => setField("phone", e.target.value)}
          />
        </div>

        <Input
          label="Website"
          type="url"
          value={form.website}
          error={errors.website}
          autoComplete="url"
          placeholder="https://example.com (optional)"
          onChange={(e) => setField("website", e.target.value)}
        />

        <Select
          label="Preferred package"
          required
          value={form.tier}
          error={errors.tier}
          placeholder="Select a package"
          options={TIER_OPTIONS}
          onChange={(e) => setField("tier", e.target.value)}
        />

        <Textarea
          label="Message"
          rows={4}
          maxLength={2000}
          showCount
          value={form.message}
          error={errors.message}
          placeholder="Anything specific you'd like us to know? (optional)"
          onChange={(e) => setField("message", e.target.value)}
        />

        {/* Honeypot — hidden from humans; bots that fill it are silently discarded */}
        <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
          <label htmlFor="sponsor-hp">Leave this field empty</label>
          <input
            id="sponsor-hp"
            name="hp"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={form.hp}
            onChange={(e) => setField("hp", e.target.value)}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          loadingText="Submitting…"
          leftIcon={<Send className="h-4 w-4" aria-hidden="true" />}
          fullWidth
          className="sm:w-auto"
        >
          Submit application
        </Button>

        <p className="text-xs leading-relaxed text-text-faint">
          Submitting an application does not create a binding agreement — all
          sponsorships are subject to organizer approval.
        </p>
      </div>
    </form>
  )
}

export { SponsorApplicationForm }
