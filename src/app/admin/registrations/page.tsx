"use client"

// =============================================================================
// Admin — Registrations list (/admin/registrations)
// Registration desk: every event registration with participant context and
// check-in state. Clicking a row opens the manage panel where the status can
// be changed (PENDING / CONFIRMED / REJECTED / WAITLISTED / CANCELLED). Every change is
// written to the audit log.
// =============================================================================

import { ClipboardList, RefreshCw, Users } from "lucide-react"
import * as React from "react"
import toast from "react-hot-toast"

import {
  adminMutate,
  AdminFilterSelect,
  AdminSearchInput,
  DataTable,
  StatusPill,
  toastApiError,
  useAdminList,
  type Column,
} from "@/components/admin"
import { Button, Modal, Textarea } from "@/components/ui"
import { cn, relativeTime } from "@/lib/utils"

type RegistrationRow = {
  id: string
  registrationId: string
  status: string
  registrationPhase: string
  checkInStatus: string
  checkInTime: string | null
  checkOutTime: string | null
  createdAt: string
  event: { id: string; name: string; type: string }
  team: { id: string; name: string } | null
  user: {
    id: string
    name: string | null
    email: string
    isSuspended: boolean
    profile: {
      fullName: string
      studentId: string
      department: string
      university: { name: string; shortName: string | null }
    } | null
  }
}

const EVENT_TYPE_OPTIONS = [
  { value: "CTF", label: "CTF" },
  { value: "INNOVATION_SYMPOSIUM", label: "Innovation Symposium" },
  { value: "PANEL_DISCUSSION", label: "Panel Discussion" },
  { value: "HANDS_ON", label: "Hands-on Activities" },
]

type RegistrationStatusValue = "PENDING" | "PRELIM_APPROVED" | "CONFIRMED" | "REJECTED" | "WAITLISTED" | "CANCELLED"

const STATUS_OPTIONS: { value: RegistrationStatusValue; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "PRELIM_APPROVED", label: "Preliminary approved" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WAITLISTED", label: "Waitlisted" },
  { value: "CANCELLED", label: "Cancelled" },
]

const STATUS_FILTER_OPTIONS = [
  ...STATUS_OPTIONS,
  { value: "PAYMENT_PENDING", label: "Payment pending" },
  { value: "PENDING_PAYMENT", label: "Pending payment" },
]

const EVENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EVENT_TYPE_OPTIONS.map((option) => [option.value, option.label]),
)

const STATUS_META: Record<
  RegistrationStatusValue,
  { label: string; buttonClass: string; confirmTitle: string; confirmDescription: (name: string, eventName: string) => string }
> = {
  PENDING: {
    label: "Move to pending",
    buttonClass: "border-amber/40 bg-amber/5 text-amber hover:bg-amber/10",
    confirmTitle: "Move back to pending?",
    confirmDescription: (name, eventName) =>
      `${name}'s ${eventName} registration will be marked as pending review again.`,
  },
  PRELIM_APPROVED: {
    label: "Approve preliminary & invite final registration",
    buttonClass: "border-neon/40 bg-neon/5 text-neon hover:bg-neon/10",
    confirmTitle: "Approve the preliminary registration?",
    confirmDescription: (name, eventName) =>
      `${name}'s ${eventName} preliminary registration will be approved. A secure final-registration and payment link will be emailed to them.`,
  },
  CONFIRMED: {
    label: "Approve registration",
    buttonClass: "border-neon/40 bg-neon/5 text-neon hover:bg-neon/10",
    confirmTitle: "Approve this registration?",
    confirmDescription: (name, eventName) =>
      `${name}'s ${eventName} registration will be approved, they will receive a confirmation email and an invoice PDF.`,
  },
  REJECTED: {
    label: "Reject registration",
    buttonClass: "border-pink/40 bg-pink/5 text-pink hover:bg-pink/10",
    confirmTitle: "Reject this registration?",
    confirmDescription: (name, eventName) =>
      `${name}'s ${eventName} registration will be rejected and emailed the reason below.`,
  },
  WAITLISTED: {
    label: "Move to waitlist",
    buttonClass: "border-cyan/40 bg-cyan/5 text-cyan hover:bg-cyan/10",
    confirmTitle: "Move to the waitlist?",
    confirmDescription: (name, eventName) =>
      `${name}'s ${eventName} registration will be moved to the waitlist.`,
  },
  CANCELLED: {
    label: "Cancel registration",
    buttonClass: "border-pink/40 bg-pink/5 text-pink hover:bg-pink/10",
    confirmTitle: "Cancel this registration?",
    confirmDescription: (name, eventName) =>
      `${name} will no longer be able to check in for ${eventName}. This is recorded in the audit log.` +
      ` Registrations cannot be cancelled while the participant is checked in.`,
  },
}

