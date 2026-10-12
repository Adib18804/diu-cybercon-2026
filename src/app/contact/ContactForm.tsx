"use client"

import { Send } from "lucide-react"
import * as React from "react"
import toast from "react-hot-toast"

import { Button, Input, Textarea } from "@/components/ui"

// =============================================================================
// ContactForm — client form for /contact
// Posts to /api/contact (rate limited + honeypot on the server). Client-side
// validation mirrors the server zod schema so users get instant feedback,
// while the server remains the source of truth.
// =============================================================================

interface FormState {
  name: string
  email: string
  subject: string
  message: string
  website: string // honeypot — always empty for humans
}

type FieldErrors = Partial<Record<"name" | "email" | "subject" | "message", string>>

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
  name: "",
  email: "",
  subject: "",
  message: "",
  website: "",
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {}

  const name = form.name.trim()
  if (name.length < 2) {errors.name = "Please enter your name (at least 2 characters)."}
  else if (name.length > 100) {errors.name = "Name must be under 100 characters."}

  const email = form.email.trim()
  if (!EMAIL_RE.test(email)) {errors.email = "Enter a valid email address."}
  else if (email.length > 254) {errors.email = "Email must be under 254 characters."}

  const subject = form.subject.trim()
  if (subject.length < 3) {errors.subject = "Please add a subject (at least 3 characters)."}
  else if (subject.length > 200) {errors.subject = "Subject must be under 200 characters."}

  const message = form.message.trim()
  if (message.length < 10) {errors.message = "Message must be at least 10 characters."}
  else if (message.length > 3000) {errors.message = "Message must be under 3000 characters."}

  return errors
}

function ContactForm() {
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

    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please check the highlighted fields.")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          subject: form.subject.trim(),
          message: form.message.trim(),
          website: form.website,
        }),
      })

      const payload = (await response.json().catch(() => null)) as ApiResponse | null

      if (response.ok && payload?.success) {
        toast.success(payload.message ?? "Message sent successfully.")
        setForm(EMPTY_FORM)
        return
      }

      // Map server-side field errors (422) back onto the form.
      if (payload && !payload.success && payload.details) {
        const mapped: FieldErrors = {}
        for (const key of ["name", "email", "subject", "message"] as const) {
          const first = payload.details[key]?.[0]
          if (first) {mapped[key] = first}
        }
        setErrors(mapped)
      }

      toast.error(
        payload && !payload.success
          ? payload.error
          : "Failed to send message. Please try again.",
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
      <p className="section-label">{"// Send a message"}</p>
      <h2 className="mt-2 font-display text-xl font-bold tracking-tight text-text-primary">
        Drop us a line
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        We typically respond within a few working days. For urgent registration
        issues, include your registration ID in the message.
      </p>

      <div className="mt-6 space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Input
            label="Full name"
            required
            value={form.name}
            error={errors.name}
            autoComplete="name"
            placeholder="Your name"
            onChange={(e) => setField("name", e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            error={errors.email}
            autoComplete="email"
            placeholder="you@example.com"
            onChange={(e) => setField("email", e.target.value)}
          />
        </div>

        <Input
          label="Subject"
          required
          value={form.subject}
          error={errors.subject}
          placeholder="What is this about?"
          onChange={(e) => setField("subject", e.target.value)}
        />

        <Textarea
          label="Message"
          required
          rows={6}
          maxLength={3000}
          showCount
          value={form.message}
          error={errors.message}
          placeholder="Tell us how we can help…"
          onChange={(e) => setField("message", e.target.value)}
        />

        {/* Honeypot — hidden from humans; bots that fill it are silently ignored */}
        <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
          <label htmlFor="contact-website">Website</label>
          <input
            id="contact-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => setField("website", e.target.value)}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          loadingText="Sending…"
          leftIcon={<Send className="h-4 w-4" aria-hidden="true" />}
          fullWidth
          className="sm:w-auto"
        >
          Send message
        </Button>
      </div>
    </form>
  )
}

export { ContactForm }
