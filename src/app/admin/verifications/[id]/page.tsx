"use client"

// =============================================================================
// Admin — Verification detail (/admin/verifications/[id])
// Full applicant context, document inspection via short-lived signed URL,
// access history, and the decision panel (VERIFIED / REJECTED /
// REVISION_REQUIRED). The applier is notified by email on every decision.
// =============================================================================

import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  GraduationCap,
  History,
  Loader2,
  Phone,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  XCircle,
} from "lucide-react"
import Link from "next/link"
import * as React from "react"
import toast from "react-hot-toast"

import { ConfirmModal } from "@/components/ui"
import {
  adminFetch,
  adminMutate,
  StatusPill,
  toastApiError,
} from "@/components/admin"
import { cn, formatBytes, formatDate, relativeTime } from "@/lib/utils"

// ─── Types (mirror the API payload) ──────────────────────────────────────────

type VerificationDetail = {
  id: string
  status: string
  fileName: string
  fileMimeType: string
  fileSizeBytes: number
  reviewNote: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    name: string | null
    email: string
    isSuspended: boolean
    createdAt: string
    profile: {
      fullName: string
      studentId: string
      department: string
      phone: string
      tshirtSize: string
      university: { name: string; shortName: string | null }
    } | null
  }
  teamMember: {
    id: string
    isLeader: boolean
    team: { id: string; name: string; event: { name: string; type: string } }
  } | null
  reviewedByUser: { id: string; name: string | null; email: string } | null
}

type AccessLogEntry = {
  id: string
  adminName: string
  ipAddress: string
  accessedAt: string
}

type DetailPayload = {
  verification: VerificationDetail
  accessLogs: AccessLogEntry[]
}

type Decision = "VERIFIED" | "REJECTED" | "REVISION_REQUIRED"

const DECISION_META: Record<
  Decision,
  {
    title: string
    description: (name: string) => string
    confirmLabel: string
    variant: "primary" | "danger"
  }
> = {
  VERIFIED: {
    title: "Verify this applicant?",
    description: (name) =>
      `${name} will be marked as verified and notified by email. Verified members can be invited to CTF teams.`,
    confirmLabel: "Verify applicant",
    variant: "primary",
  },
  REJECTED: {
    title: "Reject this verification?",
    description: (name) =>
      `${name} will be notified by email that their student ID was not accepted. The attached note is included in the email.`,
    confirmLabel: "Reject verification",
    variant: "danger",
  },
  REVISION_REQUIRED: {
    title: "Request a re-upload?",
    description: (name) =>
      `${name} will be notified by email and asked to upload a clearer document. The attached note is included in the email.`,
    confirmLabel: "Request revision",
    variant: "primary",
  },
}

// ─── Small building blocks ────────────────────────────────────────────────────

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

