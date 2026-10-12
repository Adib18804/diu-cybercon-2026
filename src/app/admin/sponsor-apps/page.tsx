"use client"

// =============================================================================
// Admin — Sponsor applications queue (/admin/sponsor-apps)
// Sponsorship applications submitted through the public form. Rows open a
// manage dialog with the full proposal, a status pipeline (SUBMITTED →
// CONTACTED → NEGOTIATION → APPROVED / REJECTED → COMPLETED), and internal
// notes. Every status change and note edit is written to the audit log.
// =============================================================================

import { ExternalLink, Mail, RefreshCw, Save } from "lucide-react"
import * as React from "react"

import {
  adminFetch,
  adminMutate,
  AdminFilterSelect,
  AdminSearchInput,
  DataTable,
  StatusPill,
  humanizeStatus,
  toastApiError,
  useAdminList,
  type Column,
} from "@/components/admin"
import { Button, Input, Modal, Textarea } from "@/components/ui"
import { cn, relativeTime } from "@/lib/utils"

// ─── Types (mirror GET /api/admin/sponsor-apps) ──────────────────────────────

type SponsorTierValue =
  | "TITLE"
  | "PLATINUM"
  | "GOLD"
  | "CUSTOM"
  | "PARTNER"
  | "MEDIA_PARTNER"
  | "TECHNICAL_PARTNER"
  | "OTHER_PARTNER"

type SponsorAppStatusValue =
  | "SUBMITTED"
  | "CONTACTED"
  | "NEGOTIATION"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"

type SponsorAppRow = {
  id: string
  orgName: string
  contactPerson: string
  email: string
  phone: string
  website: string | null
  tier: SponsorTierValue
  logoKey: string | null
  message: string | null
  status: SponsorAppStatusValue
  assignedTo: string | null
  internalNotes: string | null
  createdAt: string
  updatedAt: string
}

// ─── Filter + pipeline options ────────────────────────────────────────────────

const STATUS_OPTIONS: { value: SponsorAppStatusValue; label: string }[] = [
  { value: "SUBMITTED", label: "Submitted" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "COMPLETED", label: "Completed" },
]

const TIER_LABELS: Record<string, string> = {
  TITLE: "Title Sponsor",
  PLATINUM: "Platinum Sponsor",
  GOLD: "Gold Sponsor",
  CUSTOM: "Custom Sponsorship",
  PARTNER: "Partner",
  MEDIA_PARTNER: "Media Partner",
  TECHNICAL_PARTNER: "Technical Partner",
  OTHER_PARTNER: "Other Partner",
}

