// =============================================================================
// DIU_CYBERCON 2026 — Email Service (Resend)
// All outbound transactional email goes through this module.
// =============================================================================

import { Resend } from "resend"

import { APP_NAME, APP_URL } from "@/lib/constants"
import { prisma } from "@/lib/db"

// ─── Client singleton ─────────────────────────────────────────────────────────

let resendClient: Resend | null = null

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey || apiKey === "re_REPLACE_ME") {
      throw new Error("RESEND_API_KEY is not configured")
    }
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  /** React Email component rendered to HTML */
  html: string
  /** Plain text fallback */
  text: string
  replyTo?: string
  tags?: Array<{ name: string; value: string }>
  /** Extra MIME headers (e.g. List-Unsubscribe on broadcasts) */
  headers?: Record<string, string>
  /** Delivery-log category — falls back to the first `category` tag, else "transactional" */
  category?: string
  /** Recipient user id, stored on the EmailLog row when known */
  userId?: string
  attachments?: Array<{ filename: string; content: Buffer }>
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

// ─── Delivery tuning ──────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3
const RETRY_BACKOFF_MS = [400, 1200]
/** Resend error names that are worth retrying — anything else is permanent. */
const TRANSIENT_ERROR_NAMES = new Set([
  "rate_limit_exceeded",
  "internal_server_error",
  "application_error",
])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Logging category — explicit value, else the first `category` tag, else generic. */
function deriveCategory(opts: SendEmailOptions): string {
  if (opts.category) {return opts.category}
  const tag = opts.tags?.find((t) => t.name === "category")
  return tag?.value ?? "transactional"
}

function toPrimaryAddress(to: string | string[]): string {
  return Array.isArray(to) ? (to[0] ?? "") : to
}

/** Best-effort delivery log — a DB hiccup must never break an email flow. */
async function logDelivery(entry: {
  to: string
  subject: string
  category: string
  status: "SENT" | "FAILED" | "THROTTLED"
  attempts: number
  messageId?: string
  error?: string
  userId?: string
}): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        to: entry.to,
        subject: entry.subject,
        category: entry.category,
        status: entry.status,
        messageId: entry.messageId ?? null,
        error: entry.error ?? null,
        attempts: entry.attempts,
        userId: entry.userId ?? null,
      },
    })
  } catch (err) {
    console.error(
      "[Email] Delivery log write failed:",
      err instanceof Error ? err.message : err,
    )
  }
}

// ─── Core send function ───────────────────────────────────────────────────────

/**
 * Sends one email through Resend.
 * - retries transient failures up to 3 attempts (400ms / 1200ms backoff)
 * - records every outcome in the EmailLog table (SENT / FAILED / THROTTLED)
 * - never throws — callers always receive an EmailResult
 */
export async function sendEmail(opts: SendEmailOptions): Promise<EmailResult> {
  const category = deriveCategory(opts)
  const primaryTo = toPrimaryAddress(opts.to)

  // A missing API key is a configuration problem, not a transient failure.
  let resend: Resend
  try {
    resend = getResendClient()
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error"
    console.error("[Email] Client unavailable:", message)
    await logDelivery({
      to: primaryTo,
      subject: opts.subject,
      category,
      status: "FAILED",
      attempts: 0,
      error: message,
      userId: opts.userId,
    })
    return { success: false, error: message }
  }

  const from = process.env.EMAIL_FROM ?? `${APP_NAME} <noreply@diucybercon.com>`
  const replyTo = opts.replyTo ?? process.env.EMAIL_REPLY_TO ?? "info@diucybercon.com"

  let lastError = "Unknown email error"
  let lastErrorName = ""
  let attempts = 0

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    attempts = attempt + 1
    try {
      const { data, error } = await resend.emails.send({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        replyTo,
        tags: opts.tags,
        ...(opts.headers ? { headers: opts.headers } : {}),
        ...(opts.attachments ? { attachments: opts.attachments } : {}),
      })

      if (!error) {
        await logDelivery({
          to: primaryTo,
          subject: opts.subject,
          category,
          status: "SENT",
          attempts,
          messageId: data?.id,
          userId: opts.userId,
        })
        return { success: true, messageId: data?.id }
      }

      lastError = error.message
      lastErrorName = error.name
    } catch (err) {
      // Thrown exceptions (network, DNS, socket) are treated as transient.
      lastError = err instanceof Error ? err.message : "Unknown email error"
      lastErrorName = ""
    }

    const transient =
      lastErrorName === "" || TRANSIENT_ERROR_NAMES.has(lastErrorName)
    if (!transient || attempt >= MAX_ATTEMPTS - 1) {break}

    console.warn(
      `[Email] Attempt ${attempts}/${MAX_ATTEMPTS} failed (${lastError}) — retrying`,
    )
    await sleep(RETRY_BACKOFF_MS[attempt] ?? 1200)
  }

  const status: "FAILED" | "THROTTLED" =
    lastErrorName === "rate_limit_exceeded" ? "THROTTLED" : "FAILED"
  console.error(`[Email] Send failed after ${attempts} attempt(s):`, lastError)
  await logDelivery({
    to: primaryTo,
    subject: opts.subject,
    category,
    status,
    attempts,
    error: lastError,
    userId: opts.userId,
  })
  return { success: false, error: lastError }
}

