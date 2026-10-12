"use client"

// =============================================================================
// Admin — Analytics (/admin/analytics)
// Deeper, read-only view over the same permission-gated aggregation the
// dashboard renders (GET /api/admin/stats). The API only returns the card
// keys, series and distributions the admin's role actually grants — absent
// keys render nothing and sections without data show an honest "No data yet"
// note instead of a fabricated series.
// =============================================================================

import {
  BarChart3,
  FileImage,
  Flag,
  FolderKanban,
  Inbox,
  RefreshCw,
  Route as RouteIcon,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import * as React from "react"

import {
  AdminLineChart,
  AdminPieChart,
  AdminStatCard,
  ChartBreakdown,
  adminFetch,
  toastApiError,
  type StatAccent,
} from "@/components/admin"
import type { AdminStatKey, AdminStatsPayload } from "@/lib/admin/stats"
import { cn, relativeTime } from "@/lib/utils"

// ─── Card definitions ─────────────────────────────────────────────────────────
// Every definition maps 1:1 to a real AdminStatKey from the stats payload —
// a card only renders when the API actually returned that key for this role.

interface CardDef {
  key: AdminStatKey
  label: string
  hint: string
  icon: LucideIcon
  accent: StatAccent
}

const CARD_DEFS: CardDef[] = [
  {
    key: "totalParticipants",
    label: "Total participants",
    hint: "Participant profiles on record",
    icon: Users,
    accent: "cyan",
  },
  {
    key: "verified",
    label: "Verified",
    hint: "Student verifications approved",
    icon: ShieldCheck,
    accent: "neon",
  },
  {
    key: "pendingVerification",
    label: "Pending verification",
    hint: "Student verifications awaiting review",
    icon: ShieldAlert,
    accent: "amber",
  },
  {
    key: "totalTeams",
    label: "Active teams",
    hint: "Teams not archived",
    icon: UsersRound,
    accent: "cyan",
  },
  {
    key: "ctfTeams",
    label: "CTF teams",
    hint: "Teams registered for the CTF event",
    icon: Flag,
    accent: "violet",
  },
  {
    key: "traceRouteParticipants",
    label: "Trace & Route",
    hint: "Non-cancelled registrations",
    icon: RouteIcon,
    accent: "cyan",
  },
  {
    key: "projectTeams",
    label: "Project showcase",
    hint: "Non-cancelled registrations",
    icon: FolderKanban,
    accent: "violet",
  },
  {
    key: "posterTeams",
    label: "Poster presentations",
    hint: "Non-cancelled registrations",
    icon: FileImage,
    accent: "pink",
  },
  {
    key: "workshopRegistrations",
    label: "Workshop registrations",
    hint: "Sign-ups across all workshops",
    icon: Wrench,
    accent: "amber",
  },
  {
    key: "sponsorApplications",
    label: "Sponsor applications",
    hint: "Applications received from sponsors",
    icon: Inbox,
    accent: "neon",
  },
  {
    key: "totalAdmins",
    label: "Admin users",
    hint: "Users with the ADMIN or STAFF role",
    icon: UserCog,
    accent: "muted",
  },
]

// ─── Local building block ─────────────────────────────────────────────────────

/** Card-shaped placeholder used when a section has no real data to draw. */
function EmptySection({
  title,
  description,
  className,
}: {
  title: string
  description: string
  className?: string
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-bg-panel p-4", className)}>
      <p className="font-mono text-micro uppercase tracking-wider text-text-muted">
        {title}
      </p>
      <div className="mt-3 flex h-[260px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border px-4 text-center">
        <p className="text-sm text-text-muted">No data yet</p>
        <p className="max-w-xs text-xs leading-relaxed text-text-faint">
          {description}
        </p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const [stats, setStats] = React.useState<AdminStatsPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [loadError, setLoadError] = React.useState(false)

  const load = React.useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {setRefreshing(true)}
    try {
      const data = await adminFetch<AdminStatsPayload>("/api/admin/stats")
      setStats(data)
      setLoadError(false)
    } catch (err) {
      toastApiError(err, "Could not load analytics.")
      setLoadError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    void load(false)
  }, [load])

  const visibleCards = React.useMemo(
    () =>
      CARD_DEFS.filter(
        (def) => stats !== null && stats.cards[def.key] !== undefined,
      ),
    [stats],
  )

  const hasRegistrationsChart =
    stats !== null && stats.registrationsByDay.some((point) => point.value > 0)

  const universityTotal =
    stats?.universityDistribution.reduce((sum, point) => sum + point.value, 0) ??
    0

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/5 text-cyan">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Analytics
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Headline metrics and trends for the conference, drawn directly from
            live registration, verification and submission data. Only the
            sections your admin role can access are counted.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-md border border-border bg-bg-elevated px-3 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan",
            (loading || refreshing) && "cursor-wait opacity-60",
          )}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>

      {/* ── Loading skeleton ───────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-[128px] animate-pulse rounded-lg border border-border bg-bg-panel"
              />
            ))}
          </div>
          <div className="h-[320px] animate-pulse rounded-lg border border-border bg-bg-panel" />
        </div>
      )}

      {/* ── Load failure (e.g. missing permission) ─────────────────────────── */}
      {!loading && loadError && stats === null && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-pink/30 bg-pink/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-text-primary">
              Could not load analytics data
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
              Your admin role may not grant access to these metrics, or the
              server had a problem. Try again, or contact a super admin if this
              persists.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan",
              refreshing && "cursor-wait opacity-60",
            )}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
              aria-hidden="true"
            />
            Try again
          </button>
        </div>
      )}

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      {!loading &&
        stats &&
        (visibleCards.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {visibleCards.map((def) => (
              <AdminStatCard
                key={def.key}
                label={def.label}
                value={stats?.cards[def.key] ?? 0}
                icon={def.icon}
                accent={def.accent}
                hint={def.hint}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-bg-panel/50 px-6 py-10 text-center">
            <p className="text-sm font-medium text-text-primary">
              No headline metrics for your role
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-text-muted">
              Analytics only surfaces the numbers your admin role grants access
              to. Use the navigation to manage the area you are responsible for.
            </p>
          </div>
        ))}

      {/* ── Trends & distributions ─────────────────────────────────────────── */}
      {!loading && stats && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {hasRegistrationsChart ? (
            <AdminLineChart
              title="Registrations — last 30 days"
              description="Event registrations created per day."
              data={stats.registrationsByDay}
              className="xl:col-span-2"
            />
          ) : (
            <EmptySection
              title="Registrations — last 30 days"
              description="Daily registration counts will appear here once registrations arrive and your role may view them."
              className="xl:col-span-2"
            />
          )}

          {universityTotal > 0 ? (
            <AdminPieChart
              title="University distribution"
              description="Share of participants per institution (top 10)."
              data={stats.universityDistribution}
            />
          ) : (
            <EmptySection
              title="University distribution"
              description="Participant counts per institution will appear once participants are on record."
            />
          )}

          <div className="rounded-lg border border-border bg-bg-panel p-4 xl:col-span-3">
            <p className="font-mono text-micro uppercase tracking-wider text-text-muted">
              University share
            </p>
            <p className="mt-1 text-xs text-text-faint">
              Participant count per institution, with each university&apos;s
              share of the total (top 10).
            </p>
            {universityTotal > 0 ? (
              <ChartBreakdown data={stats.universityDistribution} />
            ) : (
              <p className="mt-3 rounded-md border border-dashed border-border px-4 py-6 text-center text-xs text-text-faint">
                No data yet
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Footnote ───────────────────────────────────────────────────────── */}
      {!loading && stats && (
        <p className="text-xs leading-relaxed text-text-faint">
          Sections are permission-gated — only the metrics your admin role can
          access are counted and shown. Generated{" "}
          {relativeTime(new Date(stats.generatedAt))}.
        </p>
      )}
    </div>
  )
}
