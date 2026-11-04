"use client"

// =============================================================================
// Admin — Participant detail (/admin/participants/[id])
// Editable profile, full registration history (event + workshop), latest
// student-ID verification status, and the account access panel
// (suspend with a required reason / reinstate).
//
// Capabilities come from the GET response (server-computed) so the UI only
// offers actions the caller may perform — the server re-checks every write.
// =============================================================================

import {
  ArrowLeft,
  Ban,
  Building2,
  CalendarDays,
  Clock,
  ExternalLink,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Undo2,
  User,
  Users,
} from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import * as React from "react"
import toast from "react-hot-toast"

import {
  adminFetch,
  adminMutate,
  AdminApiError,
  StatusPill,
  toastApiError,
} from "@/components/admin"
import { ConfirmModal } from "@/components/ui"
import { cn, formatDate, relativeTime } from "@/lib/utils"

// ─── Types (mirror GET /api/admin/participants/[id]) ─────────────────────────

type ParticipantDetail = {
  id: string
  name: string | null
  email: string
  role: string
  isSuspended: boolean
  emailVerified: string | null
  createdAt: string
  updatedAt: string
  profile: {
    fullName: string
    studentId: string
    department: string
    phone: string
    tshirtSize: string
    createdAt: string
    updatedAt: string
    university: { id: string; name: string; shortName: string | null }
  } | null
  eventRegistrations: {
    id: string
    registrationId: string
    status: string
    checkInStatus: string
    checkInTime: string | null
    checkOutTime: string | null
    createdAt: string
    event: { id: string; name: string; type: string }
    team: { id: string; name: string } | null
  }[]
  workshopRegistrations: {
    id: string
    createdAt: string
    workshop: {
      id: string
      title: string
      date: string
      startTime: string
      endTime: string
      venue: string
    }
  }[]
  studentVerifications: {
    id: string
    status: string
    reviewNote: string | null
    createdAt: string
    reviewedAt: string | null
  }[]
}

type Permissions = {
  canEdit: boolean
  canSuspend: boolean
  canViewVerification: boolean
}

type DetailPayload = { user: ParticipantDetail; permissions: Permissions }

const EVENT_TYPE_LABELS: Record<string, string> = {
  CTF: "CTF",
  TRACE_ROUTE: "Trace & Route",
  PROJECT_SHOWCASE: "Project Showcase",
  POSTER_PRESENTATION: "Poster Presentation",
  PANEL_DISCUSSION: "Panel Discussion",
  HANDS_ON: "Hands-on Activities",
}

const TSHIRT_SIZES = ["M", "L", "XL", "XXL", "XXXL"] as const

const PHONE_PATTERN = /^(?:\+88|88)?01[3-9]\d{8}$/

// ─── Local building blocks ────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  className,
  action,
}: {
  title: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-bg-panel p-5", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-micro uppercase tracking-wider text-text-muted">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-faint" />
      <div className="min-w-0">
        <p className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
          {label}
        </p>
        <p className="mt-0.5 break-words text-sm text-text-primary">{value}</p>
      </div>
    </div>
  )
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block font-mono text-xs uppercase tracking-widest text-text-muted"
      >
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-pink">{error}</p>}
    </div>
  )
}

const inputBase =
  "h-9 w-full rounded-md border bg-bg-elevated px-3 text-sm text-text-primary placeholder:text-text-faint transition-colors focus:outline-none focus:ring-0"

