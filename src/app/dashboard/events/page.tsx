// =============================================================================
// Dashboard — My Events
// All event registrations with status, team info, QR pass and PDF download.
// =============================================================================

import { CalendarDays, Download, QrCode, Ticket } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { EmptyState, StatusBadge } from "@/components/dashboard"
import { Card, CardContent } from "@/components/ui"
import { getMyRegistrations } from "@/lib/dashboard/queries"
import { getSessionUser } from "@/lib/rbac"
import { formatDate } from "@/lib/utils"

export const metadata: Metadata = {
  title: "My Events",
}

export const dynamic = "force-dynamic"

export default async function DashboardEventsPage() {
  const user = await getSessionUser()
  if (!user) {return null}

  const registrations = await getMyRegistrations(user.id)
  const active = registrations.filter((r) => r.status !== "CANCELLED")
  const cancelled = registrations.filter((r) => r.status === "CANCELLED")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-text-primary">
          My Events
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Your event registrations, check-in status, and confirmation passes.
        </p>
      </div>

      {registrations.length === 0 ? (
        <EmptyState
          icon={<Ticket className="h-6 w-6" />}
          title="No registrations yet"
          description="Register for CTF, Project Showcase, Poster Presentation, Trace & Route, or Hands-on Activities to get your QR pass."
          action={
            <Link href="/register" className="btn-primary">
              Register for an Event
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {[...active, ...cancelled].map((reg) => {
            const isCancelled = reg.status === "CANCELLED"
            return (
              <Card key={reg.id} padding="none">
                <CardContent className="p-0">
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-semibold text-text-primary">
                          {reg.eventName}
                        </h3>
                        <StatusBadge status={reg.status} size="sm" />
                        {reg.status === "CONFIRMED" ? (
                          <StatusBadge status={reg.checkInStatus} size="sm" />
                        ) : null}
                      </div>

                      <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1.5 text-xs sm:grid-cols-2">
                        <div className="flex gap-2">
                          <dt className="text-text-faint">Registration ID</dt>
                          <dd className="font-mono text-text-muted">
                            {reg.registrationId}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-text-faint">Registered</dt>
                          <dd className="text-text-muted">
                            {formatDate(reg.createdAt)}
                          </dd>
                        </div>
                        {reg.teamName ? (
                          <div className="flex gap-2">
                            <dt className="text-text-faint">Team</dt>
                            <dd className="text-text-muted">
                              {reg.teamName}
                              {reg.isLeader ? " (leader)" : ""}
                            </dd>
                          </div>
                        ) : null}
                        {reg.isTeamEvent && !reg.teamName ? (
                          <div className="flex gap-2">
                            <dt className="text-text-faint">Team</dt>
                            <dd className="text-text-muted">Individual entry</dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>

                    {!isCancelled ? (
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Link
                          href="/dashboard/qr"
                          className="btn-secondary !px-3 !py-1.5 !text-xs"
                        >
                          <QrCode className="mr-1.5 h-3.5 w-3.5" />
                          QR Pass
                        </Link>
                        <a
                          href={`/api/registrations/${reg.registrationId}/confirmation`}
                          className="btn-primary !px-3 !py-1.5 !text-xs"
                          download
                        >
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                          Download Pass
                        </a>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {active.length === 0 && registrations.length > 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-panel p-4 text-sm text-text-muted">
          <CalendarDays className="h-4 w-4 shrink-0 text-cyan" />
          All your registrations are currently cancelled. Register again from the
          events page if you would like to participate.
        </div>
      ) : null}
    </div>
  )
}
