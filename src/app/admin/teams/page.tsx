"use client"

// =============================================================================
// Admin — Teams list (/admin/teams)
// Every active team with its event, resolved leader, and member count.
// Clicking a row opens the team detail view where the team can be renamed or
// deleted — both actions are written to the audit log.
// =============================================================================

import { RefreshCw, UsersRound } from "lucide-react"
import type { Route } from "next"
import { useRouter } from "next/navigation"

import {
  AdminFilterSelect,
  AdminSearchInput,
  DataTable,
  useAdminList,
  type Column,
} from "@/components/admin"
import { cn, relativeTime } from "@/lib/utils"

type TeamRow = {
  id: string
  name: string
  createdAt: string
  event: { id: string; name: string; type: string }
  leader: { id: string; name: string | null; email: string } | null
  _count: { members: number }
}

const EVENT_TYPE_OPTIONS = [
  { value: "CTF", label: "CTF" },
  { value: "TRACE_ROUTE", label: "Trace & Route" },
  { value: "PROJECT_SHOWCASE", label: "Project Showcase" },
  { value: "POSTER_PRESENTATION", label: "Poster Presentation" },
  { value: "PANEL_DISCUSSION", label: "Panel Discussion" },
  { value: "HANDS_ON", label: "Hands-on Activities" },
]

const EVENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  EVENT_TYPE_OPTIONS.map((option) => [option.value, option.label]),
)

export default function AdminTeamsPage() {
  const router = useRouter()
  const list = useAdminList<TeamRow>("/api/admin/teams", {
    initialFilters: { eventType: "" },
  })

  const columns: Column<TeamRow>[] = [
    {
      key: "team",
      header: "Team",
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">{item.name}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            {item._count.members} member{item._count.members === 1 ? "" : "s"}
          </p>
        </div>
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
      key: "leader",
      header: "Leader",
      render: (item) =>
        item.leader ? (
          <div className="min-w-0">
            <p className="truncate text-sm text-text-primary">
              {item.leader.name ?? "Unnamed"}
            </p>
            <p className="truncate text-xs text-text-muted">{item.leader.email}</p>
          </div>
        ) : (
          <span className="text-xs text-text-faint">—</span>
        ),
    },
    {
      key: "created",
      header: "Created",
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
              <UsersRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Teams
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Every team formed for team events, with its event, leader, and member
            count. Open a team to rename or delete it — both actions are written
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
        emptyTitle="No teams yet"
        emptyDescription="Teams will appear here as participants form them for team events, or adjust the filters."
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowClick={(item) => router.push(`/admin/teams/${item.id}` as Route)}
        toolbar={
          <>
            <AdminSearchInput
              value={list.query}
              onChange={list.setQuery}
              placeholder="Search teams by name…"
            />
            <AdminFilterSelect
              value={list.filters.eventType ?? ""}
              onChange={(value) => list.setFilter("eventType", value)}
              options={EVENT_TYPE_OPTIONS}
              allLabel="All events"
              ariaLabel="Filter by event"
            />
          </>
        }
      />
    </div>
  )
}