function SectionCard({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-bg-panel p-5",
        className,
      )}
    >
      <h2 className="mb-4 font-mono text-micro uppercase tracking-wider text-text-muted">
        {title}
      </h2>
      {children}
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminVerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = React.use(params)

  const [data, setData] = React.useState<DetailPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [viewing, setViewing] = React.useState(false)
  const [note, setNote] = React.useState("")
  const [pendingDecision, setPendingDecision] =
    React.useState<Decision | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const payload = await adminFetch<DetailPayload>(
        `/api/admin/verifications/${id}`,
      )
      setData(payload)
      setLoadError(null)
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load verification.",
      )
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    void load()
  }, [load])

  // ── Document viewing — mint a ≤5-min signed URL, then open it ────────────
  const handleViewDocument = React.useCallback(async () => {
    setViewing(true)
    try {
      const { url } = await adminMutate<{ url: string }>(
        `/api/admin/verifications/${id}/view-url`,
        "POST",
      )
      window.open(url, "_blank", "noopener,noreferrer")
      // The serve happens on the new tab; refresh logs shortly after
      window.setTimeout(() => void load(), 1500)
    } catch (err) {
      toastApiError(err, "Could not open the document.")
    } finally {
      setViewing(false)
    }
  }, [id, load])

  // ── Decisions ─────────────────────────────────────────────────────────────
  const requestDecision = React.useCallback(
    (decision: Decision) => {
      if (
        (decision === "REJECTED" || decision === "REVISION_REQUIRED") &&
        note.trim().length === 0
      ) {
        toast.error("Add a note explaining the decision — it is emailed to the applicant.")
        return
      }
      setPendingDecision(decision)
    },
    [note],
  )

  const confirmDecision = React.useCallback(async () => {
    if (!pendingDecision) {return}
    setSubmitting(true)
    try {
      await adminMutate(
        `/api/admin/verifications/${id}`,
        "PATCH",
        {
          decision: pendingDecision,
          note: note.trim() || undefined,
        },
        { successMessage: "Decision recorded." },
      )
      setPendingDecision(null)
      setNote("")
      await load()
    } catch (err) {
      toastApiError(err, "Could not record the decision.")
    } finally {
      setSubmitting(false)
    }
  }, [pendingDecision, note, id, load])

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-panel px-6 py-16 text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span className="text-sm">Loading verification…</span>
      </div>
    )
  }

  if (loadError && !data) {
    return (
      <div className="rounded-lg border border-pink/30 bg-pink/5 px-6 py-14 text-center">
        <ShieldAlert className="mx-auto mb-3 h-6 w-6 text-pink" aria-hidden="true" />
        <p className="text-sm font-medium text-text-primary">
          Could not load this verification
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

  const { verification, accessLogs } = data
  const applicantName =
    verification.user.profile?.fullName ??
    verification.user.name ??
    "Unnamed applicant"
  const isDecided =
    verification.status === "VERIFIED" ||
    verification.status === "REJECTED" ||
    verification.status === "REVISION_REQUIRED"

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <Link
          href="/admin/verifications"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted transition-colors hover:text-cyan"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to verifications
        </Link>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
                {applicantName}
              </h1>
              <StatusPill status={verification.status} />
              {verification.user.isSuspended && (
                <span className="rounded-full border border-pink/30 bg-pink/10 px-2 py-0.5 font-mono text-[0.625rem] font-bold uppercase tracking-wider text-pink">
                  Account suspended
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-text-muted">
              Submitted {relativeTime(verification.createdAt)} ·{" "}
              {formatDate(verification.createdAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column: applicant + team ──────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Applicant">
            <div className="grid gap-5 sm:grid-cols-2">
              <InfoRow icon={User} label="Full name" value={applicantName} />
              <InfoRow
                icon={GraduationCap}
                label="Student ID"
                value={
                  <span className="font-mono text-sm">
                    {verification.user.profile?.studentId ?? "—"}
                  </span>
                }
              />
              <InfoRow icon={User} label="Email" value={verification.user.email} />
              <InfoRow
                icon={Building2}
                label="University"
                value={
                  verification.user.profile
                    ? `${verification.user.profile.university.name}${
                        verification.user.profile.university.shortName
                          ? ` (${verification.user.profile.university.shortName})`
                          : ""
                      }`
                    : "—"
                }
              />
              <InfoRow
                icon={GraduationCap}
                label="Department"
                value={verification.user.profile?.department ?? "—"}
              />
              <InfoRow
                icon={Phone}
                label="Phone"
                value={
                  <span className="font-mono text-sm">
                    {verification.user.profile?.phone ?? "—"}
                  </span>
                }
              />
              <InfoRow
                icon={User}
                label="T-shirt size"
                value={verification.user.profile?.tshirtSize ?? "—"}
              />
              <InfoRow
                icon={Clock}
                label="Account created"
                value={formatDate(verification.user.createdAt)}
              />
            </div>
          </SectionCard>

          {verification.teamMember && (
            <SectionCard title="Team context">
              <div className="flex flex-wrap items-center gap-3">
                <Users className="h-4 w-4 text-text-faint" />
                <span className="text-sm font-medium text-text-primary">
                  {verification.teamMember.team.name}
                </span>
                <span className="rounded-full border border-cyan/30 bg-cyan/10 px-2 py-0.5 font-mono text-[0.625rem] font-bold uppercase tracking-wider text-cyan">
                  {verification.teamMember.team.event.name}
                </span>
                <span className="text-xs text-text-muted">
                  {verification.teamMember.isLeader ? "Team leader" : "Team member"}
                </span>
              </div>
            </SectionCard>
          )}

          {/* ── Document ─────────────────────────────────────────────────── */}
          <SectionCard title="Uploaded document">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-elevated text-text-muted">
                  <FileText className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {verification.fileName}
                  </p>
                  <p className="mt-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                    {verification.fileMimeType} ·{" "}
                    {formatBytes(verification.fileSizeBytes)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleViewDocument()}
                disabled={viewing}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-cyan/40 bg-cyan/5 px-3 text-xs font-semibold text-cyan transition-colors hover:bg-cyan/10 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
              >
                {viewing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                View document
                <ExternalLink className="h-3 w-3 opacity-60" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-3 text-[0.6875rem] leading-relaxed text-text-faint">
              Opens a signed link that expires in 5 minutes. Every document view
              is recorded in the access history below.
            </p>
          </SectionCard>
        </div>

        {/* ── Right column: decision + history ───────────────────────────── */}
        <div className="space-y-6">
          <SectionCard title="Decision">
            {isDecided && (
              <div className="mb-4 rounded-md border border-border bg-bg-elevated/60 px-3.5 py-3">
                <p className="text-xs text-text-muted">
                  Last decision{" "}
                  <span className="text-text-primary">
                    {verification.reviewedAt
                      ? relativeTime(verification.reviewedAt)
                      : ""}
                  </span>
                  {verification.reviewedByUser && (
                    <>
                      {" by "}
                      <span className="text-text-primary">
                        {verification.reviewedByUser.name ??
                          verification.reviewedByUser.email}
                      </span>
                    </>
                  )}
                </p>
                {verification.reviewNote && (
                  <p className="mt-2 border-l-2 border-violet/40 pl-2.5 text-xs italic text-text-muted">
                    “{verification.reviewNote}”
                  </p>
                )}
              </div>
            )}

            <label
              htmlFor="decision-note"
              className="mb-1.5 block text-xs font-medium text-text-muted"
            >
              Note{" "}
              <span className="text-text-faint">
                (required for rejection / revision)
              </span>
            </label>
            <textarea
              id="decision-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={4}
              placeholder="Explain what the applicant should fix, or why the document was accepted…"
              className="w-full resize-y rounded-md border border-border bg-bg-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-faint transition-colors focus:border-cyan focus:outline-none"
            />
            <p className="mt-1 text-right font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
              {note.length}/500
            </p>

            <div className="mt-4 space-y-2.5">
              <button
                type="button"
                onClick={() => requestDecision("VERIFIED")}
                disabled={submitting}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  verification.status === "VERIFIED"
                    ? "border-neon/40 bg-neon/10 text-neon"
                    : "border-neon/40 bg-neon/5 text-neon hover:bg-neon/10",
                )}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {verification.status === "VERIFIED"
                  ? "Verified — decide again"
                  : "Verify applicant"}
              </button>

              <button
                type="button"
                onClick={() => requestDecision("REVISION_REQUIRED")}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-violet/40 bg-violet/5 px-4 py-2.5 text-sm font-semibold text-violet-300 transition-colors hover:bg-violet/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Request revision
              </button>

              <button
                type="button"
                onClick={() => requestDecision("REJECTED")}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-pink/40 bg-pink/5 px-4 py-2.5 text-sm font-semibold text-pink transition-colors hover:bg-pink/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Reject verification
              </button>
            </div>

            <p className="mt-3 text-[0.6875rem] leading-relaxed text-text-faint">
              The applicant is notified by email on every decision. All actions
              are written to the audit log.
            </p>
          </SectionCard>

          <SectionCard title="Access history">
            {accessLogs.length === 0 ? (
              <div className="flex items-center gap-2.5 text-xs text-text-muted">
                <History className="h-3.5 w-3.5 text-text-faint" aria-hidden="true" />
                No document views recorded yet.
              </div>
            ) : (
              <ul className="space-y-3">
                {accessLogs.map((log) => (
                  <li key={log.id} className="flex items-start gap-3">
                    <ShieldCheck
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan/70"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs text-text-primary">
                        {log.adminName}
                      </p>
                      <p className="mt-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                        {relativeTime(log.accessedAt)} · IP {log.ipAddress}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      {/* ── Decision confirmation ──────────────────────────────────────────── */}
      <ConfirmModal
        open={pendingDecision !== null}
        onClose={() => {
          if (!submitting) {setPendingDecision(null)}
        }}
        onConfirm={() => void confirmDecision()}
        title={pendingDecision ? DECISION_META[pendingDecision].title : ""}
        description={
          pendingDecision
            ? DECISION_META[pendingDecision].description(applicantName)
            : undefined
        }
        confirmLabel={
          pendingDecision ? DECISION_META[pendingDecision].confirmLabel : "Confirm"
        }
        cancelLabel="Cancel"
        variant={pendingDecision ? DECISION_META[pendingDecision].variant : "primary"}
        loading={submitting}
      />
    </div>
  )
}
