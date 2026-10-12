"use client"

// =============================================================================
// Admin — Panels list (/admin/panels)
// Panel discussions with session details and an ordered panelist list.
// Rows open the edit dialog with the current speaker assignments prefilled;
// the panelist picker loads speakers from /api/admin/speakers.
// =============================================================================

import { MessageSquare, Plus, RefreshCw } from "lucide-react"
import * as React from "react"
import toast from "react-hot-toast"

import {
  AdminApiError,
  adminFetch,
  adminMutate,
  AdminFilterSelect,
  AdminSearchInput,
  DataTable,
  FormGrid,
  StatusPill,
  toastApiError,
  useAdminList,
  type Column,
} from "@/components/admin"
import {
  Button,
  Checkbox,
  ConfirmModal,
  Input,
  Modal,
  Select,
  Textarea,
} from "@/components/ui"
import { cn, formatDate } from "@/lib/utils"

// ─── Types (mirror GET /api/admin/panels) ────────────────────────────────────

type PanelSpeaker = {
  id: string
  name: string
  organization: string
  photoKey: string | null
}

type PanelistRow = {
  id: string
  role: string | null
  speaker: PanelSpeaker
}

type PanelRow = {
  id: string
  topic: string
  description: string | null
  moderatorId: string | null
  sessionDate: string | null
  startTime: string | null
  endTime: string | null
  venue: string | null
  status: string
  displayOrder: number
  panelists: PanelistRow[]
}

// ─── Filter + form options ────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
  { value: "COMPLETED", label: "Completed" },
]

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const MAX_PANELISTS = 12

// ─── Form state ───────────────────────────────────────────────────────────────

type PanelFormState = {
  topic: string
  description: string
  sessionDate: string
  startTime: string
  endTime: string
  venue: string
  status: string
  displayOrder: string
}

const EMPTY_FORM: PanelFormState = {
  topic: "",
  description: "",
  sessionDate: "",
  startTime: "",
  endTime: "",
  venue: "",
  status: "DRAFT",
  displayOrder: "0",
}

function rowToForm(row: PanelRow): PanelFormState {
  return {
    topic: row.topic,
    description: row.description ?? "",
    sessionDate: row.sessionDate ? row.sessionDate.slice(0, 10) : "",
    startTime: row.startTime ?? "",
    endTime: row.endTime ?? "",
    venue: row.venue ?? "",
    status: row.status,
    displayOrder: String(row.displayOrder),
  }
}

function panelistRolesFromRow(row: PanelRow): Record<string, string> {
  const roles: Record<string, string> = {}
  for (const panelist of row.panelists) {
    roles[panelist.speaker.id] = panelist.role ?? ""
  }
  return roles
}

/** Light client-side pre-check mirroring panelCreateSchema for fast feedback. */
function validateForm(form: PanelFormState): Record<string, string> {
  const errors: Record<string, string> = {}
  if (form.topic.trim().length < 3) {
    errors.topic = "Panel topic is required."
  }
  if (form.description.trim().length > 2000) {
    errors.description = "Description must be at most 2000 characters."
  }
  if (form.startTime.trim() && !TIME_PATTERN.test(form.startTime.trim())) {
    errors.startTime = "Use 24-hour time format HH:MM."
  }
  if (form.endTime.trim() && !TIME_PATTERN.test(form.endTime.trim())) {
    errors.endTime = "Use 24-hour time format HH:MM."
  }
  const order = Number(form.displayOrder)
  if (!Number.isInteger(order) || order < 0 || order > 9999) {
    errors.displayOrder = "Display order must be between 0 and 9999."
  }
  return errors
}

/**
 * An empty session date is sent as an explicit null so the server clears the
 * column; time fields use "" which the schema transforms to "not provided".
 */