function inputClass(hasError: boolean): string {
  return cn(inputBase, hasError ? "border-pink/60 focus:border-pink" : "border-border focus:border-cyan")
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = React.use(params)

  const [data, setData] = React.useState<DetailPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  // ── Profile edit state ─────────────────────────────────────────────────────
  const [form, setForm] = React.useState({
    fullName: "",
    studentId: "",
    department: "",
    phone: "",
    tshirtSize: "",
  })
  const [baseline, setBaseline] = React.useState<typeof form | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)

  // ── Access (suspend / reinstate) state ─────────────────────────────────────
  const [reason, setReason] = React.useState("")
  const [pendingAccess, setPendingAccess] = React.useState<"suspend" | "reinstate" | null>(null)
  const [accessBusy, setAccessBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const payload = await adminFetch<DetailPayload>(`/api/admin/participants/${id}`)
      setData(payload)
      if (payload.user.profile) {
        const next = {
          fullName: payload.user.profile.fullName,
          studentId: payload.user.profile.studentId,
          department: payload.user.profile.department,
          phone: payload.user.profile.phone,
          tshirtSize: payload.user.profile.tshirtSize,
        }
        setForm(next)
        setBaseline(next)
      }
      setFieldErrors({})
      setLoadError(null)
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load this participant.",
      )
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    void load()
  }, [load])

  const dirty =
    baseline !== null &&
    (form.fullName !== baseline.fullName ||
      form.studentId !== baseline.studentId ||
      form.department !== baseline.department ||
      form.phone !== baseline.phone ||
      form.tshirtSize !== baseline.tshirtSize)

  // ── Save profile ───────────────────────────────────────────────────────────
  const handleSave = React.useCallback(async () => {
    // Light client-side pre-check (mirrors the server schema) for fast feedback.
    const errors: Record<string, string> = {}
    if (form.fullName.trim().length < 2) {errors.fullName = "Enter the full name."}
    if (form.studentId.trim().length < 3) {errors.studentId = "Enter the student ID."}
    if (form.department.trim().length < 2) {errors.department = "Enter the department."}
    if (!PHONE_PATTERN.test(form.phone.trim())) {
      errors.phone = "Enter a valid Bangladeshi mobile number, e.g. 01712345678."
    }
    if (!TSHIRT_SIZES.includes(form.tshirtSize as (typeof TSHIRT_SIZES)[number])) {
      errors.tshirtSize = "Select a T-shirt size."
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      toast.error("Please fix the highlighted fields.")
      return
    }

    setSaving(true)
    setFieldErrors({})
    try {
      await adminMutate(
        `/api/admin/participants/${id}`,
        "PATCH",
        {
          fullName: form.fullName.trim(),
          studentId: form.studentId.trim(),
          department: form.department.trim(),
          phone: form.phone.trim(),
          tshirtSize: form.tshirtSize,
        },
        { successMessage: "Profile updated." },
      )
      await load()
    } catch (err) {
      if (err instanceof AdminApiError && err.details) {
        const mapped: Record<string, string> = {}
        for (const [key, messages] of Object.entries(err.details)) {
          if (messages?.[0]) {mapped[key] = messages[0]}
        }
        setFieldErrors(mapped)
      }
      toastApiError(err, "Could not save the profile.")
    } finally {
      setSaving(false)
    }
  }, [form, id, load])

  const handleReset = React.useCallback(() => {
    if (baseline) {setForm(baseline)}
    setFieldErrors({})
  }, [baseline])

  // ── Access actions ─────────────────────────────────────────────────────────
  const requestSuspend = React.useCallback(() => {
    if (reason.trim().length === 0) {
      toast.error("A reason is required to suspend an account — it is recorded in the audit log.")
      return
    }
    setPendingAccess("suspend")
  }, [reason])

  const confirmAccess = React.useCallback(async () => {
    if (!pendingAccess) {return}
    setAccessBusy(true)
    try {
      const suspend = pendingAccess === "suspend"
      await adminMutate(
        `/api/admin/participants/${id}/suspend`,
        "POST",
        suspend
          ? { suspend: true, reason: reason.trim() }
          : { suspend: false },
        {
          successMessage: suspend
            ? "Account suspended. Access is revoked within a minute."
            : "Account reinstated.",
        },
      )
      setPendingAccess(null)
      setReason("")
      await load()
    } catch (err) {
      toastApiError(err, "Could not update the account.")
    } finally {
      setAccessBusy(false)
    }
  }, [pendingAccess, reason, id, load])

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-panel px-6 py-16 text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span className="text-sm">Loading participant…</span>
      </div>
    )
  }

  if (loadError && !data) {
    return (
      <div className="rounded-lg border border-pink/30 bg-pink/5 px-6 py-14 text-center">
        <ShieldAlert className="mx-auto mb-3 h-6 w-6 text-pink" aria-hidden="true" />
        <p className="text-sm font-medium text-text-primary">
          Could not load this participant
        </p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-text-muted">{loadError}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!data) {return null}

  const { user, permissions } = data
  const displayName = user.profile?.fullName ?? user.name ?? "Unnamed participant"
  const latestVerification = user.studentVerifications[0] ?? null

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <Link
          href="/admin/participants"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted transition-colors hover:text-cyan"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to participants
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
            {displayName}
          </h1>
          <StatusPill status={user.isSuspended ? "SUSPENDED" : "ACTIVE"} />
          {latestVerification && <StatusPill status={latestVerification.status} />}
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {user.email} · Joined {formatDate(user.createdAt)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column: profile + history ─────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Profile */}
          <SectionCard
            title={permissions.canEdit ? "Profile — editable" : "Profile"}
            action={
              permissions.canEdit &&
              baseline !== null && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={!dirty || saving}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-2.5 text-xs font-medium text-text-muted transition-colors hover:border-cyan/40 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={!dirty || saving}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neon/40 bg-neon/10 px-3 text-xs font-semibold text-neon transition-colors hover:bg-neon/15 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-neon"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              )
            }
          >
            {!user.profile ? (
              <div className="flex items-center gap-2.5 text-sm text-text-muted">
                <ShieldAlert className="h-4 w-4 text-amber" aria-hidden="true" />
                This account has no participant profile yet.
              </div>
            ) : permissions.canEdit ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="p-fullName" label="Full name *" error={fieldErrors.fullName}>
                  <input
                    id="p-fullName"
                    type="text"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    maxLength={100}
                    className={inputClass(!!fieldErrors.fullName)}
                  />
                </Field>

                <Field id="p-studentId" label="Student ID *" error={fieldErrors.studentId}>
                  <input
                    id="p-studentId"
                    type="text"
                    value={form.studentId}
                    onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
                    maxLength={40}
                    className={cn(inputClass(!!fieldErrors.studentId), "font-mono")}
                  />
                </Field>

                <Field id="p-department" label="Department *" error={fieldErrors.department}>
                  <input
                    id="p-department"
                    type="text"
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                    maxLength={100}
                    className={inputClass(!!fieldErrors.department)}
                  />
                </Field>

                <Field id="p-phone" label="Phone *" error={fieldErrors.phone}>
                  <input
                    id="p-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    maxLength={20}
                    placeholder="01712345678"
                    className={cn(inputClass(!!fieldErrors.phone), "font-mono")}
                  />
                </Field>

                <Field id="p-tshirt" label="T-shirt size *" error={fieldErrors.tshirtSize}>
                  <select
                    id="p-tshirt"
                    value={form.tshirtSize}
                    onChange={(e) => setForm((f) => ({ ...f, tshirtSize: e.target.value }))}
                    className={inputClass(!!fieldErrors.tshirtSize)}
                  >
                    <option value="" disabled>
                      Select a size…
                    </option>
                    {TSHIRT_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="space-y-1.5">
                  <span className="block font-mono text-xs uppercase tracking-widest text-text-muted">
                    University
                  </span>
                  <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-bg-elevated/50 px-3">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-text-faint" aria-hidden="true" />
                    <span className="truncate text-sm text-text-muted">
                      {user.profile.university.name}
                      {user.profile.university.shortName
                        ? ` (${user.profile.university.shortName})`
                        : ""}
                    </span>
                  </div>
                  <p className="text-[0.6875rem] text-text-faint">
                    University is tied to the account and cannot be edited here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                <InfoRow icon={User} label="Full name" value={user.profile.fullName} />
                <InfoRow
                  icon={GraduationCap}
                  label="Student ID"
                  value={<span className="font-mono text-sm">{user.profile.studentId}</span>}
                />
                <InfoRow icon={GraduationCap} label="Department" value={user.profile.department} />
                <InfoRow
                  icon={Phone}
                  label="Phone"
                  value={<span className="font-mono text-sm">{user.profile.phone}</span>}
                />
                <InfoRow icon={User} label="T-shirt size" value={user.profile.tshirtSize} />
                <InfoRow
                  icon={Building2}
                  label="University"
                  value={`${user.profile.university.name}${
                    user.profile.university.shortName
                      ? ` (${user.profile.university.shortName})`
                      : ""
                  }`}
                />
              </div>
            )}
          </SectionCard>

          {/* Event registrations */}
          <SectionCard title={`Event registrations (${user.eventRegistrations.length})`}>
            {user.eventRegistrations.length === 0 ? (
              <p className="text-sm text-text-muted">No event registrations yet.</p>
            ) : (
              <ul className="space-y-3">
                {user.eventRegistrations.map((registration) => (
                  <li
                    key={registration.id}
                    className="rounded-md border border-border bg-bg-elevated/50 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-primary">
                          {registration.event.name}
                          <span className="rounded-full border border-cyan/30 bg-cyan/10 px-2 py-0.5 font-mono text-[0.5625rem] font-bold uppercase tracking-wider text-cyan">
                            {EVENT_TYPE_LABELS[registration.event.type] ??
                              registration.event.type}
                          </span>
                        </p>
                        <p className="mt-1 font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                          {registration.registrationId} · registered{" "}
                          {relativeTime(registration.createdAt)}
                        </p>
                        {registration.team && (
                          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-text-muted">
                            <Users className="h-3.5 w-3.5 text-text-faint" aria-hidden="true" />
                            Team: {registration.team.name}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={registration.status} />
                        <StatusPill status={registration.checkInStatus} />
                      </div>
                    </div>
                    {(registration.checkInTime || registration.checkOutTime) && (
                      <p className="mt-2 text-[0.6875rem] text-text-faint">
                        {registration.checkInTime && (
                          <>Checked in {relativeTime(registration.checkInTime)}</>
                        )}
                        {registration.checkInTime && registration.checkOutTime && " · "}
                        {registration.checkOutTime && (
                          <>checked out {relativeTime(registration.checkOutTime)}</>
                        )}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Workshops */}
          <SectionCard title={`Workshops (${user.workshopRegistrations.length})`}>
            {user.workshopRegistrations.length === 0 ? (
              <p className="text-sm text-text-muted">No workshop registrations yet.</p>
            ) : (
              <ul className="space-y-3">
                {user.workshopRegistrations.map((registration) => (
                  <li
                    key={registration.id}
                    className="flex items-start gap-3 rounded-md border border-border bg-bg-elevated/50 px-4 py-3"
                  >
                    <CalendarDays
                      className="mt-0.5 h-4 w-4 shrink-0 text-text-faint"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">
                        {registration.workshop.title}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {formatDate(registration.workshop.date)} ·{" "}
                        {registration.workshop.startTime}–{registration.workshop.endTime}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[0.6875rem] text-text-faint">
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        {registration.workshop.venue} · registered{" "}
                        {relativeTime(registration.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* ── Right column: account + access ─────────────────────────────── */}
        <div className="space-y-6">
          {/* Account */}
          <SectionCard title="Account">
            <div className="space-y-4">
              <InfoRow icon={Mail} label="Email" value={user.email} />
              <InfoRow
                icon={Clock}
                label="Created"
                value={`${formatDate(user.createdAt)} · ${relativeTime(user.createdAt)}`}
              />
              <InfoRow
                icon={Clock}
                label="Last updated"
                value={relativeTime(user.updatedAt)}
              />
              <InfoRow
                icon={ShieldCheck}
                label="Email verified"
                value={
                  user.emailVerified ? (
                    <span className="flex items-center gap-2">
                      <span className="text-neon">Verified</span>
                      <span className="text-xs text-text-faint">
                        {relativeTime(user.emailVerified)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-amber">Not verified</span>
                  )
                }
              />
              <InfoRow
                icon={User}
                label="Account ID"
                value={
                  <span className="break-all font-mono text-xs text-text-muted">
                    {user.id}
                  </span>
                }
              />
            </div>
          </SectionCard>

          {/* Verification */}
          <SectionCard
            title="Student ID verification"
            action={
              latestVerification && permissions.canViewVerification ? (
                <Link
                  href={`/admin/verifications/${latestVerification.id}` as Route}
                  className="inline-flex items-center gap-1 text-xs font-medium text-cyan transition-colors hover:text-cyan/80"
                >
                  Review
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              ) : undefined
            }
          >
            {!latestVerification ? (
              <p className="text-sm text-text-muted">No student ID submitted yet.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={latestVerification.status} />
                  <span className="text-xs text-text-faint">
                    submitted {relativeTime(latestVerification.createdAt)}
                  </span>
                </div>
                {latestVerification.reviewedAt && (
                  <p className="text-xs text-text-muted">
                    Reviewed {relativeTime(latestVerification.reviewedAt)}
                  </p>
                )}
                {latestVerification.reviewNote && (
                  <p className="border-l-2 border-violet/40 pl-2.5 text-xs italic text-text-muted">
                    “{latestVerification.reviewNote}”
                  </p>
                )}
                <p className="text-[0.6875rem] leading-relaxed text-text-faint">
                  The document itself is only accessible through{" "}
                  <Link
                    href="/admin/verifications"
                    className="text-cyan/80 underline-offset-2 hover:underline"
                  >
                    Verifications
                  </Link>{" "}
                  via short-lived signed links.
                </p>
              </div>
            )}
          </SectionCard>

          {/* Access control */}
          <SectionCard title="Access control">
            {!permissions.canSuspend ? (
              <p className="text-xs leading-relaxed text-text-muted">
                You don't have permission to suspend or reinstate accounts.
              </p>
            ) : user.isSuspended ? (
              <div className="space-y-4">
                <div className="rounded-md border border-pink/30 bg-pink/5 px-3.5 py-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-pink">
                    <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                    Account suspended
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">
                    This participant is blocked from every protected page and is
                    signed out within about a minute.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingAccess("reinstate")}
                  disabled={accessBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-neon/40 bg-neon/5 px-4 py-2.5 text-sm font-semibold text-neon transition-colors hover:bg-neon/10 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-neon"
                >
                  <Undo2 className="h-4 w-4" aria-hidden="true" />
                  Reinstate account
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="suspend-reason"
                    className="mb-1.5 block text-xs font-medium text-text-muted"
                  >
                    Reason for suspension{" "}
                    <span className="text-pink">(required)</span>
                  </label>
                  <textarea
                    id="suspend-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value.slice(0, 300))}
                    rows={3}
                    placeholder="Explain why this account is being suspended — recorded in the audit log…"
                    className="w-full resize-y rounded-md border border-border bg-bg-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-faint transition-colors focus:border-cyan focus:outline-none"
                  />
                  <p className="mt-1 text-right font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                    {reason.length}/300
                  </p>
                </div>
                <button
                  type="button"
                  onClick={requestSuspend}
                  disabled={accessBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-pink/40 bg-pink/5 px-4 py-2.5 text-sm font-semibold text-pink transition-colors hover:bg-pink/10 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-pink"
                >
                  <Ban className="h-4 w-4" aria-hidden="true" />
                  Suspend account
                </button>
                <p className="text-[0.6875rem] leading-relaxed text-text-faint">
                  Suspension takes effect within about a minute and is written to
                  the audit log with the reason, your identity, and your IP.
                </p>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* ── Confirmation ───────────────────────────────────────────────────── */}
      <ConfirmModal
        open={pendingAccess !== null}
        onClose={() => {
          if (!accessBusy) {setPendingAccess(null)}
        }}
        onConfirm={() => void confirmAccess()}
        title={
          pendingAccess === "suspend"
            ? "Suspend this account?"
            : "Reinstate this account?"
        }
        description={
          pendingAccess === "suspend"
            ? `${displayName} will be blocked from every protected page and signed out within about a minute. The reason is stored in the audit log.`
            : `${displayName} will regain access to their account immediately.`
        }
        confirmLabel={
          pendingAccess === "suspend" ? "Suspend account" : "Reinstate account"
        }
        cancelLabel="Cancel"
        variant={pendingAccess === "suspend" ? "danger" : "primary"}
        loading={accessBusy}
      />
    </div>
  )
}
