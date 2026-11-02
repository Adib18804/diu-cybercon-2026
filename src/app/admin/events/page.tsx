"use client"

import { ArrowRight, CalendarDays } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import * as React from "react"

import { adminFetch, StatusPill, toastApiError } from "@/components/admin"
import { Card, Spinner } from "@/components/ui"

type EventRow = {
  id: string
  name: string
  type: string
  status: string
  registrationOpen: boolean
  registrationDeadline: string | null
  registrationFee: string
  venue: string | null
}

export default function AdminEventsPage() {
  const [events, setEvents] = React.useState<EventRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    adminFetch<EventRow[]>("/api/admin/events")
      .then(setEvents)
      .catch((err: unknown) => toastApiError(err, "Could not load events."))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {return <div className="flex justify-center py-20"><Spinner /></div>}

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan">Program controls</p>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">Events</h1>
        <p className="mt-1 text-sm text-text-muted">Manage event dates, registration deadlines, fees, and registration availability.</p>
      </header>
      {events.length === 0 ? (
        <Card className="p-8 text-center text-sm text-text-muted">No events found.</Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {events.map((event) => (
            <Link key={event.id} href={`/admin/events/${event.id}` as Route} className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan">
              <Card hover className="h-full">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-cyan" /><span className="font-mono text-xs text-text-faint">{event.type}</span></div>
                    <h2 className="mt-3 text-lg font-semibold text-text-primary">{event.name}</h2>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-text-muted" />
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-text-muted">
                  <StatusPill status={event.status} />
                  <span>Registration {event.registrationOpen ? "open" : "closed"}</span>
                  <span>Fee: ৳{event.registrationFee}</span>
                  {event.venue && <span>Venue: {event.venue}</span>}
                  {event.registrationDeadline && <span>Deadline: {new Date(event.registrationDeadline).toLocaleDateString()}</span>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