// ─── Verification email ───────────────────────────────────────────────────────

export async function sendVerificationEmail({
  to,
  name,
  token,
  userId,
}: {
  to: string
  name: string
  token: string
  userId?: string
}): Promise<EmailResult> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`

  const html = buildVerificationHtml({ name, verifyUrl })
  const text = buildVerificationText({ name, verifyUrl })

  return sendEmail({
    to,
    subject: `Verify your email — ${APP_NAME}`,
    html,
    text,
    tags: [{ name: "category", value: "email-verification" }],
    userId,
  })
}

// ─── Password reset email ─────────────────────────────────────────────────────

export async function sendPasswordResetEmail({
  to,
  name,
  token,
  userId,
}: {
  to: string
  name: string
  token: string
  userId?: string
}): Promise<EmailResult> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`

  const html = buildPasswordResetHtml({ name, resetUrl })
  const text = buildPasswordResetText({ name, resetUrl })

  return sendEmail({
    to,
    subject: `Reset your password — ${APP_NAME}`,
    html,
    text,
    tags: [{ name: "category", value: "password-reset" }],
    userId,
  })
}

// ─── Registration confirmation email ─────────────────────────────────────────

export async function sendRegistrationConfirmationEmail({
  to,
  name,
  registrationId,
  eventName,
  teamName,
  invoicePdf,
  userId,
}: {
  to: string
  name: string
  registrationId: string
  eventName: string
  teamName?: string
  invoicePdf?: Uint8Array
  userId?: string
}): Promise<EmailResult> {
  const dashboardUrl = `${APP_URL}/dashboard`

  const html = buildRegistrationConfirmationHtml({
    name,
    registrationId,
    eventName,
    teamName,
    dashboardUrl,
  })
  const text = `Hi ${name},\n\nYour registration for ${eventName} is confirmed.\nRegistration ID: ${registrationId}\n\nVisit your dashboard: ${dashboardUrl}\n\n— ${APP_NAME} Team`

  return sendEmail({
    to,
    subject: `Registration confirmed — ${eventName} | ${APP_NAME}`,
    html,
    text,
    tags: [{ name: "category", value: "registration" }],
    ...(invoicePdf
      ? {
          attachments: [{
            filename: `DIU-CyberCon-Invoice-${registrationId}.pdf`,
            content: Buffer.from(invoicePdf),
          }],
        }
      : {}),
    userId,
  })
}

export async function sendFinalRegistrationInvitationEmail({
  to,
  name,
  registrationId,
  eventName,
  registrationFee,
  bkashNumber,
  finalRegistrationUrl,
  userId,
}: {
  to: string
  name: string
  registrationId: string
  eventName: string
  registrationFee: string
  bkashNumber: string
  finalRegistrationUrl: string
  userId?: string
}): Promise<EmailResult> {
  const safeName = escapeHtml(name)
  const safeRegistrationId = escapeHtml(registrationId)
  const safeEventName = escapeHtml(eventName)
  const safePaymentNumber = escapeHtml(bkashNumber || "Contact the organizers for payment instructions")
  const safeUrl = escapeHtml(finalRegistrationUrl)
  const fee = Number(registrationFee)
  const paymentInstruction = fee > 0
    ? `Pay BDT ${fee.toFixed(2)} to bKash ${bkashNumber || "the official organizer number"}, then submit the transaction ID using your secure final-registration link.`
    : "No payment is due for this final registration. Use your secure link to complete the final-stage details."
  const html = emailShell(`
    <h1 style="${EMAIL_STYLES.h1}">Complete your final registration</h1>
    <p style="${EMAIL_STYLES.p}">Hi ${safeName},</p>
    <p style="${EMAIL_STYLES.p}">Your preliminary registration for <strong style="color:#FFFFFF;">${safeEventName}</strong> has been approved.</p>
    <p style="${EMAIL_STYLES.small}">Registration ID: <strong style="color:#FFFFFF;">${safeRegistrationId}</strong></p>
    <p style="${EMAIL_STYLES.p}">${escapeHtml(paymentInstruction)}</p>
    ${fee > 0 ? `<p style="${EMAIL_STYLES.p}">bKash number: <strong style="color:#FFFFFF;">${safePaymentNumber}</strong><br />Amount: <strong style="color:#FFFFFF;">BDT ${fee.toFixed(2)}</strong></p>` : ""}
    <div style="${EMAIL_STYLES.btnWrap}"><a href="${safeUrl}" style="${EMAIL_STYLES.btn}">Complete Final Registration &amp; Payment</a></div>
    <p style="${EMAIL_STYLES.small}">This secure link expires in 14 days and is tied to your account.</p>
  `)
  const text = `Hi ${name},\n\nYour preliminary registration for ${eventName} has been approved.\nRegistration ID: ${registrationId}\n\n${paymentInstruction}${fee > 0 ? `\nbKash number: ${bkashNumber || "Contact the organizers"}\nAmount: BDT ${fee.toFixed(2)}` : ""}\n\nComplete Final Registration & Payment: ${finalRegistrationUrl}\nThis secure link expires in 14 days and is tied to your account.\n\n— ${APP_NAME} Team`

  return sendEmail({
    to,
    subject: `Preliminary registration approved — ${eventName} | ${APP_NAME}`,
    html,
    text,
    tags: [{ name: "category", value: "registration" }],
    userId,
  })
}

