"use client"

// =============================================================================
// Admin Dashboard — /admin
// Live metrics from /api/admin/stats (permission-gated server-side), a
// 30-day registrations chart, university distribution, and a recent-activity
// feed. A card is rendered only when the API returned its key — roles that
// lack the underlying permission simply never see it.
// =============================================================================

import {
  Activity,
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
import type { Route } from "next"
import * as React from "react"

import {
  AdminBarChart,
  AdminLineChart,
  AdminPieChart,
  AdminStatCard,
  adminFetch,
  toastApiError,
  type StatAccent,
} from "@/components/admin"
import type { AdminStatKey, AdminStatsPayload } from "@/lib/admin/stats"
import { cn, relativeTime } from "@/lib/utils"

// ─── Card definitions ─────────────────────────────────────────────────────────

interface CardDef {
  key: AdminStatKey
  label: string
  icon: LucideIcon
  accent: StatAccent
  href?: Route
}

const CARD_DEFS: CardDef[] = [
  { key: "totalParticipants", label: "Total Participants", icon: Users, accent: "cyan", href: "/admin/participants" },
  { key: "verified", label: "Verified", icon: ShieldCheck, accent: "neon" },
  { key: "pendingVerification", label: "Pending Verification", icon: ShieldAlert, accent: "amber", href: "/admin/verifications" },
  { key: "totalTeams", label: "Total Teams", icon: UsersRound, accent: "cyan", href: "/admin/teams" },
  { key: "ctfTeams", label: "CTF Teams", icon: Flag, accent: "violet", href: "/admin/teams" },
  { key: "traceRouteParticipants", label: "Trace & Route", icon: RouteIcon, accent: "cyan", href: "/admin/registrations" },
  { key: "projectTeams", label: "Project Showcase", icon: FolderKanban, accent: "violet", href: "/admin/projects" },
  { key: "posterTeams", label: "Poster Teams", icon: FileImage, accent: "pink", href: "/admin/posters" },
  { key: "workshopRegistrations", label: "Workshop Registrations", icon: Wrench, accent: "amber", href: "/admin/workshops" },
  { key: "sponsorApplications", label: "Sponsor Applications", icon: Inbox, accent: "neon", href: "/admin/sponsor-apps" },
  { key: "totalAdmins", label: "Admin Users", icon: UserCog, accent: "muted", href: "/admin/roles" },
]

// ─── Activity helpers ─────────────────────────────────────────────────────────

function humanizeAction(action: string): string {
  const lower = action.replace(/_/g, " ").toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [stats, setStats] = React.useState<AdminStatsPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)

  const load = React.useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {setRefreshing(true)}
    try {
      const data = await adminFetch<AdminStatsPayload>("/api/admin/stats")
      setStats(data)
    } catch (err) {
      toastApiError(err, "Could not load dashboard stats.")
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

  const hasCharts =
    stats !== null &&
    (stats.registrationsByDay.some((p) => p.value > 0) ||
      stats.universityDistribution.length > 0)

  const hasAnything =
    loading || visibleCards.length > 0 || hasCharts || (stats?.recentActivity.length ?? 0) > 0

  return (
    <div className="space-y-6">
      {/* ── Header row ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-text-primary">
            Overview
          </h2>
          <p className="mt-0.5 text-xs text-text-muted">
            Live counts from the registration and submission systems.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan",
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

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-[104px] animate-pulse rounded-lg border border-border bg-bg-panel"
            />
          ))}
        </div>
      ) : (
        visibleCards.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {visibleCards.map((def) => (
              <AdminStatCard
                key={def.key}
                label={def.label}
                value={stats?.cards[def.key] ?? 0}
                icon={def.icon}
                accent={def.accent}
                href={def.href}
              />
            ))}
          </div>
        )
      )}

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      {!loading && hasCharts && stats && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <AdminLineChart
            title="Registrations — last 30 days"
            description="Event registrations created per day."
            data={stats.registrationsByDay}
            className="xl:col-span-2"
          />
          <AdminPieChart
            title="University distribution"
            description="Participants by institution (top 10)."
            data={stats.universityDistribution}
          />
          <AdminBarChart
            title="Top universities"
            description="Ranked by participant count."
            data={stats.universityDistribution}
            orientation="horizontal"
            className="xl:col-span-3"
          />
        </div>
      )}

      {/* ── Recent activity ───────────────────────────────────────────────── */}
      {!loading && stats && stats.recentActivity.length > 0 && (
        <div className="rounded-lg border border-border bg-bg-panel p-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan" aria-hidden="true" />
            <p className="font-mono text-micro uppercase tracking-wider text-text-muted">
              Recent activity
            </p>
          </div>
          <ul className="mt-3 divide-y divide-border-subtle">
            {stats.recentActivity.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan/70"
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm text-text-primary">
                    {humanizeAction(item.action)}
                  </span>
                  <span className="hidden shrink-0 font-mono text-micro uppercase tracking-wider text-text-faint sm:inline">
                    {item.targetType}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3 pl-4">
                  <span className="text-xs text-text-muted">{item.actorName}</span>
                  <span className="font-mono text-micro uppercase tracking-wider text-text-faint">
                    {relativeTime(new Date(item.createdAt))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Nothing visible for this role ─────────────────────────────────── */}
      {!loading && stats && !hasAnything && (
        <div className="rounded-lg border border-dashed border-border bg-bg-panel/50 px-6 py-12 text-center">
          <p className="text-sm font-medium text-text-primary">
            No dashboard metrics for your role
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-text-muted">
            Your admin role focuses on specific sections. Use the navigation to
            manage the area you are responsible for.
          </p>
        </div>
      )}
    </div>
  )
}
