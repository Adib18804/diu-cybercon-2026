"use client"

// =============================================================================
// Admin — Schedule list (/admin/schedule)
// Conference schedule grouped by day (Day 1–3 tabs). Rows open the edit
// dialog; "Add session" creates a new schedule item. Linked events come from
// /api/events and speakers from /api/admin/speakers.
// =============================================================================

import { CalendarDays, Plus, RefreshCw, Star } from "lucide-react"
import * as React from "react"
import toast from "react-hot-toast"

import {
  AdminApiError,
  adminFetch,
  adminMutate,
  AdminSearchInput,
  DataTable,
  FormGrid,
  StatusPill,
  Toggle,
  humanizeStatus,
  toastApiError,
  useAdminList,
  type Column,
} from "@/components/admin"
import {
  Button,
  ConfirmModal,
  Input,
  Modal,
  Select,
  Tabs,
  Textarea,
} from "@/components/ui"
import { cn, formatDate } from "@/lib/utils"

// ─── Types (mirror GET /api/admin/schedule) ──────────────────────────────────

type ScheduleSpeaker = { id: string; name: string }

type ScheduleEvent = { id: string; name: string; type: string }

type ScheduleRow = {
  id: string
  day: number
  date: string
  startTime: string
  endTime: string
  title: string
  description: string | null
  venue: string | null
  type: string
  eventId: string | null
  speakerId: string | null
  isHighlight: boolean
  displayOrder: number
  event: ScheduleEvent | null
  speaker: ScheduleSpeaker | null
}

// ─── Options ──────────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: "SESSION", label: "Session" },
  { value: "WORKSHOP", label: "Workshop" },
  { value: "COMPETITION", label: "Competition" },
  { value: "CEREMONY", label: "Ceremony" },
  { value: "BREAK", label: "Break" },
]

const DAY_TABS = [
  { value: "1", label: "Day 1" },
  { value: "2", label: "Day 2" },
  { value: "3", label: "Day 3" },
]

const DAY_OPTIONS = [
  { value: "1", label: "Day 1" },
  { value: "2", label: "Day 2" },
  { value: "3", label: "Day 3" },
]

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

// ─── Form state ───────────────────────────────────────────────────────────────

type ScheduleFormState = {
  day: string
  date: string
  startTime: string
  endTime: string
  title: string
  description: string
  venue: string
  type: string
  eventId: string
  speakerId: string
  isHighlight: boolean
  displayOrder: string
}

const EMPTY_FORM: ScheduleFormState = {
  day: "1",
  date: "",
  startTime: "",
  endTime: "",
  title: "",
  description: "",
  venue: "",
  type: "SESSION",
  eventId: "",
  speakerId: "",
  isHighlight: false,
  displayOrder: "0",
}

function rowToForm(row: ScheduleRow): ScheduleFormState {
  return {
    day: String(row.day),
    date: row.date ? row.date.slice(0, 10) : "",
    startTime: row.startTime,
    endTime: row.endTime,
    title: row.title,
    description: row.description ?? "",
    venue: row.venue ?? "",
    type: row.type,
    eventId: row.eventId ?? "",
    speakerId: row.speakerId ?? "",
    isHighlight: row.isHighlight,
    displayOrder: String(row.displayOrder),
  }
}

/** Light client-side pre-check mirroring scheduleItemCreateSchema. */
function validateForm(form: ScheduleFormState): Record<string, string> {
  const errors: Record<string, string> = {}
  const day = Number(form.day)
  if (!Number.isInteger(day) || day < 1 || day > 3) {
    errors.day = "Select a day between 1 and 3."
  }
  if (!form.date) {
    errors.date = "Enter the session date."
  }
  if (!TIME_PATTERN.test(form.startTime.trim())) {
    errors.startTime = "Use 24-hour time format HH:MM."
  }
  if (!TIME_PATTERN.test(form.endTime.trim())) {
    errors.endTime = "Use 24-hour time format HH:MM."
  }
  if (form.title.trim().length < 3) {
    errors.title = "Title is required."
  }
  if (form.description.trim().length > 1000) {
    errors.description = "Description must be at most 1000 characters."
  }
  if (form.type.trim().length < 2) {
    errors.type = "Type is required."
  }
  const order = Number(form.displayOrder)
  if (!Number.isInteger(order) || order < 0 || order > 9999) {
    errors.displayOrder = "Display order must be between 0 and 9999."
  }
  return errors
}