const STATUS_FLOW: {
  value: SponsorAppStatusValue
  label: string
  currentLabel: string
  className: string
}[] = [
  {
    value: "CONTACTED",
    label: "Mark contacted",
    currentLabel: "Currently contacted",
    className: "border-amber/40 bg-amber/5 text-amber hover:bg-amber/10",
  },
  {
    value: "NEGOTIATION",
    label: "Mark negotiation",
    currentLabel: "Currently in negotiation",
    className: "border-cyan/40 bg-cyan/5 text-cyan hover:bg-cyan/10",
  },
  {
    value: "APPROVED",
    label: "Approve",
    currentLabel: "Currently approved",
    className: "border-neon/40 bg-neon/5 text-neon hover:bg-neon/10",
  },
  {
    value: "REJECTED",
    label: "Reject",
    currentLabel: "Currently rejected",
    className: "border-pink/40 bg-pink/5 text-pink hover:bg-pink/10",
  },
  {
    value: "COMPLETED",
    label: "Mark completed",
    currentLabel: "Currently completed",
    className: "border-neon/40 bg-neon/5 text-neon hover:bg-neon/10",
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSponsorAppsPage() {
  const list = useAdminList<SponsorAppRow>("/api/admin/sponsor-apps", {
    initialFilters: { status: "" },
  })

  // ── Manage dialog state ────────────────────────────────────────────────────
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const [detail, setDetail] = React.useState<SponsorAppRow | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [updating, setUpdating] = React.useState(false)
  const [notes, setNotes] = React.useState("")
  const [assignedTo, setAssignedTo] = React.useState("")
  const [savingDetails, setSavingDetails] = React.useState(false)

  // Guards against out-of-order responses when switching rows quickly and
  // against a stale detail fetch reopening a closed dialog.
  const requestIdRef = React.useRef(0)

  const openApplication = React.useCallback((row: SponsorAppRow) => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setDetailId(row.id)
    setDetail(row)
    setNotes(row.internalNotes ?? "")
    setAssignedTo(row.assignedTo ?? "")
    setDetailLoading(true)

    adminFetch<SponsorAppRow>(`/api/admin/sponsor-apps/${row.id}`)
      .then((fresh) => {
        if (requestIdRef.current !== requestId) {return}
        setDetail(fresh)
        setNotes(fresh.internalNotes ?? "")
        setAssignedTo(fresh.assignedTo ?? "")
      })
      .catch((err: unknown) => {
        if (requestIdRef.current !== requestId) {return}
        toastApiError(err, "Could not load the latest application details.")
      })
      .finally(() => {
        if (requestIdRef.current === requestId) {setDetailLoading(false)}
      })
  }, [])

  const closeApplication = React.useCallback(() => {
    requestIdRef.current += 1
    setDetailId(null)
    setDetail(null)
    setDetailLoading(false)
  }, [])

  const changeStatus = React.useCallback(
    async (next: SponsorAppStatusValue) => {
      if (!detail) {return}
      setUpdating(true)
      try {
        const updated = await adminMutate<SponsorAppRow>(
          `/api/admin/sponsor-apps/${detail.id}`,
          "PATCH",
          { status: next },
          {
            successMessage: `Application marked as ${humanizeStatus(next).toLowerCase()}.`,
          },
        )
        setDetail(updated)
        list.refresh()
      } catch (err) {
        toastApiError(err, "Could not update the application status.")
      } finally {
        setUpdating(false)
      }
    },
    [detail, list.refresh],
  )

  const saveDetails = React.useCallback(async () => {
    if (!detail) {return}
    setSavingDetails(true)
    try {
      const updated = await adminMutate<SponsorAppRow>(
        `/api/admin/sponsor-apps/${detail.id}`,
        "PATCH",
        { internalNotes: notes.trim(), assignedTo: assignedTo.trim() },
        { successMessage: "Application details saved." },
      )
      setDetail(updated)
      setNotes(updated.internalNotes ?? "")
      setAssignedTo(updated.assignedTo ?? "")
      list.refresh()
    } catch (err) {
      toastApiError(err, "Could not save the application details.")
    } finally {
      setSavingDetails(false)
    }
  }, [detail, notes, assignedTo, list.refresh])

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: Column<SponsorAppRow>[] = [
    {
      key: "organization",
      header: "Organization",
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">
            {item.orgName}
          </p>
          <p className="mt-0.5 truncate text-xs text-text-muted">
            {item.assignedTo ? `Assigned to ${item.assignedTo}` : "Unassigned"}
          </p>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact person",
      render: (item) => (
        <span className="block truncate text-sm text-text-primary">
          {item.contactPerson}
        </span>
      ),
    },
    {
      key: "contactInfo",
      header: "Email + phone",
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-text-primary">{item.email}</p>
          <p className="mt-0.5 font-mono text-[0.625rem] text-text-faint">
            {item.phone}
          </p>
        </div>
      ),
    },
    {
      key: "tier",
      header: "Tier interest",
      desktopOnly: true,
      render: (item) => (
        <span className="whitespace-nowrap text-sm text-text-muted">
          {TIER_LABELS[item.tier] ?? humanizeStatus(item.tier)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusPill status={item.status} />,
    },
    {
      key: "submitted",
      header: "Submitted",
      desktopOnly: true,
      render: (item) => (
        <span className="whitespace-nowrap text-xs text-text-muted">
          {relativeTime(item.createdAt)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/5 text-cyan">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Sponsor applications
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Sponsorship proposals submitted through the public form. Open a row
            to review the proposal, move it through the pipeline, and keep
            internal notes — every change is written to the audit log.
          </p>
        </div>

        <button
          type="button"
          onClick={list.refresh}
          disabled={list.loading}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-bg-elevated px-3 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", list.loading && "animate-spin")}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        items={list.items}
        rowKey={(item) => item.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.refresh}
        emptyTitle="No applications yet"
        emptyDescription="Sponsorship applications submitted through the public form will appear here."
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowClick={openApplication}
        toolbar={
          <>
            <AdminSearchInput
              value={list.query}
              onChange={list.setQuery}
              placeholder="Search organization, contact, or email…"
            />
            <AdminFilterSelect
              value={list.filters.status ?? ""}
              onChange={(value) => list.setFilter("status", value)}
              options={STATUS_OPTIONS}
              allLabel="All statuses"
              ariaLabel="Filter by status"
            />
          </>
        }
      />

      {/* ── Manage dialog ──────────────────────────────────────────────────── */}
      <Modal
        open={detailId !== null}
        onClose={() => {
          if (!updating && !savingDetails) {closeApplication()}
        }}
        title="Sponsorship application"
        description="Status changes and notes are recorded in the audit log."
        size="lg"
      >
        {detail && (
          <div className="space-y-5">
            {detailLoading && (
              <p className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                Refreshing latest details…
              </p>
            )}

            {/* Contact block */}
            <div className="rounded-md border border-border bg-bg-elevated/50 px-4 py-3">
              <p className="text-sm font-medium text-text-primary">
                {detail.orgName}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {detail.contactPerson}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-muted">
                <a
                  href={`mailto:${detail.email}`}
                  className="inline-flex items-center gap-1 text-cyan transition-colors hover:underline"
                >
                  <Mail className="h-3 w-3" aria-hidden="true" />
                  {detail.email}
                </a>
                <span className="font-mono text-text-primary">
                  {detail.phone}
                </span>
                {detail.website && (
                  <a
                    href={detail.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-cyan transition-colors hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    {detail.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-muted">
                <span>
                  Tier interest:{" "}
                  <span className="text-text-primary">
                    {TIER_LABELS[detail.tier] ?? humanizeStatus(detail.tier)}
                  </span>
                </span>
                <span>Submitted {relativeTime(detail.createdAt)}</span>
              </div>
            </div>

            {/* Logo */}
            <div>
              <p className="mb-2 font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                Logo
              </p>
              {detail.logoKey && detail.logoKey.startsWith("http") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={detail.logoKey}
                  alt={`${detail.orgName} logo`}
                  className="h-16 w-40 rounded-md border border-border bg-bg-elevated object-contain p-1"
                />
              ) : (
                <p className="text-xs text-text-muted">No logo provided.</p>
              )}
            </div>

            {/* Message */}
            <div>
              <p className="mb-2 font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                Message
              </p>
              {detail.message ? (
                <p className="whitespace-pre-wrap rounded-md border border-border bg-bg-elevated/50 px-4 py-3 text-sm leading-relaxed text-text-primary">
                  {detail.message}
                </p>
              ) : (
                <p className="text-xs text-text-muted">No message provided.</p>
              )}
            </div>

            {/* Current status */}
            <div className="flex items-center justify-between rounded-md border border-border bg-bg-elevated/50 px-4 py-3">
              <span className="text-xs font-medium text-text-muted">
                Current status
              </span>
              <StatusPill status={detail.status} />
            </div>

            {/* Pipeline */}
            <div>
              <p className="mb-2 font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                Move through the pipeline
              </p>
              <div className="flex flex-wrap gap-2">
                {STATUS_FLOW.map((option) => {
                  const isCurrent = detail.status === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={isCurrent || updating || savingDetails}
                      onClick={() => void changeStatus(option.value)}
                      className={cn(
                        "h-9 rounded-md border px-3 text-xs font-semibold transition-colors",
                        isCurrent
                          ? "cursor-default border-cyan/40 bg-cyan/10 text-cyan"
                          : cn(
                              option.className,
                              (updating || savingDetails) &&
                                "cursor-not-allowed opacity-40",
                            ),
                      )}
                    >
                      {isCurrent ? option.currentLabel : option.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Internal notes */}
            <div className="space-y-4 border-t border-border pt-4">
              <Input
                label="Assigned to"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                maxLength={100}
                helper="Internal — the staff member handling this application."
                placeholder="e.g. Rahim (Sponsorship)"
              />
              <Textarea
                label="Internal notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                showCount
                placeholder="Negotiation history, promised deliverables, follow-ups…"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => void saveDetails()}
                  loading={savingDetails}
                  loadingText="Saving…"
                  leftIcon={<Save className="h-3.5 w-3.5" />}
                >
                  Save details
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
