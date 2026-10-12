"use client"

// =============================================================================
// Admin — Announcements list (/admin/announcements)
// News and updates shown on the public announcements page. Pinned posts
// appear first; drafts stay hidden until published. Create/edit happens in a
// dialog; deletes are soft (the row is kept for the audit trail).
// =============================================================================

import { Megaphone, Pin, Plus, RefreshCw, Send, Trash2 } from "lucide-react"
import * as React from "react"
import toast from "react-hot-toast"

import {
  AdminApiError,
  adminMutate,
  AdminFilterSelect,
  AdminSearchInput,
  DataTable,
  FormGrid,
  StatusPill,
  Toggle,
  toastApiError,
  useAdminList,
  type Column,
} from "@/components/admin"
import {
  Button,
  ConfirmModal,
  Input,
  Modal,
  Textarea,
} from "@/components/ui"
import { cn, formatDate, relativeTime } from "@/lib/utils"

// ─── Types (mirror GET /api/admin/announcements) ─────────────────────────────

type AnnouncementRow = {
  id: string
  title: string
  content: string
  isPinned: boolean
  isPublished: boolean
  publishedAt: string | null
  broadcastAt: string | null
  authorId: string
  createdAt: string
  updatedAt: string
}

/** Response of POST /api/admin/announcements/[id]/broadcast */
type BroadcastResult = {
  queued: number
  alreadyDelivered: number
  hourlyRemaining: number
}

// ─── Filter + form state ──────────────────────────────────────────────────────

const PUBLISHED_FILTER_OPTIONS = [
  { value: "true", label: "Published" },
  { value: "false", label: "Draft" },
]

type AnnouncementFormState = {
  title: string
  content: string
  isPinned: boolean
  isPublished: boolean
}

const EMPTY_FORM: AnnouncementFormState = {
  title: "",
  content: "",
  isPinned: false,
  isPublished: false,
}

/** Light client-side pre-check mirroring announcement schemas for fast feedback. */
function validateForm(form: AnnouncementFormState): Record<string, string> {
  const errors: Record<string, string> = {}
  if (form.title.trim().length < 3) {
    errors.title = "Title is required."
  }
  if (form.content.trim().length < 10) {
    errors.content = "Content is required."
  }
  return errors
}

function buildCreatePayload(
  form: AnnouncementFormState,
): Record<string, unknown> {
  return {
    title: form.title.trim(),
    content: form.content.trim(),
    isPinned: form.isPinned,
    isPublished: form.isPublished,
  }
}

