"use client"

// =============================================================================
// Admin — Participants list (/admin/participants)
// Searchable directory of every participant account. Rows open the detail
// view where the profile can be edited and the account suspended/reinstated.
// Only role PARTICIPANT accounts appear here — admin/staff live in
// Roles & Access.
// =============================================================================

import { RefreshCw, Users } from "lucide-react"
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
import { cn, relativeTime } from "@/lib/utils"

type ParticipantRow = {
  id: string
  name: string | null
  email: string
  isSuspended: boolean
  emailVerified: string | null
  createdAt: string
  profile: {
    fullName: string
    studentId: string
    department: string
    university: { name: string; shortName: string | null }
  } | null
  studentVerifications: { status: string }[]
  _count: {
    eventRegistrations: number
    workshopRegistrations: number
  }
}

const ACCOUNT_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
]

function displayName(participant: ParticipantRow): string {
  return participant.profile?.fullName ?? participant.name ?? "Unnamed participant"
}

export default function AdminParticipantsPage() {
  const router = useRouter()
  const list = useAdminList<ParticipantRow>("/api/admin/participants", {
    initialFilters: { account: "" },
  })

  const columns: Column<ParticipantRow>[] = [
    {
      key: "participant",
      header: "Participant",
      render: (item) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium text-text-primary">
            <span className="truncate">{displayName(item)}</span>
            {item.isSuspended && (
              <span className="shrink-0 rounded-full border border-pink/30 bg-pink/10 px-1.5 py-0.5 font-mono text-[0.5625rem] font-bold uppercase tracking-wider text-pink">
                Suspended
              </span>
            )}
          </p>
          <p className="truncate text-xs text-text-muted">{item.email}</p>
        </div>
      ),
    },
    {
      key: "studentId",
      header: "Student ID",
      desktopOnly: true,
      render: (item) => (
        <span className="font-mono text-xs text-text-primary">
          {item.profile?.studentId ?? "—"}
        </span>
      ),
    },
    {
      key: "university",
      header: "University",
      desktopOnly: true,
      render: (item) => (
        <span className="text-sm text-text-muted">
          {item.profile?.university.shortName ??
            item.profile?.university.name ??
            "—"}
        </span>
      ),
    },
    {
      key: "events",
      header: "Events",
      desktopOnly: true,
      render: (item) => {
        const total =
          item._count.eventRegistrations + item._count.workshopRegistrations
        return total === 0 ? (
          <span className="text-xs text-text-faint">None</span>
        ) : (
          <span className="text-xs text-text-muted">
            <span className="font-mono text-sm text-text-primary">
              {item._count.eventRegistrations}
            </span>{" "}
            event{item._count.eventRegistrations === 1 ? "" : "s"}
            {item._count.workshopRegistrations > 0 && (
              <>
                {" · "}
                <span className="font-mono text-sm text-text-primary">
                  {item._count.workshopRegistrations}
                </span>{" "}
                workshop{item._count.workshopRegistrations === 1 ? "" : "s"}
              </>
            )}
          </span>
        )
      },
    },
    {
      key: "verification",
      header: "Verification",
      render: (item) => (
        <StatusPill status={item.studentVerifications[0]?.status ?? "NOT_SUBMITTED"} />
      ),
    },
    {
      key: "joined",
      header: "Joined",
      desktopOnly: true,
      render: (item) => (
        <span className="whitespace-nowrap text-xs text-text-muted">
          {relativeTime(item.createdAt)}
        </span>
      ),
    },
    {
      key: "account",
      header: "Account",
      render: (item) => (
        <StatusPill status={item.isSuspended ? "SUSPENDED" : "ACTIVE"} />
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
              <Users className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Participants
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Every participant account with verification and registration context.
            Open a profile to edit details or suspend an account — all changes
            are written to the audit log.
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
        emptyTitle="No participants found"
        emptyDescription="Accounts will appear here as soon as people sign up."
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowClick={(item) =>
          router.push(`/admin/participants/${item.id}` as Route)
        }
        toolbar={
          <>
            <AdminSearchInput
              value={list.query}
              onChange={list.setQuery}
              placeholder="Search name, email or student ID…"
            />
            <AdminFilterSelect
              value={list.filters.account ?? ""}
              onChange={(value) => list.setFilter("account", value)}
              options={ACCOUNT_OPTIONS}
              allLabel="All accounts"
              ariaLabel="Filter by account status"
            />
          </>
        }
      />
    </div>
  )
}