export async function sendRegistrationRejectedEmail({
  to,
  name,
  registrationId,
  eventName,
  reason,
  userId,
}: {
  to: string
  name: string
  registrationId: string
  eventName: string
  reason: string
  userId?: string
}): Promise<EmailResult> {
  const safeName = escapeHtml(name)
  const safeEventName = escapeHtml(eventName)
  const safeRegistrationId = escapeHtml(registrationId)
  const safeReason = escapeHtml(reason)
  const dashboardUrl = `${APP_URL}/dashboard`
  const html = emailShell(`
    <h1 style="${EMAIL_STYLES.h1}">Registration update</h1>
    <p style="${EMAIL_STYLES.p}">Hi ${safeName},</p>
    <p style="${EMAIL_STYLES.p}">Your registration for <strong style="color:#FFFFFF;">${safeEventName}</strong> could not be approved.</p>
    <p style="${EMAIL_STYLES.p}"><strong>Reason:</strong> ${safeReason}</p>
    <p style="${EMAIL_STYLES.small}">Registration ID: ${safeRegistrationId}</p>
    <div style="${EMAIL_STYLES.btnWrap}"><a href="${dashboardUrl}" style="${EMAIL_STYLES.btn}">View Dashboard</a></div>
  `)
  const text = `Hi ${name},\n\nYour registration for ${eventName} could not be approved.\nReason: ${reason}\nRegistration ID: ${registrationId}\n\nVisit your dashboard: ${dashboardUrl}\n\n— ${APP_NAME} Team`

  return sendEmail({
    to,
    subject: `Registration update — ${eventName} | ${APP_NAME}`,
    html,
    text,
    tags: [{ name: "category", value: "registration" }],
    userId,
  })
}

export async function sendPaymentRejectedEmail({
  to,
  name,
  eventName,
  reason,
  userId,
}: {
  to: string
  name: string
  eventName: string
  reason: string
  userId?: string
}): Promise<EmailResult> {
  const dashboardUrl = `${APP_URL}/dashboard/events`
  const html = emailShell(`
    <h1 style="${EMAIL_STYLES.h1}">Payment needs attention</h1>
    <p style="${EMAIL_STYLES.p}">Hi ${escapeHtml(name)},</p>
    <p style="${EMAIL_STYLES.p}">Your bKash payment for <strong style="color:#FFFFFF;">${escapeHtml(eventName)}</strong> could not be verified.</p>
    <p style="${EMAIL_STYLES.p}"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
    <p style="${EMAIL_STYLES.p}">You can submit a new transaction ID from your dashboard.</p>
    <div style="${EMAIL_STYLES.btnWrap}"><a href="${dashboardUrl}" style="${EMAIL_STYLES.btn}">Review Payment</a></div>
  `)
  const text = `Hi ${name},\n\nYour bKash payment for ${eventName} could not be verified.\nReason: ${reason}\n\nSubmit a new transaction ID from your dashboard: ${dashboardUrl}\n\n— ${APP_NAME} Team`

  return sendEmail({
    to,
    subject: `Payment needs attention — ${eventName} | ${APP_NAME}`,
    html,
    text,
    tags: [{ name: "category", value: "payment" }],
    userId,
  })
}

// ─── Workshop confirmation email ──────────────────────────────────────────────

export async function sendWorkshopConfirmationEmail({
  to,
  name,
  workshopTitle,
  dateLabel,
  startTime,
  endTime,
  venue,
  userId,
}: {
  to: string
  name: string
  workshopTitle: string
  dateLabel: string
  startTime: string
  endTime: string
  venue: string
  userId?: string
}): Promise<EmailResult> {
  const dashboardUrl = `${APP_URL}/dashboard/workshops`

  const html = buildWorkshopConfirmationHtml({
    name,
    workshopTitle,
    dateLabel,
    startTime,
    endTime,
    venue,
    dashboardUrl,
  })
  const text = `Hi ${name},\n\nYou are registered for the workshop "${workshopTitle}".\n\nDate: ${dateLabel}\nTime: ${startTime} – ${endTime}\nVenue: ${venue}\n\nView your workshops: ${dashboardUrl}\n\n— ${APP_NAME} Team`

  return sendEmail({
    to,
    subject: `Workshop registration confirmed — ${workshopTitle} | ${APP_NAME}`,
    html,
    text,
    tags: [{ name: "category", value: "workshop-registration" }],
    userId,
  })
}

// ─── Verification status email ────────────────────────────────────────────────

export async function sendVerificationStatusEmail({
  to,
  name,
  status,
  note,
  userId,
}: {
  to: string
  name: string
  status: "VERIFIED" | "REJECTED" | "REVISION_REQUIRED"
  note?: string
  userId?: string
}): Promise<EmailResult> {
  const dashboardUrl = `${APP_URL}/dashboard/documents`

  const subjects: Record<typeof status, string> = {
    VERIFIED:          `Identity verified — ${APP_NAME}`,
    REJECTED:          `Verification unsuccessful — ${APP_NAME}`,
    REVISION_REQUIRED: `Action required: Re-upload your student ID — ${APP_NAME}`,
  }

  const html = buildVerificationStatusHtml({ name, status, note, dashboardUrl })
  const text = `Hi ${name},\n\nYour student ID verification status: ${status}.\n${note ? `Note: ${note}\n` : ""}Visit your dashboard: ${dashboardUrl}\n\n— ${APP_NAME} Team`

  return sendEmail({
    to,
    subject: subjects[status],
    html,
    text,
    tags: [{ name: "category", value: "verification-status" }],
    userId,
  })
}