function buildPayload(
  form: PanelFormState,
  panelistRoles: Record<string, string>,
): Record<string, unknown> {
  return {
    topic: form.topic.trim(),
    description: form.description.trim(),
    sessionDate: form.sessionDate ? form.sessionDate : null,
    startTime: form.startTime.trim(),
    endTime: form.endTime.trim(),
    venue: form.venue.trim(),
    status: form.status,
    displayOrder: form.displayOrder,
    panelists: Object.entries(panelistRoles).map(([speakerId, role]) => {
      const trimmed = role.trim()
      return trimmed ? { speakerId, role: trimmed } : { speakerId }
    }),
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPanelsPage() {
  const list = useAdminList<PanelRow>("/api/admin/panels", {
    initialFilters: { status: "" },
  })

  // ── Dialog state — one modal for create + edit ─────────────────────────────
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PanelRow | null>(null)
  const [form, setForm] = React.useState<PanelFormState>(EMPTY_FORM)
  const [panelistRoles, setPanelistRoles] = React.useState<Record<string, string>>({})
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)

  // ── Panelist picker data ───────────────────────────────────────────────────
  const [speakers, setSpeakers] = React.useState<PanelSpeaker[]>([])
  const [speakersState, setSpeakersState] = React.useState<
    "idle" | "loading" | "ready" | "error"
  >("idle")

  // ── Delete state ───────────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const loadSpeakers = React.useCallback(async () => {
    setSpeakersState("loading")
    try {
      const data = await adminFetch<{ items: PanelSpeaker[] }>(
        "/api/admin/speakers?pageSize=100",
      )
      setSpeakers(data.items)
      setSpeakersState("ready")
    } catch (err) {
      setSpeakersState("error")
      toastApiError(err, "Could not load the speaker list.")
    }
  }, [])

  const update = React.useCallback((patch: Partial<PanelFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const togglePanelist = React.useCallback(
    (speakerId: string, checked: boolean) => {
      setPanelistRoles((prev) => {
        const next = { ...prev }
        if (checked) {
          next[speakerId] = ""
        } else {
          delete next[speakerId]
        }
        return next
      })
    },
    [],
  )

  const setPanelistRole = React.useCallback((speakerId: string, role: string) => {
    setPanelistRoles((prev) => {
      if (!(speakerId in prev)) {return prev}
      return { ...prev, [speakerId]: role }
    })
  }, [])

  const openCreate = React.useCallback(() => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setPanelistRoles({})
    setFieldErrors({})
    setModalOpen(true)
    if (speakersState === "idle" || speakersState === "error") {
      void loadSpeakers()
    }
  }, [loadSpeakers, speakersState])

  const openEdit = React.useCallback(
    (row: PanelRow) => {
      setEditing(row)
      setForm(rowToForm(row))
      setPanelistRoles(panelistRolesFromRow(row))
      setFieldErrors({})
      setModalOpen(true)
      if (speakersState === "idle" || speakersState === "error") {
        void loadSpeakers()
      }
    },
    [loadSpeakers, speakersState],
  )

  const handleSave = React.useCallback(async () => {
    const errors = validateForm(form)
    const selectedCount = Object.keys(panelistRoles).length
    if (selectedCount > MAX_PANELISTS) {
      errors.panelists = `Too many panelists — select up to ${MAX_PANELISTS}.`
    }
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
          `/api/admin/panels/${editing.id}`,
          "PATCH",
          buildPayload(form, panelistRoles),
          { successMessage: "Panel updated." },
        )
      } else {
        await adminMutate("/api/admin/panels", "POST", buildPayload(form, panelistRoles), {
          successMessage: "Panel created.",
        })
      }
      setModalOpen(false)
      setEditing(null)
      setForm(EMPTY_FORM)
      setPanelistRoles({})
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
        editing ? "Could not update the panel." : "Could not create the panel.",
      )
    } finally {
      setSaving(false)
    }
  }, [editing, form, list, panelistRoles])

  const handleDelete = React.useCallback(async () => {
    if (!editing) {return}
    setDeleting(true)
    try {
      await adminMutate(`/api/admin/panels/${editing.id}`, "DELETE", undefined, {
        successMessage: "Panel deleted.",
      })
      setDeleteOpen(false)
      setModalOpen(false)
      setEditing(null)
      setForm(EMPTY_FORM)
      setPanelistRoles({})
      list.refresh()
    } catch (err) {
      toastApiError(err, "Could not delete the panel.")
    } finally {
      setDeleting(false)
    }
  }, [editing, list])

  // Speakers referenced by the open panel but missing from the fetched list
  // (e.g. beyond the first page) are prepended so they stay assignable.
  const pickerSpeakers = React.useMemo(() => {
    if (!editing) {return speakers}
    const known = new Set(speakers.map((speaker) => speaker.id))
    const extras = editing.panelists
      .map((panelist) => panelist.speaker)
      .filter((speaker) => !known.has(speaker.id))
    return [...extras, ...speakers]
  }, [editing, speakers])

  const selectedCount = Object.keys(panelistRoles).length

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: Column<PanelRow>[] = [
    {
      key: "topic",
      header: "Topic",
      render: (item) => (
        <div className="min-w-0 max-w-[18rem]">
          <p className="truncate font-medium text-text-primary">{item.topic}</p>
          {item.description && (
            <p className="mt-0.5 truncate text-xs text-text-muted">
              {item.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "session",
      header: "Session",
      render: (item) => (
        <div className="whitespace-nowrap">
          <p className="text-sm text-text-primary">
            {item.sessionDate
              ? formatDate(item.sessionDate)
              : "Date to be announced"}
          </p>
          {item.startTime && item.endTime && (
            <p className="mt-0.5 font-mono text-[0.625rem] text-text-faint">
              {item.startTime}–{item.endTime}
            </p>
          )}
          {item.venue && (
            <p className="mt-0.5 max-w-[12rem] truncate text-xs text-text-muted">
              {item.venue}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "panelists",
      header: "Panelists",
      render: (item) =>
        item.panelists.length > 0 ? (
          <div className="min-w-0 max-w-[16rem]">
            <p className="truncate text-sm text-text-primary">
              {item.panelists.map((panelist) => panelist.speaker.name).join(", ")}
            </p>
            <p className="mt-0.5 text-xs text-text-faint">
              {item.panelists.length}{" "}
              {item.panelists.length === 1 ? "panelist" : "panelists"}
            </p>
          </div>
        ) : (
          <span className="text-xs text-text-faint">No panelists yet</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusPill status={item.status} />,
    },
    {
      key: "order",
      header: "Order",
      desktopOnly: true,
      render: (item) => (
        <span className="font-mono text-xs tabular-nums text-text-faint">
          {item.displayOrder}
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
              <MessageSquare className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Panels
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Panel discussions with session details and panelist assignments.
            Click a row to edit the panel; speakers can only be deleted after
            they are removed from every panel.
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
        emptyTitle="No panels found"
        emptyDescription="Create the first panel, or adjust the filters."
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowClick={openEdit}
        toolbar={
          <>
            <AdminSearchInput
              value={list.query}
              onChange={list.setQuery}
              placeholder="Search panels by topic…"
            />
            <AdminFilterSelect
              value={list.filters.status ?? ""}
              onChange={(value) => list.setFilter("status", value)}
              options={STATUS_OPTIONS}
              allLabel="All statuses"
              ariaLabel="Filter by status"
            />
            <Button
              size="sm"
              className="sm:ml-auto"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={openCreate}
            >
              Add panel
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
        title={editing ? "Edit panel" : "Add panel"}
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
              {editing ? "Save changes" : "Add panel"}
            </Button>
          </>
        }
      >
        <FormGrid cols={2}>
          <div className="sm:col-span-2">
            <Input
              label="Topic"
              required
              value={form.topic}
              onChange={(e) => update({ topic: e.target.value })}
              maxLength={200}
              placeholder="e.g. The future of threat intelligence"
              error={fieldErrors.topic}
            />
          </div>

          <div className="sm:col-span-2">
            <Textarea
              label="Description"
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              maxLength={2000}
              showCount
              placeholder="What the panel will cover…"
              error={fieldErrors.description}
            />
          </div>

          <Input
            label="Session date"
            type="date"
            value={form.sessionDate}
            onChange={(e) => update({ sessionDate: e.target.value })}
            error={fieldErrors.sessionDate}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => update({ status: e.target.value })}
            options={STATUS_OPTIONS}
            error={fieldErrors.status}
          />

          <Input
            label="Start time"
            value={form.startTime}
            onChange={(e) => update({ startTime: e.target.value })}
            placeholder="HH:MM"
            maxLength={5}
            className="font-mono"
            error={fieldErrors.startTime}
          />
          <Input
            label="End time"
            value={form.endTime}
            onChange={(e) => update({ endTime: e.target.value })}
            placeholder="HH:MM"
            maxLength={5}
            className="font-mono"
            error={fieldErrors.endTime}
          />

          <Input
            label="Venue"
            value={form.venue}
            onChange={(e) => update({ venue: e.target.value })}
            maxLength={150}
            error={fieldErrors.venue}
          />
          <Input
            label="Display order"
            type="number"
            min={0}
            max={9999}
            value={form.displayOrder}
            onChange={(e) => update({ displayOrder: e.target.value })}
            helper="Lower numbers appear first."
            error={fieldErrors.displayOrder}
          />

          {/* ── Panelists picker ────────────────────────────────────────────── */}
          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
                Panelists
              </p>
              <p className="text-xs text-text-faint">
                {selectedCount} of {MAX_PANELISTS} selected
              </p>
            </div>

            {speakersState === "loading" ? (
              <p className="rounded-md border border-border bg-bg-elevated px-3 py-4 text-center text-xs text-text-muted">
                Loading speakers…
              </p>
            ) : speakersState === "error" ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-pink/30 bg-pink/5 px-3 py-3">
                <p className="text-xs text-text-muted">
                  Could not load the speaker list.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void loadSpeakers()}
                >
                  Try again
                </Button>
              </div>
            ) : pickerSpeakers.length === 0 ? (
              <p className="rounded-md border border-border bg-bg-elevated px-3 py-4 text-center text-xs text-text-muted">
                No speakers exist yet. Add speakers first, then assign them to
                this panel.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                {pickerSpeakers.map((speaker) => {
                  const checked = speaker.id in panelistRoles
                  const atLimit = selectedCount >= MAX_PANELISTS
                  return (
                    <div
                      key={speaker.id}
                      className="flex items-center gap-3 border-b border-border-subtle px-3 py-2 last:border-b-0"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!checked && atLimit}
                        aria-label={`Assign ${speaker.name}`}
                        onChange={(e) =>
                          togglePanelist(speaker.id, e.target.checked)
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-text-primary">
                          {speaker.name}
                        </p>
                        <p className="truncate text-xs text-text-faint">
                          {speaker.organization}
                        </p>
                      </div>
                      {checked && (
                        <div className="w-44 shrink-0">
                          <Input
                            inputSize="sm"
                            value={panelistRoles[speaker.id] ?? ""}
                            onChange={(e) =>
                              setPanelistRole(speaker.id, e.target.value)
                            }
                            placeholder="Role (e.g. Panelist)"
                            maxLength={60}
                            aria-label={`Role for ${speaker.name}`}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {fieldErrors.panelists && (
              <p className="text-xs text-pink">{fieldErrors.panelists}</p>
            )}
            <p className="text-xs text-text-faint">
              Leave the role blank for a regular panelist, or type a custom
              role such as "Moderator".
            </p>
          </div>

          {editing && (
            <div className="space-y-3 rounded-lg border border-pink/30 bg-pink/5 p-4 sm:col-span-2">
              <div>
                <p className="text-sm font-semibold text-pink">Danger zone</p>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  Deleting a panel also removes its panelist assignments. The
                  speakers themselves are not deleted.
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDeleteOpen(true)}
              >
                Delete panel
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
        title="Delete this panel?"
        description={
          editing
            ? `"${editing.topic}" and its panelist assignments will be permanently removed. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete panel"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
