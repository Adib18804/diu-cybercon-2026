"use client"

// =============================================================================
// Admin — Audit logs (/admin/audit-logs)
// Read-only viewer over the append-only audit trail
// (GET /api/admin/audit-logs, "audit_logs:view"). Filter by action, target
// type, date range and free-text search; click a row to inspect the full
// entry including before / after / metadata JSON snapshots. Nothing on this
// page mutates anything — audit records are immutable.
// =============================================================================

import { RefreshCw, ScrollText } from "lucide-react"
import * as React from "react"

import {
  AdminFilterSelect,
  AdminSearchInput,
  DataTable,
  useAdminList,
  type Column,
} from "@/components/admin"
import { Input, Modal } from "@/components/ui"
import {
  cn,
  formatDate,
  formatTime,
  relativeTime,
  truncate,
} from "@/lib/utils"

// ─── Row type (mirror GET /api/admin/audit-logs) ──────────────────────────────

type AuditLogRow = {
  id: string
  actorId: string
  action: string
  targetType: string
  targetId: string | null
  before: unknown
  after: unknown
  metadata: unknown
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  actor: { id: string; name: string | null; email: string }
}

// ─── Filter options ───────────────────────────────────────────────────────────
// Display-level list of the most common actions. The select passes the raw
// value and the API validates it before it ever reaches Prisma.

const ACTION_OPTIONS = [
  { value: "USER_LOGIN", label: "User login" },
  { value: "USER_SUSPENDED", label: "User suspended" },
  { value: "STUDENT_ID_VERIFIED", label: "Student ID verified" },
  { value: "STUDENT_ID_REJECTED", label: "Student ID rejected" },
  { value: "REGISTRATION_CREATED", label: "Registration created" },
  { value: "REGISTRATION_STATUS_CHANGED", label: "Registration status changed" },
  { value: "TEAM_CREATED", label: "Team created" },
  { value: "TEAM_MEMBER_ADDED", label: "Team member added" },
  { value: "PROJECT_STATUS_CHANGED", label: "Project status changed" },
  { value: "POSTER_STATUS_CHANGED", label: "Poster status changed" },
  { value: "WORKSHOP_UPDATED", label: "Workshop updated" },
  { value: "PARTICIPANT_CHECKED_IN", label: "Participant checked in" },
  { value: "SPONSOR_UPDATED", label: "Sponsor updated" },
  { value: "SPONSOR_APPLICATION_STATUS_CHANGED", label: "Sponsor application status changed" },
  { value: "ADMIN_ROLE_ASSIGNED", label: "Admin role assigned" },
  { value: "ADMIN_ROLE_REMOVED", label: "Admin role removed" },
  { value: "SETTINGS_UPDATED", label: "Settings updated" },
  { value: "ANNOUNCEMENT_PUBLISHED", label: "Announcement published" },
  { value: "ANNOUNCEMENT_BROADCASTED", label: "Announcement broadcasted" },
  { value: "EMAIL_UNSUBSCRIBED", label: "Email unsubscribed" },
  { value: "GALLERY_IMAGE_DELETED", label: "Gallery image deleted" },
  { value: "FAQ_UPDATED", label: "FAQ updated" },
]

const TARGET_TYPE_OPTIONS = [
  { value: "User", label: "User" },
  { value: "ParticipantProfile", label: "ParticipantProfile" },
  { value: "EventRegistration", label: "EventRegistration" },
  { value: "Team", label: "Team" },
  { value: "TeamMember", label: "TeamMember" },
  { value: "StudentVerification", label: "StudentVerification" },
  { value: "Project", label: "Project" },
  { value: "Poster", label: "Poster" },
  { value: "Workshop", label: "Workshop" },
  { value: "WorkshopRegistration", label: "WorkshopRegistration" },
  { value: "Speaker", label: "Speaker" },
  { value: "Panel", label: "Panel" },
  { value: "ScheduleItem", label: "ScheduleItem" },
  { value: "Sponsor", label: "Sponsor" },
  { value: "SponsorApplication", label: "SponsorApplication" },
  { value: "Partner", label: "Partner" },
  { value: "Announcement", label: "Announcement" },
  { value: "GalleryImage", label: "GalleryImage" },
  { value: "FAQ", label: "FAQ" },
  { value: "ContactMessage", label: "ContactMessage" },
  { value: "SiteSetting", label: "SiteSetting" },
  { value: "AuditLog", label: "AuditLog" },
]

// ─── Local building blocks ────────────────────────────────────────────────────

function DetailField({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-bg-elevated/50 px-4 py-3",
        className,
      )}
    >
      <p className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
        {label}
      </p>
      <div className="mt-1 text-sm text-text-primary">{children}</div>
    </div>
  )
}

/** Pretty-print a JSON column — hidden entirely when the value is null. */
function JsonSection({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined) {return null}
  const pretty = JSON.stringify(value, null, 2) ?? "[unserializable value]"
  return (
    <section>
      <p className="mb-1.5 font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
        {title}
      </p>
      <pre className="max-h-72 overflow-x-auto overflow-y-auto rounded-md border border-border bg-bg-elevated/50 p-3 font-mono text-xs leading-relaxed text-text-muted">
        {pretty}
      </pre>
    </section>
  )
}