// ─── Submission emails (Project Showcase / Poster Presentation) ───────────────

export type SubmissionKind = "project" | "poster"

const SUBMISSION_LABELS: Record<SubmissionKind, { noun: string; moduleTitle: string }> = {
  project: { noun: "project", moduleTitle: "Project Showcase" },
  poster:  { noun: "poster",  moduleTitle: "Poster Presentation" },
}

export async function sendSubmissionReceivedEmail({
  to,
  name,
  kind,
  submissionName,
  userId,
}: {
  to: string
  name: string
  kind: SubmissionKind
  submissionName: string
  userId?: string
}): Promise<EmailResult> {
  const { noun, moduleTitle } = SUBMISSION_LABELS[kind]
  const dashboardUrl = `${APP_URL}/dashboard/submissions`

  const html = buildSubmissionReceivedHtml({ name, noun, moduleTitle, submissionName, dashboardUrl })
  const text = `Hi ${name},\n\nWe received your ${moduleTitle} ${noun} submission "${submissionName}".\n\nOur review team will evaluate it and you will get an email as soon as a decision is made.\n\nTrack it from your dashboard: ${dashboardUrl}\n\n— ${APP_NAME} Team`

  return sendEmail({
    to,
    subject: `We received your ${noun} submission — ${APP_NAME}`,
    html,
    text,
    tags: [{ name: "category", value: "submission" }],
    userId,
  })
}

export type SubmissionReviewStatus =
  | "APPROVED"
  | "REJECTED"
  | "REVISION_REQUIRED"
  | "PUBLISHED"

export async function sendSubmissionStatusEmail({
  to,
  name,
  kind,
  submissionName,
  status,
  reviewNote,
  userId,
}: {
  to: string
  name: string
  kind: SubmissionKind
  submissionName: string
  status: SubmissionReviewStatus
  reviewNote?: string
  userId?: string
}): Promise<EmailResult> {
  const { noun } = SUBMISSION_LABELS[kind]
  const dashboardUrl = `${APP_URL}/dashboard/submissions`

  const subjects: Record<SubmissionReviewStatus, string> = {
    APPROVED:          `Your ${noun} submission was approved — ${APP_NAME}`,
    REJECTED:          `Update on your ${noun} submission — ${APP_NAME}`,
    REVISION_REQUIRED: `Action required: revise your ${noun} submission — ${APP_NAME}`,
    PUBLISHED:         `Your ${noun} submission is now live — ${APP_NAME}`,
  }

  const html = buildSubmissionStatusHtml({ name, noun, submissionName, status, reviewNote, dashboardUrl })
  const text = `Hi ${name},\n\nUpdate on your ${noun} submission "${submissionName}": ${status}.\n${reviewNote ? `Reviewer note: ${reviewNote}\n` : ""}\nView your submissions: ${dashboardUrl}\n\n— ${APP_NAME} Team`

  return sendEmail({
    to,
    subject: subjects[status],
    html,
    text,
    tags: [{ name: "category", value: "submission" }],
    userId,
  })
}

// ─── Sponsor emails ───────────────────────────────────────────────────────────

export type SponsorTier =
  | "TITLE"
  | "PLATINUM"
  | "GOLD"
  | "CUSTOM"
  | "PARTNER"
  | "MEDIA_PARTNER"
  | "TECHNICAL_PARTNER"
  | "OTHER_PARTNER"

const SPONSOR_TIER_LABELS: Record<SponsorTier, string> = {
  TITLE:             "Title Sponsor",
  PLATINUM:          "Platinum Sponsor",
  GOLD:              "Gold Sponsor",
  CUSTOM:            "Custom Package",
  PARTNER:           "Partner",
  MEDIA_PARTNER:     "Media Partner",
  TECHNICAL_PARTNER: "Technical Partner",
  OTHER_PARTNER:     "Partner",
}

export async function sendSponsorApplicationEmail({
  to,
  name,
  orgName,
  tier,
  userId,
}: {
  to: string
  name: string
  orgName: string
  tier: SponsorTier
  userId?: string
}): Promise<EmailResult> {
  const tierLabel = SPONSOR_TIER_LABELS[tier]
  const sponsorsUrl = `${APP_URL}/sponsors`

  const html = buildSponsorApplicationHtml({ name, orgName, tierLabel, sponsorsUrl })
  const text = `Hi ${name},\n\nThank you for your interest in sponsoring DIU_CYBERCON 2026.\n\nWe received the application from ${orgName} for the ${tierLabel} tier. Our sponsorship team will review it and contact you shortly.\n\nSponsorship details: ${sponsorsUrl}\n\n— ${APP_NAME} Team`

  return sendEmail({
    to,
    subject: `Sponsorship application received — ${APP_NAME}`,
    html,
    text,
    tags: [{ name: "category", value: "sponsor" }],
    userId,
  })
}

export type SponsorAppStatus =
  | "SUBMITTED"
  | "CONTACTED"
  | "NEGOTIATION"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"

