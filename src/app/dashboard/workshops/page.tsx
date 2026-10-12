// =============================================================================
// Dashboard — My Workshops
// Hands-on activity registrations with schedule, venue and preparation notes.
// =============================================================================

import { CalendarDays, Clock, MapPin, Wrench } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { EmptyState, StatusBadge } from "@/components/dashboard"
import { Card, CardContent } from "@/components/ui"
import { getMyWorkshopRegistrations } from "@/lib/dashboard/queries"
import { getSessionUser } from "@/lib/rbac"
import { formatDate } from "@/lib/utils"

export const metadata: Metadata = {
  title: "My Workshops",
}

export const dynamic = "force-dynamic"

const SKILL_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
}

export default async function DashboardWorkshopsPage() {
  const user = await getSessionUser()
  if (!user) {return null}

  const registrations = await getMyWorkshopRegistrations(user.id)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-text-primary">
          My Workshops
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Your Hands-on Activities registrations, schedules, and preparation notes.
        </p>
      </div>

      {registrations.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-6 w-6" />}
          title="No workshop registrations yet"
          description="Hands-on Activities have limited seats per session. Reserve your seat from the workshops page."
          action={
            <Link href="/events/workshops" className="btn-primary">
              Browse Workshops
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {registrations.map((reg) => {
            return (
              <Card key={reg.id} padding="none">
                <CardContent className="p-0">
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-semibold text-text-primary">
                          {reg.title}
                        </h3>
                        <StatusBadge status={reg.workshopStatus} size="sm" />
                        <span className="rounded-full border border-cyan/30 bg-cyan/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-cyan">
                          {SKILL_LABELS[reg.skillLevel] ?? reg.skillLevel}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-text-muted">
                        Instructor:{" "}
                        <span className="text-text-primary">
                          {reg.instructorName}
                        </span>{" "}
                        <span className="text-text-faint">
                          ({reg.instructorOrg})
                        </span>
                      </p>

                      <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1.5 text-xs sm:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-3.5 w-3.5 text-text-faint" />
                          <dt className="sr-only">Date</dt>
                          <dd className="text-text-muted">
                            {formatDate(reg.date)}
                          </dd>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-text-faint" />
                          <dt className="sr-only">Time</dt>
                          <dd className="text-text-muted">
                            {reg.startTime}–{reg.endTime}
                          </dd>
                        </div>
                        <div className="flex items-center gap-2 sm:col-span-2">
                          <MapPin className="h-3.5 w-3.5 text-text-faint" />
                          <dt className="sr-only">Venue</dt>
                          <dd className="text-text-muted">{reg.venue}</dd>
                        </div>
                        <div className="flex gap-2 sm:col-span-2">
                          <dt className="text-text-faint">Registered</dt>
                          <dd className="text-text-muted">
                            {formatDate(reg.registeredAt)}
                          </dd>
                        </div>
                      </dl>

                      {reg.requiredEquipment ? (
                        <p className="mt-3 text-xs text-text-muted">
                          <span className="font-mono uppercase tracking-widest text-text-faint">
                            Bring:
                          </span>{" "}
                          {reg.requiredEquipment}
                        </p>
                      ) : null}
                      {reg.prerequisites ? (
                        <p className="mt-1 text-xs text-text-muted">
                          <span className="font-mono uppercase tracking-widest text-text-faint">
                            Prerequisites:
                          </span>{" "}
                          {reg.prerequisites}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
