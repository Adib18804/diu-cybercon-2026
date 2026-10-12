"use client"

// =============================================================================
// Admin — Verifications list (/admin/verifications)
// Review queue for uploaded student IDs. Rows open the detail view where the
// document can be inspected (via short-lived signed URL) and a decision made.
// =============================================================================

import { RefreshCw, ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import type { Route } from "next"

import {
  AdminFilterSelect,
  AdminSearchInput,
  DataTable,
  StatusPill,
  useAdminList,
  type Column,
} from "@/components/admin"
import { cn, formatBytes, relativeTime } from "@/lib/utils"

type VerificationRow = {
  id: string
  status: string
  fileName: string
  fileSizeBytes: number
  reviewNote: string | null
  createdAt: string
  reviewedAt: string | null
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

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "VERIFIED", label: "Verified" },
  { value: "REVISION_REQUIRED", label: "Revision Required" },
  { value: "REJECTED", label: "Rejected" },
]

function displayName(user: VerificationRow["user"]): string {
  return user.profile?.fullName ?? user.name ?? "Unnamed applicant"
}

export default function AdminVerificationsPage() {
  const router = useRouter()
  const list = useAdminList<VerificationRow>("/api/admin/verifications", {
    initialFilters: { status: "" },
  })

  const columns: Column<VerificationRow>[] = [
    {
      key: "applicant",
      header: "Applicant",
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
      key: "studentId",
      header: "Student ID",
      render: (item) => (
        <span className="font-mono text-xs text-text-primary">
          {item.user.profile?.studentId ?? "—"}
        </span>
      ),
    },
    {
      key: "university",
      header: "University",
      desktopOnly: true,
      render: (item) => (
        <span className="text-sm text-text-muted">
          {item.user.profile?.university.shortName ??
            item.user.profile?.university.name ??
            "—"}
        </span>
      ),
    },
    {
      key: "document",
      header: "Document",
      desktopOnly: true,
      render: (item) => (
        <div className="min-w-0">
          <p className="max-w-[180px] truncate text-xs text-text-primary">
            {item.fileName}
          </p>
          <p className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
            {formatBytes(item.fileSizeBytes)}
          </p>
        </div>
      ),
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
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusPill status={item.status} />,
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/5 text-cyan">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Verifications
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Review uploaded student IDs. Documents open through short-lived
            signed links, and every view is logged for the audit trail.
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
        emptyTitle="No verifications found"
        emptyDescription="Submissions will appear here as soon as participants upload their student IDs."
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowClick={(item) =>
          router.push(`/admin/verifications/${item.id}` as Route)
        }
        toolbar={
          <>
            <AdminSearchInput
              value={list.query}
              onChange={list.setQuery}
              placeholder="Search name, email or student ID…"
            />
            <AdminFilterSelect
              value={list.filters.status ?? ""}
              onChange={(value) => list.setFilter("status", value)}
              options={STATUS_OPTIONS}
              allLabel="All statuses"
              ariaLabel="Filter by verification status"
            />
          </>
        }
      />
    </div>
  )
}