/** Changed-key PATCH payload — only fields that differ from the stored row. */
function buildUpdatePayload(
  existing: AnnouncementRow,
  form: AnnouncementFormState,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  const title = form.title.trim()
  const content = form.content.trim()

  if (title !== existing.title) {payload.title = title}
  if (content !== existing.content) {payload.content = content}
  if (form.isPinned !== existing.isPinned) {payload.isPinned = form.isPinned}
  if (form.isPublished !== existing.isPublished) {
    payload.isPublished = form.isPublished
  }
  return payload
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAnnouncementsPage() {
  const list = useAdminList<AnnouncementRow>("/api/admin/announcements")

  // ── Dialog state ───────────────────────────────────────────────────────────
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AnnouncementRow | null>(null)
  const [form, setForm] = React.useState<AnnouncementFormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [broadcastOpen, setBroadcastOpen] = React.useState(false)
  const [broadcasting, setBroadcasting] = React.useState(false)

  const update = React.useCallback((patch: Partial<AnnouncementFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const closeEditor = React.useCallback(() => {
    setEditorOpen(false)
    setEditing(null)
    setFieldErrors({})
    setBroadcastOpen(false)
  }, [])

  const openCreate = React.useCallback(() => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setEditorOpen(true)
  }, [])

  const openEdit = React.useCallback((item: AnnouncementRow) => {
    setEditing(item)
    setForm({
      title: item.title,
      content: item.content,
      isPinned: item.isPinned,
      isPublished: item.isPublished,
    })
    setFieldErrors({})
    setEditorOpen(true)
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
        const payload = buildUpdatePayload(editing, form)
        if (Object.keys(payload).length === 0) {
          closeEditor()
          return
        }
        await adminMutate(
          `/api/admin/announcements/${editing.id}`,
          "PATCH",
          payload,
          { successMessage: "Announcement updated." },
        )
      } else {
        await adminMutate(
          "/api/admin/announcements",
          "POST",
          buildCreatePayload(form),
          { successMessage: "Announcement created." },
        )
      }
      closeEditor()
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
          ? "Could not update the announcement."
          : "Could not create the announcement.",
      )
    } finally {
      setSaving(false)
    }
  }, [closeEditor, editing, form, list])

  const handleDelete = React.useCallback(async () => {
    if (!editing) {return}

    setDeleting(true)
    try {
      await adminMutate(
        `/api/admin/announcements/${editing.id}`,
        "DELETE",
        undefined,
        { successMessage: "Announcement deleted." },
      )
      setDeleteOpen(false)
      closeEditor()
      list.refresh()
    } catch (err) {
      toastApiError(err, "Could not delete the announcement.")
    } finally {
      setDeleting(false)
    }
  }, [closeEditor, editing, list])

  const handleBroadcast = React.useCallback(async () => {
    if (!editing) {return}

    setBroadcasting(true)
    try {
      await adminMutate<BroadcastResult>(
        `/api/admin/announcements/${editing.id}/broadcast`,
        "POST",
        undefined,
        { successMessage: "Broadcast queued." },
      )
      setBroadcastOpen(false)
      list.refresh()
    } catch (err) {
      toastApiError(err, "Could not start the broadcast.")
    } finally {
      setBroadcasting(false)
    }
  }, [editing, list])

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: Column<AnnouncementRow>[] = [
    {
      key: "title",
      header: "Title",
      render: (item) => (
        <div className="flex min-w-0 items-start gap-2">
          {item.isPinned && (
            <span className="mt-0.5 shrink-0 text-amber" title="Pinned">
              <Pin className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-text-primary">
              {item.title}
            </p>
            <p className="mt-0.5 max-w-md truncate text-xs text-text-muted">
              {item.content}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => (
        <StatusPill status={item.isPublished ? "PUBLISHED" : "DRAFT"} />
      ),
    },
    {
      key: "published",
      header: "Published",
      render: (item) => (
        <span className="whitespace-nowrap text-sm text-text-muted">
          {item.publishedAt ? formatDate(item.publishedAt) : "—"}
        </span>
      ),
    },
    {
      key: "broadcast",
      header: "Broadcast",
      desktopOnly: true,
      render: (item) => (
        <span className="whitespace-nowrap text-xs text-text-faint">
          {item.broadcastAt ? relativeTime(item.broadcastAt) : "—"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Created",
      desktopOnly: true,
      render: (item) => (
        <span className="whitespace-nowrap text-xs text-text-faint">
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
              <Megaphone className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Announcements
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            News and updates shown on the public announcements page. Pinned
            posts appear first; drafts stay hidden until published.
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
        emptyTitle="No announcements found"
        emptyDescription="Create the first announcement, or adjust the filters."
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowClick={openEdit}
        toolbar={
          <>
            <AdminSearchInput
              value={list.query}
              onChange={list.setQuery}
              placeholder="Search announcements by title…"
            />
            <AdminFilterSelect
              value={list.filters.isPublished ?? ""}
              onChange={(value) => list.setFilter("isPublished", value)}
              options={PUBLISHED_FILTER_OPTIONS}
              allLabel="All announcements"
              ariaLabel="Filter by published status"
            />
            <Button
              size="sm"
              className="sm:ml-auto"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={openCreate}
            >
              New announcement
            </Button>
          </>
        }
      />

      {/* ── Create / edit dialog ───────────────────────────────────────────── */}
      <Modal
        open={editorOpen}
        onClose={() => {
          if (!saving && !deleting && !broadcasting) {closeEditor()}
        }}
        title={editing ? "Edit announcement" : "New announcement"}
        description={
          editing
            ? "Only the fields you change are saved and recorded in the audit log."
            : "All fields are validated again on the server before saving."
        }
        size="lg"
        footer={
          <>
            {editing && (
              <div className="mr-auto flex items-center gap-3">
                <Button
                  variant="danger"
                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                  disabled={saving || deleting || broadcasting}
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete
                </Button>
                {editing.isPublished && (
                  <Button
                    variant="secondary"
                    leftIcon={<Send className="h-3.5 w-3.5" />}
                    disabled={saving || deleting || broadcasting}
                    onClick={() => setBroadcastOpen(true)}
                  >
                    Broadcast
                  </Button>
                )}
              </div>
            )}
            <Button
              variant="ghost"
              disabled={saving || deleting || broadcasting}
              onClick={closeEditor}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSave()}
              loading={saving}
              loadingText={editing ? "Saving…" : "Creating…"}
            >
              {editing ? "Save changes" : "Create announcement"}
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
              placeholder="e.g. Registration deadline extended"
              error={fieldErrors.title}
            />
          </div>

          <div className="sm:col-span-2">
            <Textarea
              label="Content"
              required
              rows={10}
              value={form.content}
              onChange={(e) => update({ content: e.target.value })}
              maxLength={5000}
              showCount
              placeholder="The full announcement text shown on the public page…"
              error={fieldErrors.content}
            />
          </div>

          <Toggle
            checked={form.isPinned}
            onChange={(checked) => update({ isPinned: checked })}
            label="Pinned"
            description="Pinned announcements appear at the top of the public list."
          />
          <Toggle
            checked={form.isPublished}
            onChange={(checked) => update({ isPublished: checked })}
            label="Published"
            description="Published announcements are visible on the public site."
          />

          {editing && editing.isPublished && (
            <div className="sm:col-span-2 rounded-md border border-border bg-bg-elevated px-3.5 py-3 text-xs leading-relaxed text-text-muted">
              {editing.broadcastAt
                ? `Last broadcast ${relativeTime(editing.broadcastAt)}. Re-running a broadcast only emails participants who have not received it yet.`
                : "Not broadcast yet. Broadcasting emails the saved announcement to every eligible participant who has not opted out of announcement emails."}
            </div>
          )}
        </FormGrid>
      </Modal>

      {/* ── Delete confirmation ────────────────────────────────────────────── */}
      <ConfirmModal
        open={deleteOpen && editing !== null}
        onClose={() => {
          if (!deleting) {setDeleteOpen(false)}
        }}
        onConfirm={() => void handleDelete()}
        title="Delete announcement"
        description="This removes the announcement from the public site — it will no longer appear in any listing."
        confirmLabel="Delete announcement"
        variant="danger"
        loading={deleting}
      />

      {/* ── Broadcast confirmation ─────────────────────────────────────────── */}
      <ConfirmModal
        open={broadcastOpen && editing !== null && editing.isPublished}
        onClose={() => {
          if (!broadcasting) {setBroadcastOpen(false)}
        }}
        onConfirm={() => void handleBroadcast()}
        title="Broadcast announcement"
        description={
          editing?.broadcastAt
            ? "This announcement has been broadcast before. Only participants who have not received it yet will be emailed. Continue?"
            : "This emails the saved announcement to every eligible participant who has not opted out. Delivery runs in the background — progress and failures are tracked in the email log."
        }
        confirmLabel="Send broadcast"
        loading={broadcasting}
      />
    </div>
  )
}
