// =============================================================================
// Dashboard — Overview
// Server component: summary of registrations, teams, submissions, workshops.
// =============================================================================

import {
  ArrowRight,
  CalendarDays,
  FolderKanban,
  QrCode,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import type { Metadata, Route } from "next"
import Link from "next/link"

import { StatusBadge } from "@/components/dashboard"
import { Alert, Card, CardContent } from "@/components/ui"
import {
  getDashboardProfile,
  getMyPosters,
  getMyProjects,
  getMyRegistrations,
  getMyTeams,
  getMyWorkshopRegistrations,
} from "@/lib/dashboard/queries"
import { getSessionUser } from "@/lib/rbac"

export const metadata: Metadata = {
  title: "Overview",
}

export const dynamic = "force-dynamic"

// ─── Small presentational helpers ─────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  hint?: string
  icon: LucideIcon
  href: Route
}

function StatCard({ label, value, hint, icon: Icon, href }: StatCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-border bg-bg-panel p-5 transition-colors hover:border-cyan/30"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.65rem] uppercase tracking-widest text-text-muted">
          {label}
        </span>
        <Icon className="h-4 w-4 text-text-faint transition-colors group-hover:text-cyan" />
      </div>
      <p className="mt-3 font-display text-3xl font-bold text-text-primary">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-text-faint">{hint}</p> : null}
    </Link>
  )
}

export default async function DashboardOverviewPage() {
  const user = await getSessionUser()
  if (!user) {return null} // Layout guarantees auth; belt-and-braces.

  const [profile, registrations, teams, projects, posters, workshops] =
    await Promise.all([
      getDashboardProfile(user.id),
      getMyRegistrations(user.id),
      getMyTeams(user.id),
      getMyProjects(user.id),
      getMyPosters(user.id),
      getMyWorkshopRegistrations(user.id),
    ])

  const activeRegistrations = registrations.filter(
    (r) => r.status !== "CANCELLED",
  )
  const submissionCount = projects.length + posters.length
  const pendingSubmissions = [...projects, ...posters].filter((s) =>
    ["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUIRED"].includes(s.status),
  ).length
  const recentRegistrations = activeRegistrations.slice(0, 3)

  return (
    <div className="space-y-8">
      {/* ── Profile completeness ─────────────────────────────────────────── */}
      {!profile ? (
        <Alert variant="warning" title="Complete your profile">
          Add your participant details so your registrations, teams, and
          submissions can be attributed correctly.{" "}
          <Link href="/dashboard/profile" className="underline underline-offset-2">
            Complete profile →
          </Link>
        </Alert>
      ) : null}

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Events"
          value={activeRegistrations.length}
          hint="Active registrations"
          icon={CalendarDays}
          href="/dashboard/events"
        />
        <StatCard
          label="Teams"
          value={teams.length}
          hint={teams.length === 1 ? "1 team" : `${teams.length} teams`}
          icon={Users}
          href="/dashboard/team"
        />
        <StatCard
          label="Submissions"
          value={submissionCount}
          hint={
            pendingSubmissions > 0
              ? `${pendingSubmissions} in progress`
              : "All caught up"
          }
          icon={FolderKanban}
          href="/dashboard/submissions"
        />
        <StatCard
          label="Workshops"
          value={workshops.length}
          hint="Seats reserved"
          icon={Wrench}
          href="/dashboard/workshops"
        />
      </div>

      {/* ── Recent registrations ─────────────────────────────────────────── */}
      <Card padding="none">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-sm font-semibold text-text-primary">
              Recent Registrations
            </h2>
            <Link
              href="/dashboard/events"
              className="flex items-center gap-1 font-mono text-xs text-cyan hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {recentRegistrations.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-text-muted">
                You have not registered for any event yet.
              </p>
              <Link href="/register" className="btn-primary mt-4 inline-flex">
                Register Now
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentRegistrations.map((reg) => (
                <li
                  key={reg.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {reg.eventName}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-text-faint">
                      {reg.registrationId}
                      {reg.teamName ? ` · Team "${reg.teamName}"` : ""}
                    </p>
                  </div>
                  <StatusBadge status={reg.status} size="sm" />
                  <Link
                    href="/dashboard/qr"
                    className="flex items-center gap-1 font-mono text-xs text-cyan hover:underline"
                  >
                    <QrCode className="h-3 w-3" /> QR
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Quick actions ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          href="/dashboard/profile"
          className="flex items-center gap-3 rounded-lg border border-border bg-bg-panel p-4 text-sm text-text-muted transition-colors hover:border-cyan/30 hover:text-text-primary"
        >
          <UserCog className="h-4 w-4 text-cyan" />
          Edit Profile
        </Link>
        <Link
          href="/dashboard/documents"
          className="flex items-center gap-3 rounded-lg border border-border bg-bg-panel p-4 text-sm text-text-muted transition-colors hover:border-cyan/30 hover:text-text-primary"
        >
          <FolderKanban className="h-4 w-4 text-cyan" />
          Documents &amp; Confirmation Passes
        </Link>
        <Link
          href="/dashboard/qr"
          className="flex items-center gap-3 rounded-lg border border-border bg-bg-panel p-4 text-sm text-text-muted transition-colors hover:border-cyan/30 hover:text-text-primary"
        >
          <QrCode className="h-4 w-4 text-cyan" />
          Show QR Pass
        </Link>
      </div>
    </div>
  )
}