export async function sendSponsorStatusEmail({
  to,
  name,
  orgName,
  status,
  userId,
}: {
  to: string
  name: string
  orgName: string
  status: SponsorAppStatus
  userId?: string
}): Promise<EmailResult> {
  const sponsorsUrl = `${APP_URL}/sponsors`

  const html = buildSponsorStatusHtml({ name, orgName, status, sponsorsUrl })
  const text = `Hi ${name},\n\nUpdate on the sponsorship application from ${orgName}: ${status}.\n\nVisit ${sponsorsUrl} to learn more about DIU_CYBERCON 2026.\n\n— ${APP_NAME} Team`

  return sendEmail({
    to,
    subject: `Sponsorship application update — ${APP_NAME}`,
    html,
    text,
    tags: [{ name: "category", value: "sponsor" }],
    userId,
  })
}

// ─── Announcement broadcast email ─────────────────────────────────────────────

/**
 * Dedupe-safe subject for a broadcast. The broadcast runner matches EmailLog
 * rows on this exact string, so re-running a partial broadcast never
 * double-sends to a participant who already received it.
 */
export function broadcastSubject(title: string): string {
  return `${title} — ${APP_NAME}`
}

export async function sendBroadcastEmail({
  to,
  name,
  title,
  content,
  unsubscribeUrl,
  userId,
}: {
  to: string
  name: string
  title: string
  content: string
  unsubscribeUrl: string
  userId?: string
}): Promise<EmailResult> {
  const html = buildBroadcastHtml({ name, title, content, unsubscribeUrl })
  const text = `Hi ${name},\n\n${title}\n\n${content}\n\nView all announcements: ${APP_URL}/announcements\n\n— ${APP_NAME} Team\n\nYou are receiving this email because you registered for DIU_CYBERCON 2026.\nUnsubscribe from announcement emails: ${unsubscribeUrl}`

  return sendEmail({
    to,
    subject: broadcastSubject(title),
    html,
    text,
    tags: [{ name: "category", value: "broadcast" }],
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    userId,
  })
}

// =============================================================================
// HTML email builders (inline styles for email client compatibility)
// =============================================================================

const EMAIL_STYLES = {
  body:    "margin:0;padding:0;background-color:#0A0A0A;font-family:'Inter',Arial,sans-serif;",
  wrapper: "max-width:600px;margin:0 auto;padding:40px 20px;",
  header:  "text-align:center;padding-bottom:32px;border-bottom:1px solid #262626;margin-bottom:32px;",
  logo:    "font-family:'Courier New',monospace;font-size:20px;font-weight:700;color:#E11D48;letter-spacing:0.1em;",
  tagline: "font-size:11px;color:#A3A3A3;letter-spacing:0.15em;text-transform:uppercase;margin-top:4px;",
  h1:      "font-size:24px;font-weight:700;color:#FFFFFF;margin:0 0 12px;line-height:1.2;",
  p:       "font-size:15px;color:#A3A3A3;line-height:1.6;margin:0 0 16px;",
  btnWrap: "text-align:center;margin:32px 0;",
  btn:     "display:inline-block;padding:14px 32px;background-color:#E11D48;color:#0A0A0A;font-size:13px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.08em;text-transform:uppercase;font-family:'Courier New',monospace;",
  divider: "border:none;border-top:1px solid #262626;margin:32px 0;",
  small:   "font-size:12px;color:#737373;line-height:1.5;",
  code:    "display:inline-block;padding:12px 20px;background:#121212;border:1px solid #262626;border-radius:8px;font-family:'Courier New',monospace;font-size:18px;font-weight:700;color:#E11D48;letter-spacing:0.15em;margin:8px 0;",
  footer:  "text-align:center;padding-top:32px;border-top:1px solid #262626;margin-top:32px;",
}