/**
 * All keys are always sent — empty strings for eventId/speakerId/venue are
 * transformed away by the schema, and the raw keys signal "clear" to the API.
 */
function buildPayload(form: ScheduleFormState): Record<string, unknown> {
  return {
    day: form.day,
    date: form.date,
    startTime: form.startTime.trim(),
    endTime: form.endTime.trim(),
    title: form.title.trim(),
    description: form.description.trim(),
    venue: form.venue.trim(),
    type: form.type,
    eventId: form.eventId,
    speakerId: form.speakerId,
    isHighlight: form.isHighlight,
    displayOrder: form.displayOrder,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSchedulePage() {
  const list = useAdminList<ScheduleRow>("/api/admin/schedule", {
    initialFilters: { day: "1" },
  })

  // ── Link options (events + speakers) ───────────────────────────────────────
  const [events, setEvents] = React.useState<ScheduleEvent[]>([])
  const [speakers, setSpeakers] = React.useState<ScheduleSpeaker[]>([])

  React.useEffect(() => {
    let cancelled = false

    async function loadOptions() {
      try {
        const [eventList, speakerData] = await Promise.all([
          adminFetch<ScheduleEvent[]>("/api/events"),
          adminFetch<{ items: ScheduleSpeaker[] }>(
            "/api/admin/speakers?pageSize=100",
          ),
        ])
        if (cancelled) {return}
        setEvents(eventList)
        setSpeakers(speakerData.items)
      } catch (err) {
        if (cancelled) {return}
        toastApiError(err, "Could not load event and speaker options.")
      }
    }

    void loadOptions()
    return () => {
      cancelled = true
    }
  }, [])

  // ── Dialog state — one modal for create + edit ─────────────────────────────
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ScheduleRow | null>(null)
  const [form, setForm] = React.useState<ScheduleFormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)

  // ── Delete state ───────────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const update = React.useCallback((patch: Partial<ScheduleFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const openCreate = React.useCallback(() => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, day: list.filters.day ?? "1" })
    setFieldErrors({})
    setModalOpen(true)
  }, [list.filters.day])

  const openEdit = React.useCallback((row: ScheduleRow) => {
    setEditing(row)
    setForm(rowToForm(row))
    setFieldErrors({})
    setModalOpen(true)
  }, [])

  const handleSave = React.useCallback(async () => {
    const errors = validateForm(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      toast.error("Please fix the highlighted fields.")
      return
    }

    setSaving(true)
    setFieldErrors({})
    try {
      if (editing) {
        await adminMutate(
          `/api/admin/schedule/${editing.id}`,
          "PATCH",
          buildPayload(form),
          { successMessage: "Schedule item updated." },
        )
      } else {
        await adminMutate("/api/admin/schedule", "POST", buildPayload(form), {
          successMessage: "Schedule item created.",
        })
      }
      setModalOpen(false)
      setEditing(null)
      setForm(EMPTY_FORM)
      list.refresh()
    } catch (err) {
      if (err instanceof AdminApiError && err.details) {
        const mapped: Record<string, string> = {}
        for (const [key, messages] of Object.entries(err.details)) {
          if (messages?.[0]) {mapped[key] = messages[0]}
        }
        setFieldErrors(mapped)
      }
      toastApiError(
        err,
        editing
          ? "Could not update the schedule item."
          : "Could not create the schedule item.",
      )
    } finally {
      setSaving(false)
    }
  }, [editing, form, list])

  const handleDelete = React.useCallback(async () => {
    if (!editing) {return}
    setDeleting(true)
    try {
      await adminMutate(`/api/admin/schedule/${editing.id}`, "DELETE", undefined, {
        successMessage: "Schedule item deleted.",
      })
      setDeleteOpen(false)
      setModalOpen(false)
      setEditing(null)
      setForm(EMPTY_FORM)
      list.refresh()
    } catch (err) {
      toastApiError(err, "Could not delete the schedule item.")
    } finally {
      setDeleting(false)
    }
  }, [editing, list])

  // Keep a legacy type value (not in the convention list) selectable while
  // editing so an unrelated save never silently drops it.
  const typeOptions = React.useMemo(() => {
    if (
      editing &&
      editing.type &&
      !TYPE_OPTIONS.some((option) => option.value === editing.type)
    ) {
      return [
        ...TYPE_OPTIONS,
        { value: editing.type, label: humanizeStatus(editing.type) },
      ]
    }
    return TYPE_OPTIONS
  }, [editing])

  const eventOptions = React.useMemo(() => {
    const options = events.map((event) => ({
      value: event.id,
      label: event.name,
    }))
    if (
      editing?.eventId &&
      !options.some((option) => option.value === editing.eventId)
    ) {
      options.unshift({
        value: editing.eventId,
        label: editing.event?.name ?? "Current linked event",
      })
    }
    return [{ value: "", label: "No linked event" }, ...options]
  }, [editing, events])

  const speakerOptions = React.useMemo(() => {
    const options = speakers.map((speaker) => ({
      value: speaker.id,
      label: speaker.name,
    }))
    if (
      editing?.speakerId &&
      !options.some((option) => option.value === editing.speakerId)
    ) {
      options.unshift({
        value: editing.speakerId,
        label: editing.speaker?.name ?? "Current speaker",
      })
    }
    return [{ value: "", label: "No speaker" }, ...options]
  }, [editing, speakers])

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: Column<ScheduleRow>[] = [
    {
      key: "time",
      header: "Time",
      render: (item) => (
        <span className="whitespace-nowrap font-mono text-xs tabular-nums text-text-primary">
          {item.startTime}–{item.endTime}
        </span>
      ),
    },
    {
      key: "title",
      header: "Title",
      render: (item) => (
        <div className="min-w-0 max-w-[18rem]">
          <p className="flex items-center gap-1.5 truncate font-medium text-text-primary">
            {item.isHighlight && (
              <Star
                className="h-3.5 w-3.5 shrink-0 text-amber"
                fill="currentColor"
                aria-hidden="true"
              />
            )}
            <span className="truncate">{item.title}</span>
          </p>
          {item.description && (
            <p className="mt-0.5 truncate text-xs text-text-muted">
              {item.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (item) => <StatusPill status={item.type} />,
    },
    {
      key: "venue",
      header: "Venue",
      desktopOnly: true,
      render: (item) => (
        <span className="block max-w-[12rem] truncate text-sm text-text-muted">
          {item.venue ?? "—"}
        </span>
      ),
    },
    {
      key: "day",
      header: "Day",
      render: (item) => (
        <span className="whitespace-nowrap text-sm text-text-primary">
          Day {item.day}
        </span>
      ),
    },
    {
      key: "event",
      header: "Event",
      desktopOnly: true,
      render: (item) => (
        <span className="block max-w-[12rem] truncate text-sm text-text-muted">
          {item.event?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "speaker",
      header: "Speaker",
      desktopOnly: true,
      render: (item) => (
        <span className="block max-w-[12rem] truncate text-sm text-text-muted">
          {item.speaker?.name ?? "—"}
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
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Schedule
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            The three-day conference program. Switch days with the tabs; click a
            row to edit a session, or add a new one to the selected day.
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

      {/* ── Day tabs ───────────────────────────────────────────────────────── */}
      <Tabs
        tabs={DAY_TABS}
        value={list.filters.day ?? "1"}
        onChange={(value) => list.setFilter("day", value)}
        variant="underline"
        layoutId="admin-schedule-day-tabs"
      />

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        items={list.items}
        rowKey={(item) => item.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.refresh}
        emptyTitle="No sessions for this day"
        emptyDescription="Add the first session for this day, or switch to another day."
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowClick={openEdit}
        toolbar={
          <>
            <AdminSearchInput
              value={list.query}
              onChange={list.setQuery}
              placeholder="Search sessions by title…"
            />
            <Button
              size="sm"
              className="sm:ml-auto"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={openCreate}
            >
              Add session
            </Button>
          </>
        }
      />

      {/* ── Create / edit dialog ───────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => {
          if (!saving) {setModalOpen(false)}
        }}
        title={editing ? "Edit session" : "Add session"}
        description="All fields are validated again on the server before saving."
        size="lg"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSave()}
              loading={saving}
              loadingText={editing ? "Saving…" : "Creating…"}
            >
              {editing ? "Save changes" : "Add session"}
            </Button>
          </>
        }
      >
        <FormGrid cols={2}>
          <div className="sm:col-span-2">
            <Input
              label="Title"
              required
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
              maxLength={200}
              placeholder="e.g. Opening ceremony"
              error={fieldErrors.title}
            />
          </div>

          <Select
            label="Type"
            required
            value={form.type}
            onChange={(e) => update({ type: e.target.value })}
            options={typeOptions}
            error={fieldErrors.type}
          />
          <Select
            label="Day"
            required
            value={form.day}
            onChange={(e) => update({ day: e.target.value })}
            options={DAY_OPTIONS}
            error={fieldErrors.day}
          />

          <Input
            label="Date"
            type="date"
            required
            value={form.date}
            onChange={(e) => update({ date: e.target.value })}
            error={fieldErrors.date}
          />
          <Input
            label="Venue"
            value={form.venue}
            onChange={(e) => update({ venue: e.target.value })}
            maxLength={150}
            placeholder="e.g. Main Auditorium"
            error={fieldErrors.venue}
          />

          <Input
            label="Start time"
            required
            value={form.startTime}
            onChange={(e) => update({ startTime: e.target.value })}
            placeholder="HH:MM"
            maxLength={5}
            className="font-mono"
            error={fieldErrors.startTime}
          />
          <Input
            label="End time"
            required
            value={form.endTime}
            onChange={(e) => update({ endTime: e.target.value })}
            placeholder="HH:MM"
            maxLength={5}
            className="font-mono"
            error={fieldErrors.endTime}
          />

          <Select
            label="Linked event"
            value={form.eventId}
            onChange={(e) => update({ eventId: e.target.value })}
            options={eventOptions}
            helper="Optional — links this session to an event page."
            error={fieldErrors.eventId}
          />
          <Select
            label="Speaker"
            value={form.speakerId}
            onChange={(e) => update({ speakerId: e.target.value })}
            options={speakerOptions}
            helper="Optional — shown beside the session."
            error={fieldErrors.speakerId}
          />

          <Input
            label="Display order"
            type="number"
            min={0}
            max={9999}
            value={form.displayOrder}
            onChange={(e) => update({ displayOrder: e.target.value })}
            helper="Lower numbers appear first within the same start time."
            error={fieldErrors.displayOrder}
          />
          <div className="flex items-end pb-1">
            <Toggle
              checked={form.isHighlight}
              onChange={(checked) => update({ isHighlight: checked })}
              label="Highlight on the public schedule"
              description="Adds a star marker to this session."
            />
          </div>

          <div className="sm:col-span-2">
            <Textarea
              label="Description"
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              maxLength={1000}
              showCount
              placeholder="A short summary of the session…"
              error={fieldErrors.description}
            />
          </div>

          {editing && (
            <div className="space-y-3 rounded-lg border border-pink/30 bg-pink/5 p-4 sm:col-span-2">
              <div>
                <p className="text-sm font-semibold text-pink">Danger zone</p>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  This removes the session from the public schedule. Scheduled
                  for {formatDate(editing.date)} · Day {editing.day}.
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDeleteOpen(true)}
              >
                Delete session
              </Button>
            </div>
          )}
        </FormGrid>
      </Modal>

      {/* ── Delete confirmation ────────────────────────────────────────────── */}
      <ConfirmModal
        open={deleteOpen}
        onClose={() => {
          if (!deleting) {setDeleteOpen(false)}
        }}
        onConfirm={() => void handleDelete()}
        title="Delete this session?"
        description={
          editing
            ? `"${editing.title}" will be permanently removed from the schedule. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete session"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