function actorDisplayName(actor: AuditLogRow["actor"], actorId: string): string {
  return actor.name?.trim() || actor.email || actorId
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAuditLogsPage() {
  const list = useAdminList<AuditLogRow>("/api/admin/audit-logs", {
    initialFilters: { action: "", targetType: "", from: "", to: "" },
  })

  const [selected, setSelected] = React.useState<AuditLogRow | null>(null)

  const columns: Column<AuditLogRow>[] = [
    {
      key: "when",
      header: "When",
      render: (item) => {
        const exact = `${formatDate(item.createdAt)} at ${formatTime(item.createdAt)}`
        return (
          <div className="min-w-0" title={exact}>
            <p className="whitespace-nowrap text-sm text-text-primary">
              {relativeTime(item.createdAt)}
            </p>
            <p className="mt-0.5 whitespace-nowrap text-[0.625rem] text-text-faint">
              {exact}
            </p>
          </div>
        )
      },
    },
    {
      key: "actor",
      header: "Actor",
      render: (item) => {
        const name = item.actor.name?.trim()
        return (
          <div className="min-w-0">
            <p className="truncate text-sm text-text-primary">
              {actorDisplayName(item.actor, item.actorId)}
            </p>
            {name && (
              <p className="truncate text-xs text-text-muted">{item.actor.email}</p>
            )}
          </div>
        )
      },
    },
    {
      key: "action",
      header: "Action",
      render: (item) => (
        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-cyan/30 bg-cyan/5 px-2 py-0.5 font-mono text-xs text-cyan">
          {item.action}
        </span>
      ),
    },
    {
      key: "target",
      header: "Target",
      desktopOnly: true,
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-text-primary">{item.targetType}</p>
          <p
            className="mt-0.5 truncate font-mono text-[0.625rem] text-text-faint"
            title={item.targetId ?? undefined}
          >
            {item.targetId ? truncate(item.targetId, 14) : "—"}
          </p>
        </div>
      ),
    },
    {
      key: "ip",
      header: "IP",
      desktopOnly: true,
      render: (item) => (
        <span className="whitespace-nowrap font-mono text-xs text-text-muted">
          {item.ipAddress ?? "—"}
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
              <ScrollText className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Audit logs
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Append-only record of every sensitive action, newest first. Open a
            row to inspect the event metadata, IP address and user agent — this
            view is read-only.
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
        emptyTitle="No audit entries found"
        emptyDescription="Entries appear here as actions are performed, or adjust the filters."
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowClick={(item) => setSelected(item)}
        toolbar={
          <>
            <AdminSearchInput
              value={list.query}
              onChange={list.setQuery}
              placeholder="Search target ID, actor name or email…"
            />
            <AdminFilterSelect
              value={list.filters.action ?? ""}
              onChange={(value) => list.setFilter("action", value)}
              options={ACTION_OPTIONS}
              allLabel="All actions"
              ariaLabel="Filter by action"
            />
            <AdminFilterSelect
              value={list.filters.targetType ?? ""}
              onChange={(value) => list.setFilter("targetType", value)}
              options={TARGET_TYPE_OPTIONS}
              allLabel="All target types"
              ariaLabel="Filter by target type"
            />
            <div className="w-full sm:w-40">
              <Input
                label="From"
                type="date"
                inputSize="sm"
                value={list.filters.from ?? ""}
                onChange={(e) => list.setFilter("from", e.target.value)}
              />
            </div>
            <div className="w-full sm:w-40">
              <Input
                label="To"
                type="date"
                inputSize="sm"
                value={list.filters.to ?? ""}
                onChange={(e) => list.setFilter("to", e.target.value)}
              />
            </div>
          </>
        }
      />

      {/* ── Detail modal (read-only) ───────────────────────────────────────── */}
      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Audit entry"
        description="Read-only record from the audit trail."
        size="lg"
      >
        {selected && (
          <div className="space-y-5">
            {/* Actor */}
            <div className="rounded-md border border-border bg-bg-elevated/50 px-4 py-3">
              <p className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                Actor
              </p>
              <p className="mt-1 text-sm font-medium text-text-primary">
                {actorDisplayName(selected.actor, selected.actorId)}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {selected.actor.email}
              </p>
              <p className="mt-0.5 break-all font-mono text-[0.6875rem] text-text-faint">
                {selected.actor.id}
              </p>
            </div>

            {/* Core fields */}
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailField label="Action">
                <span className="inline-flex items-center rounded-full border border-cyan/30 bg-cyan/5 px-2 py-0.5 font-mono text-xs text-cyan">
                  {selected.action}
                </span>
              </DetailField>
              <DetailField label="Target type">
                {selected.targetType}
              </DetailField>
              <DetailField label="Target ID">
                <span className="break-all font-mono text-xs">
                  {selected.targetId ?? "—"}
                </span>
              </DetailField>
              <DetailField label="Recorded at">
                <span className="whitespace-nowrap">
                  {formatDate(selected.createdAt)} at{" "}
                  {formatTime(selected.createdAt)}
                </span>
              </DetailField>
              <DetailField label="IP address">
                <span className="font-mono text-xs">
                  {selected.ipAddress ?? "—"}
                </span>
              </DetailField>
              <DetailField label="User agent">
                <span className="break-words text-xs">
                  {selected.userAgent ?? "—"}
                </span>
              </DetailField>
            </div>

            {/* JSON snapshots — each hidden when the column is null */}
            <JsonSection title="Before" value={selected.before} />
            <JsonSection title="After" value={selected.after} />
            <JsonSection title="Metadata" value={selected.metadata} />
          </div>
        )}
      </Modal>
    </div>
  )
}