function emailShell(content: string, footerExtraHtml = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${APP_NAME}</title>
</head>
<body style="${EMAIL_STYLES.body}">
<div style="${EMAIL_STYLES.wrapper}">
  <div style="${EMAIL_STYLES.header}">
    <div style="${EMAIL_STYLES.logo}">DIU_CYBERCON 2026</div>
    <div style="${EMAIL_STYLES.tagline}">LEARN · SECURE · DEFEND</div>
  </div>
  ${content}
  <div style="${EMAIL_STYLES.footer}">
    <p style="${EMAIL_STYLES.small}">
      Cyber Security Club, Department of CSE<br>
      Daffodil International University, Bangladesh<br>
      <a href="${APP_URL}" style="color:#E11D48;text-decoration:none;">${APP_URL}</a>
    </p>
    ${footerExtraHtml}
    <p style="${EMAIL_STYLES.small}">
      If you didn't request this email, you can safely ignore it.
    </p>
  </div>
</div>
</body>
</html>`
}

function buildVerificationHtml({ name, verifyUrl }: { name: string; verifyUrl: string }): string {
  return emailShell(`
    <h1 style="${EMAIL_STYLES.h1}">Verify your email address</h1>
    <p style="${EMAIL_STYLES.p}">Hi ${escapeHtml(name)},</p>
    <p style="${EMAIL_STYLES.p}">
      Welcome to DIU_CYBERCON 2026! Click the button below to verify your email address
      and activate your account.
    </p>
    <div style="${EMAIL_STYLES.btnWrap}">
      <a href="${verifyUrl}" style="${EMAIL_STYLES.btn}">Verify Email</a>
    </div>
    <p style="${EMAIL_STYLES.small}">
      Or copy this link into your browser:<br>
      <a href="${verifyUrl}" style="color:#E11D48;word-break:break-all;">${verifyUrl}</a>
    </p>
    <hr style="${EMAIL_STYLES.divider}">
    <p style="${EMAIL_STYLES.small}">
      This link expires in 24 hours. If you did not create an account, no action is required.
    </p>
  `)
}

function buildVerificationText({ name, verifyUrl }: { name: string; verifyUrl: string }): string {
  return `Hi ${name},\n\nWelcome to DIU_CYBERCON 2026!\n\nVerify your email address by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.\n\nIf you did not create an account, you can ignore this email.\n\n— ${APP_NAME} Team`
}

function buildPasswordResetHtml({ name, resetUrl }: { name: string; resetUrl: string }): string {
  return emailShell(`
    <h1 style="${EMAIL_STYLES.h1}">Reset your password</h1>
    <p style="${EMAIL_STYLES.p}">Hi ${escapeHtml(name)},</p>
    <p style="${EMAIL_STYLES.p}">
      We received a request to reset the password for your DIU_CYBERCON 2026 account.
      Click the button below to set a new password.
    </p>
    <div style="${EMAIL_STYLES.btnWrap}">
      <a href="${resetUrl}" style="${EMAIL_STYLES.btn}">Reset Password</a>
    </div>
    <p style="${EMAIL_STYLES.small}">
      Or copy this link:<br>
      <a href="${resetUrl}" style="color:#E11D48;word-break:break-all;">${resetUrl}</a>
    </p>
    <hr style="${EMAIL_STYLES.divider}">
    <p style="${EMAIL_STYLES.small}">
      This link expires in 1 hour. If you did not request a password reset, please ignore this email.
      Your password will not change.
    </p>
  `)
}

function buildPasswordResetText({ name, resetUrl }: { name: string; resetUrl: string }): string {
  return `Hi ${name},\n\nReset your DIU_CYBERCON 2026 password:\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you did not request this, ignore this email.\n\n— ${APP_NAME} Team`
}

function buildRegistrationConfirmationHtml({
  name, registrationId, eventName, teamName, dashboardUrl,
}: {
  name: string
  registrationId: string
  eventName: string
  teamName?: string
  dashboardUrl: string
}): string {
  return emailShell(`
    <h1 style="${EMAIL_STYLES.h1}">Registration Confirmed!</h1>
    <p style="${EMAIL_STYLES.p}">Hi ${escapeHtml(name)},</p>
    <p style="${EMAIL_STYLES.p}">
      Your registration for <strong style="color:#FFFFFF;">${escapeHtml(eventName)}</strong> is confirmed.
      ${teamName ? `You are part of team <strong style="color:#FFFFFF;">${escapeHtml(teamName)}</strong>.` : ""}
    </p>
    <div style="text-align:center;margin:24px 0;">
      <p style="font-size:12px;color:#A3A3A3;margin:0 0 8px;font-family:'Courier New',monospace;letter-spacing:0.1em;text-transform:uppercase;">Your Registration ID</p>
      <div style="${EMAIL_STYLES.code}">${escapeHtml(registrationId)}</div>
    </div>
    <p style="${EMAIL_STYLES.p}">
      Keep this ID safe — you will need it for check-in on event day. Your QR code is available in your dashboard.
    </p>
    <div style="${EMAIL_STYLES.btnWrap}">
      <a href="${dashboardUrl}" style="${EMAIL_STYLES.btn}">View Dashboard</a>
    </div>
    <hr style="${EMAIL_STYLES.divider}">
    <p style="${EMAIL_STYLES.small}">
      Event dates: 24 Oct 2026 (Online) · 14–15 Nov 2026 (Daffodil Smart City, Savar, Dhaka)
    </p>
  `)
}

function buildWorkshopConfirmationHtml({
  name, workshopTitle, dateLabel, startTime, endTime, venue, dashboardUrl,
}: {
  name: string
  workshopTitle: string
  dateLabel: string
  startTime: string
  endTime: string
  venue: string
  dashboardUrl: string
}): string {
  return emailShell(`
    <h1 style="${EMAIL_STYLES.h1}">Workshop Registration Confirmed</h1>
    <p style="${EMAIL_STYLES.p}">Hi ${escapeHtml(name)},</p>
    <p style="${EMAIL_STYLES.p}">
      Your seat for the hands-on workshop
      <strong style="color:#FFFFFF;">${escapeHtml(workshopTitle)}</strong>
      is confirmed.
    </p>
    <div style="padding:16px 20px;background:#121212;border:1px solid #262626;border-radius:8px;margin:20px 0;">
      <p style="margin:0 0 8px;font-size:13px;color:#A3A3A3;"><strong style="color:#FFFFFF;">Date:</strong> ${escapeHtml(dateLabel)}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#A3A3A3;"><strong style="color:#FFFFFF;">Time:</strong> ${escapeHtml(startTime)} – ${escapeHtml(endTime)}</p>
      <p style="margin:0;font-size:13px;color:#A3A3A3;"><strong style="color:#FFFFFF;">Venue:</strong> ${escapeHtml(venue)}</p>
    </div>
    <p style="${EMAIL_STYLES.p}">
      Please bring your student ID for on-site verification. Seats are limited —
      if you can no longer attend, cancel from your dashboard so someone else can take your seat.
    </p>
    <div style="${EMAIL_STYLES.btnWrap}">
      <a href="${dashboardUrl}" style="${EMAIL_STYLES.btn}">View My Workshops</a>
    </div>
  `)
}

function buildVerificationStatusHtml({
  name, status, note, dashboardUrl,
}: {
  name: string
  status: "VERIFIED" | "REJECTED" | "REVISION_REQUIRED"
  note?: string
  dashboardUrl: string
}): string {
  const configs = {
    VERIFIED: {
      color: "#FB7185",
      icon: "✓",
      title: "Identity Verified",
      message: "Your student ID has been verified. You are all set for DIU_CYBERCON 2026!",
    },
    REJECTED: {
      color: "#E11D48",
      icon: "✗",
      title: "Verification Unsuccessful",
      message: "Unfortunately we could not verify your student ID. Please contact support if you believe this is an error.",
    },
    REVISION_REQUIRED: {
      color: "#BE123C",
      icon: "!",
      title: "Action Required",
      message: "Your student ID upload requires revision. Please re-upload a clear, valid student ID from your dashboard.",
    },
  }

  const cfg = configs[status]

  return emailShell(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:${cfg.color}20;border:2px solid ${cfg.color};font-size:24px;color:${cfg.color};">${cfg.icon}</div>
    </div>
    <h1 style="${EMAIL_STYLES.h1}">${cfg.title}</h1>
    <p style="${EMAIL_STYLES.p}">Hi ${escapeHtml(name)},</p>
    <p style="${EMAIL_STYLES.p}">${cfg.message}</p>
    ${note ? `<div style="padding:12px 16px;background:#121212;border-left:3px solid ${cfg.color};border-radius:4px;margin:16px 0;"><p style="margin:0;font-size:13px;color:#A3A3A3;">${escapeHtml(note)}</p></div>` : ""}
    <div style="${EMAIL_STYLES.btnWrap}">
      <a href="${dashboardUrl}" style="${EMAIL_STYLES.btn}">Go to Dashboard</a>
    </div>
  `)
}

