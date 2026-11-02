"use client"

import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import * as React from "react"

import { adminFetch, adminMutate, toastApiError, Toggle } from "@/components/admin"
import { Button, Card, Input, Spinner } from "@/components/ui"

type EventSettings = {
  id: string
  name: string
  type: string
  status: string
  registrationOpen: boolean
  startDate: string | null
  endDate: string | null
  registrationDeadline: string | null
  registrationFee: string
  venue: string | null
}

type EventForm = {
  registrationOpen: boolean
  startDate: string
  endDate: string
  registrationDeadline: string
  registrationFee: string
  venue: string
}

function toLocalDateTime(value: string | null): string {
  if (!value) {return ""}
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function toIsoOrNull(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

function toForm(event: EventSettings): EventForm {
  return {
    registrationOpen: event.registrationOpen,
    startDate: toLocalDateTime(event.startDate),
    endDate: toLocalDateTime(event.endDate),
    registrationDeadline: toLocalDateTime(event.registrationDeadline),
    registrationFee: event.registrationFee,
    venue: event.venue ?? "",
  }
}

export default function AdminEventSettingsPage() {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = React.useState<EventSettings | null>(null)
  const [form, setForm] = React.useState<EventForm | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    adminFetch<EventSettings>(`/api/admin/events/${encodeURIComponent(id)}`)
      .then((result) => {
        setEvent(result)
        setForm(toForm(result))
      })
      .catch((err: unknown) => toastApiError(err, "Could not load event settings."))
      .finally(() => setLoading(false))
  }, [id])

  function change<K extends keyof EventForm>(key: K, value: EventForm[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current)
  }

  async function save() {
    if (!form) {return}
    setSaving(true)
    try {
      const updated = await adminMutate<EventSettings>(
        `/api/admin/events/${encodeURIComponent(id)}`,
        "PATCH",
        {
          startDate: toIsoOrNull(form.startDate),
          endDate: toIsoOrNull(form.endDate),
          registrationDeadline: toIsoOrNull(form.registrationDeadline),
          registrationFee: form.registrationFee,
          venue: form.venue,
          registrationOpen: form.registrationOpen,
        },
        { successMessage: "Event settings saved." },
      )
      setEvent(updated)
      setForm(toForm(updated))
    } catch (err) {
      toastApiError(err, "Could not save event settings.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {return <div className="flex justify-center py-20"><Spinner /></div>}
  if (!event || !form) {
    return <div className="space-y-4"><Link href="/admin/events" className="inline-flex items-center gap-2 text-sm text-cyan"><ArrowLeft className="h-4 w-4" />Events</Link><Card>Event settings could not be loaded.</Card></div>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/events" className="inline-flex items-center gap-2 text-sm text-cyan hover:text-cyan/80"><ArrowLeft className="h-4 w-4" />All events</Link>
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan">{event.type} · {event.status}</p>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">{event.name}</h1>
        <p className="mt-1 text-sm text-text-muted">Update dates, registration fee, and registration availability.</p>
      </header>

      <Card className="space-y-6">
        <Toggle
          checked={form.registrationOpen}
          onChange={(checked) => change("registrationOpen", checked)}
          label="Registration open"
          description="Allow participants to submit new registrations for this event."
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Start date and time" type="datetime-local" value={form.startDate} onChange={(e) => change("startDate", e.target.value)} />
          <Input label="End date and time" type="datetime-local" value={form.endDate} onChange={(e) => change("endDate", e.target.value)} />
          <Input label="Registration deadline" type="datetime-local" value={form.registrationDeadline} onChange={(e) => change("registrationDeadline", e.target.value)} />
          <Input label="Registration fee (BDT)" type="number" min="0" step="0.01" value={form.registrationFee} onChange={(e) => change("registrationFee", e.target.value)} />
          <Input label="Venue" value={form.venue} onChange={(e) => change("venue", e.target.value)} maxLength={180} />
        </div>

        <div className="flex justify-end border-t border-border pt-5">
          <Button onClick={() => void save()} loading={saving} leftIcon={<Save className="h-4 w-4" />}>Save event settings</Button>
        </div>
      </Card>
    </div>
  )
}