function displayName(user: RegistrationRow["user"]): string {
  return user.profile?.fullName ?? user.name ?? "Unnamed participant"
}

export default function AdminRegistrationsPage() {
  const list = useAdminList<RegistrationRow>("/api/admin/registrations", {
    initialFilters: { eventType: "", status: "" },
  })
  const refreshRegistrations = list.refresh

  // ── Manage panel state ─────────────────────────────────────────────────────
  const [selected, setSelected] = React.useState<RegistrationRow | null>(null)
  const [pendingStatus, setPendingStatus] =
    React.useState<RegistrationStatusValue | null>(null)
  const [updating, setUpdating] = React.useState(false)
  const [rejectionReason, setRejectionReason] = React.useState("")

  const confirmStatusChange = React.useCallback(async () => {
    if (!selected || !pendingStatus) {return}
    if (pendingStatus === "REJECTED" && rejectionReason.trim().length < 5) {
      toast.error("Enter a rejection reason of at least 5 characters.")
      return
    }
    setUpdating(true)
    try {
      const updated = await adminMutate<{
        id: string
        registrationId: string
        status: string
        checkInStatus: string
      }>(
        `/api/admin/registrations/${selected.id}`,
        "PATCH",
        {
          status: pendingStatus,
          ...(pendingStatus === "REJECTED" ? { reason: rejectionReason.trim() } : {}),
        },
      )
      setSelected((prev) =>
        prev ? { ...prev, status: updated.status } : prev,
      )
      setPendingStatus(null)
      setRejectionReason("")
      refreshRegistrations()
    } catch (err) {
      toastApiError(err, "Could not update the registration.")
    } finally {
      setUpdating(false)
    }
  }, [selected, pendingStatus, rejectionReason, refreshRegistrations])

  const columns: Column<RegistrationRow>[] = [
    {
      key: "participant",
      header: "Participant",
      render: (item) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium text-text-primary">
            <span className="truncate">{displayName(item.user)}</span>
            {item.user.isSuspended && (
              <span className="shrink-0 rounded-full border border-pink/30 bg-pink/10 px-1.5 py-0.5 font-mono text-[0.5625rem] font-bold uppercase tracking-wider text-pink">
                Suspended
              </span>
            )}
          </p>
          <p className="truncate text-xs text-text-muted">{item.user.email}</p>
        </div>
      ),
    },
    {
      key: "registrationId",
      header: "Registration ID",
      desktopOnly: true,
      render: (item) => (
        <span className="font-mono text-xs text-text-primary">
          {item.registrationId}
        </span>
      ),
    },
    {
      key: "event",
      header: "Event",
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-text-primary">{item.event.name}</p>
          <p className="mt-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
            {EVENT_TYPE_LABELS[item.event.type] ?? item.event.type}
          </p>
        </div>
      ),
    },
    {
      key: "team",
      header: "Team",
      desktopOnly: true,
      render: (item) =>
        item.team ? (
          <span className="flex items-center gap-1.5 text-sm text-text-muted">
            <Users className="h-3.5 w-3.5 text-text-faint" aria-hidden="true" />
            {item.team.name}
          </span>
        ) : (
          <span className="text-xs text-text-faint">Solo</span>
        ),
    },
    {
      key: "checkIn",
      header: "Check-in",
      desktopOnly: true,
      render: (item) => (
        <div className="flex flex-col gap-1">
          <StatusPill status={item.checkInStatus} />
          {item.checkInTime && (
            <span className="text-[0.625rem] text-text-faint">
              {relativeTime(item.checkInTime)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusPill status={item.status} />,
    },
    {
      key: "registered",
      header: "Registered",
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
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Registrations
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Every event registration with check-in state. Open a row to approve,
            reject, waitlist, or cancel a registration — all changes are written
            to the audit log.
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
        emptyTitle="No registrations found"
        emptyDescription="Registrations will appear here as participants sign up, or adjust the filters."
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowClick={(item) => setSelected(item)}
        toolbar={
          <>
            <AdminSearchInput
              value={list.query}
              onChange={list.setQuery}
              placeholder="Search ID, name, email, student ID or team…"
            />
            <AdminFilterSelect
              value={list.filters.eventType ?? ""}
              onChange={(value) => list.setFilter("eventType", value)}
              options={EVENT_TYPE_OPTIONS}
              allLabel="All events"
              ariaLabel="Filter by event"
            />
            <AdminFilterSelect
              value={list.filters.status ?? ""}
              onChange={(value) => list.setFilter("status", value)}
              options={STATUS_FILTER_OPTIONS}
              allLabel="All statuses"
              ariaLabel="Filter by registration status"
            />
          </>
        }
      />

      {/* ── Manage panel ───────────────────────────────────────────────────── */}
      <Modal
        open={selected !== null}
        onClose={() => {
          if (!updating) {setSelected(null)}
        }}
        title="Manage registration"
        description="Status changes are recorded in the audit log."
        size="lg"
      >
        {selected && (
          <div className="space-y-5">
            {/* Participant */}
            <div className="rounded-md border border-border bg-bg-elevated/50 px-4 py-3">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-primary">
                {displayName(selected.user)}
                {selected.user.isSuspended && <StatusPill status="SUSPENDED" />}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {selected.user.email}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-muted">
                <span>
                  Student ID:{" "}
                  <span className="font-mono text-text-primary">
                    {selected.user.profile?.studentId ?? "—"}
                  </span>
                </span>
                <span>
                  University:{" "}
                  {selected.user.profile?.university.shortName ??
                    selected.user.profile?.university.name ??
                    "—"}
                </span>
              </div>
            </div>

            {/* Registration context */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border bg-bg-elevated/50 px-4 py-3">
                <p className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                  Registration ID
                </p>
                <p className="mt-1 font-mono text-sm text-text-primary">
                  {selected.registrationId}
                </p>
              </div>
              <div className="rounded-md border border-border bg-bg-elevated/50 px-4 py-3">
                <p className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                  Event
                </p>
                <p className="mt-1 text-sm text-text-primary">
                  {selected.event.name}
                  <span className="ml-2 text-xs text-text-muted">
                    {EVENT_TYPE_LABELS[selected.event.type] ?? selected.event.type}
                  </span>
                </p>
              </div>
              <div className="rounded-md border border-border bg-bg-elevated/50 px-4 py-3">
                <p className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                  Team
                </p>
                <p className="mt-1 text-sm text-text-primary">
                  {selected.team?.name ?? "Solo entry"}
                </p>
              </div>
              <div className="rounded-md border border-border bg-bg-elevated/50 px-4 py-3">
                <p className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                  Check-in
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <StatusPill status={selected.checkInStatus} />
                  {selected.checkInTime && (
                    <span className="text-[0.625rem] text-text-faint">
                      {relativeTime(selected.checkInTime)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Current status */}
            <div className="flex items-center justify-between rounded-md border border-border bg-bg-elevated/50 px-4 py-3">
              <span className="text-xs font-medium text-text-muted">
                Current status
              </span>
              <StatusPill status={selected.status} />
            </div>

            {/* Status actions */}
            <div>
              <p className="mb-2 font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                Change status
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {STATUS_OPTIONS.map((option) => {
                  const meta = STATUS_META[option.value]
                  const isCurrent = selected.status === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={isCurrent || updating}
                      onClick={() => {
                        setRejectionReason("")
                        setPendingStatus(option.value)
                      }}
                      className={cn(
                        "flex h-10 items-center justify-center gap-2 rounded-md border text-sm font-semibold transition-colors",
                        isCurrent
                          ? "cursor-default border-cyan/40 bg-cyan/10 text-cyan"
                          : cn(meta.buttonClass, updating && "cursor-not-allowed opacity-40"),
                      )}
                    >
                      {isCurrent ? `Currently ${option.label.toLowerCase()}` : meta.label}
                    </button>
                  )
                })}
              </div>
              {selected.checkInStatus === "CHECKED_IN" && (
                <p className="mt-2 text-[0.6875rem] leading-relaxed text-amber">
                  This participant is currently checked in — record their
                  check-out in the Check-in desk before cancelling.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Status change confirmation ─────────────────────────────────────── */}
      <Modal
        open={pendingStatus !== null}
        onClose={() => {if (!updating) {setPendingStatus(null)}}}
        title={
          pendingStatus ? STATUS_META[pendingStatus].confirmTitle : "Confirm change"
        }
        description={
          pendingStatus && selected
            ? STATUS_META[pendingStatus].confirmDescription(
                displayName(selected.user),
                selected.event.name,
              )
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" disabled={updating} onClick={() => setPendingStatus(null)}>Go back</Button>
            <Button
              variant={pendingStatus === "CANCELLED" || pendingStatus === "REJECTED" ? "danger" : "primary"}
              loading={updating}
              onClick={() => void confirmStatusChange()}
            >
              {pendingStatus ? STATUS_META[pendingStatus].label : "Confirm"}
            </Button>
          </>
        }
      >
        {pendingStatus === "REJECTED" && (
          <Textarea
            label="Reason for rejection"
            required
            minLength={5}
            maxLength={500}
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Explain why this registration could not be approved."
            showCount
          />
        )}
      </Modal>
    </div>
  )
}