function buildSubmissionReceivedHtml({
  name, noun, moduleTitle, submissionName, dashboardUrl,
}: {
  name: string
  noun: string
  moduleTitle: string
  submissionName: string
  dashboardUrl: string
}): string {
  return emailShell(`
    <h1 style="${EMAIL_STYLES.h1}">Submission Received</h1>
    <p style="${EMAIL_STYLES.p}">Hi ${escapeHtml(name)},</p>
    <p style="${EMAIL_STYLES.p}">
      We received your <strong style="color:#FFFFFF;">${escapeHtml(moduleTitle)}</strong>
      ${escapeHtml(noun)} submission:
    </p>
    <div style="text-align:center;margin:24px 0;">
      <div style="${EMAIL_STYLES.code};font-size:14px;">${escapeHtml(submissionName)}</div>
    </div>
    <p style="${EMAIL_STYLES.p}">
      Our review team will evaluate it and you will get an email as soon as a
      decision is made. You can track the status anytime from your dashboard.
    </p>
    <div style="${EMAIL_STYLES.btnWrap}">
      <a href="${dashboardUrl}" style="${EMAIL_STYLES.btn}">View My Submissions</a>
    </div>
  `)
}

function buildSubmissionStatusHtml({
  name, noun, submissionName, status, reviewNote, dashboardUrl,
}: {
  name: string
  noun: string
  submissionName: string
  status: "APPROVED" | "REJECTED" | "REVISION_REQUIRED" | "PUBLISHED"
  reviewNote?: string
  dashboardUrl: string
}): string {
  const configs = {
    APPROVED: {
      color: "#FB7185",
      icon: "✓",
      title: "Submission Approved",
      message: `Great news — your ${noun} submission "${escapeHtml(submissionName)}" has been approved. We will reach out with next steps as the event approaches.`,
    },
    REJECTED: {
      color: "#E11D48",
      icon: "✗",
      title: "Submission Decision",
      message: `After reviewing your ${noun} submission "${escapeHtml(submissionName)}", the team is unable to accept it this time. Thank you for taking part — you are welcome to join our other modules.`,
    },
    REVISION_REQUIRED: {
      color: "#BE123C",
      icon: "!",
      title: "Revision Required",
      message: `Your ${noun} submission "${escapeHtml(submissionName)}" needs a few changes before it can be approved. Please review the note below, update your submission and resubmit it from your dashboard.`,
    },
    PUBLISHED: {
      color: "#E11D48",
      icon: "★",
      title: "Submission Published",
      message: `Your ${noun} submission "${escapeHtml(submissionName)}" is now published on the DIU_CYBERCON 2026 website. Congratulations!`,
    },
  }

  const cfg = configs[status]

  return emailShell(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:${cfg.color}20;border:2px solid ${cfg.color};font-size:24px;color:${cfg.color};">${cfg.icon}</div>
    </div>
    <h1 style="${EMAIL_STYLES.h1}">${cfg.title}</h1>
    <p style="${EMAIL_STYLES.p}">Hi ${escapeHtml(name)},</p>
    <p style="${EMAIL_STYLES.p}">${cfg.message}</p>
    ${reviewNote ? `<div style="padding:12px 16px;background:#121212;border-left:3px solid ${cfg.color};border-radius:4px;margin:16px 0;"><p style="margin:0;font-size:13px;color:#A3A3A3;">${escapeHtml(reviewNote)}</p></div>` : ""}
    <div style="${EMAIL_STYLES.btnWrap}">
      <a href="${dashboardUrl}" style="${EMAIL_STYLES.btn}">View My Submissions</a>
    </div>
  `)
}

function buildSponsorApplicationHtml({
  name, orgName, tierLabel, sponsorsUrl,
}: {
  name: string
  orgName: string
  tierLabel: string
  sponsorsUrl: string
}): string {
  return emailShell(`
    <h1 style="${EMAIL_STYLES.h1}">Application Received</h1>
    <p style="${EMAIL_STYLES.p}">Hi ${escapeHtml(name)},</p>
    <p style="${EMAIL_STYLES.p}">
      Thank you for your interest in sponsoring DIU_CYBERCON 2026.
      We received the application from <strong style="color:#FFFFFF;">${escapeHtml(orgName)}</strong>
      for the <strong style="color:#FFFFFF;">${escapeHtml(tierLabel)}</strong> tier.
    </p>
    <p style="${EMAIL_STYLES.p}">
      Our sponsorship team will review it and contact you shortly to discuss the next steps.
    </p>
    <div style="${EMAIL_STYLES.btnWrap}">
      <a href="${sponsorsUrl}" style="${EMAIL_STYLES.btn}">Sponsorship Details</a>
    </div>
  `)
}

function buildSponsorStatusHtml({
  name, orgName, status, sponsorsUrl,
}: {
  name: string
  orgName: string
  status: "SUBMITTED" | "CONTACTED" | "NEGOTIATION" | "APPROVED" | "REJECTED" | "COMPLETED"
  sponsorsUrl: string
}): string {
  const configs = {
    SUBMITTED: {
      color: "#A3A3A3",
      icon: "•",
      title: "Application Received",
      message: `The sponsorship application from ${escapeHtml(orgName)} has been received and is queued for review.`,
    },
    CONTACTED: {
      color: "#E11D48",
      icon: "→",
      title: "We Will Be In Touch",
      message: `Our sponsorship team has started working on the application from ${escapeHtml(orgName)} and will reach out to you to discuss next steps.`,
    },
    NEGOTIATION: {
      color: "#F43F5E",
      icon: "↔",
      title: "Finalising the Details",
      message: `We are currently finalising the partnership details for ${escapeHtml(orgName)}. Our team will follow up with the agreed package and next steps.`,
    },
    APPROVED: {
      color: "#FB7185",
      icon: "✓",
      title: "Sponsorship Approved",
      message: `Great news — the sponsorship application from ${escapeHtml(orgName)} has been approved. Thank you for supporting DIU_CYBERCON 2026! Our team will contact you to complete the formalities.`,
    },
    REJECTED: {
      color: "#E11D48",
      icon: "✗",
      title: "Application Update",
      message: `After careful review, we are unable to proceed with the sponsorship application from ${escapeHtml(orgName)} at this time. We appreciate your interest and hope to work together in future editions.`,
    },
    COMPLETED: {
      color: "#BE123C",
      icon: "★",
      title: "Sponsorship Confirmed",
      message: `The sponsorship package for ${escapeHtml(orgName)} is confirmed and complete. Thank you for powering DIU_CYBERCON 2026!`,
    },
  }

  const cfg = configs[status]

  return emailShell(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:${cfg.color}20;border:2px solid ${cfg.color};font-size:24px;color:${cfg.color};">${cfg.icon}</div>
    </div>
    <h1 style="${EMAIL_STYLES.h1}">${cfg.title}</h1>
    <p style="${EMAIL_STYLES.p}">Hi ${escapeHtml(name)},</p>
    <p style="${EMAIL_STYLES.p}">${cfg.message}</p>
    <div style="${EMAIL_STYLES.btnWrap}">
      <a href="${sponsorsUrl}" style="${EMAIL_STYLES.btn}">Sponsorship Details</a>
    </div>
  `)
}

function buildBroadcastHtml({
  name, title, content, unsubscribeUrl,
}: {
  name: string
  title: string
  content: string
  unsubscribeUrl: string
}): string {
  const bodyHtml = escapeHtml(content).replace(/\n/g, "<br>")

  return emailShell(
    `
    <h1 style="${EMAIL_STYLES.h1}">${escapeHtml(title)}</h1>
    <p style="${EMAIL_STYLES.p}">Hi ${escapeHtml(name)},</p>
    <div style="font-size:15px;color:#D4D4D4;line-height:1.7;margin:0 0 16px;">${bodyHtml}</div>
    <div style="${EMAIL_STYLES.btnWrap}">
      <a href="${APP_URL}/announcements" style="${EMAIL_STYLES.btn}">View Announcements</a>
    </div>
  `,
    `
    <p style="${EMAIL_STYLES.small}">
      You are receiving this email because you registered for DIU_CYBERCON 2026.<br>
      <a href="${unsubscribeUrl}" style="color:#A3A3A3;text-decoration:underline;">Unsubscribe from announcement emails</a>
    </p>
  `,
  )
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
