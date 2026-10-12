"use client"

// =============================================================================
// Admin — FAQ list (/admin/faq)
// Frequently asked questions shown on the public FAQ page. Entries are ordered
// manually via display order, can be kept as drafts, and are hard-deleted
// (the audit log keeps the record of what was removed).
// =============================================================================

import { HelpCircle, Plus, RefreshCw, Trash2 } from "lucide-react"
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
import { cn, relativeTime } from "@/lib/utils"

// ─── Types (mirror GET /api/admin/faq) ───────────────────────────────────────

type FaqRow = {
  id: string
  question: string
  answer: string
  category: string
  displayOrder: number
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

// ─── Filter + form state ──────────────────────────────────────────────────────

const PUBLISHED_FILTER_OPTIONS = [
  { value: "true", label: "Published" },
  { value: "false", label: "Draft" },
]

type FaqFormState = {
  question: string
  answer: string
  category: string
  displayOrder: string
  isPublished: boolean
}

const EMPTY_FORM: FaqFormState = {
  question: "",
  answer: "",
  category: "",
  displayOrder: "0",
  isPublished: true,
}

/** Light client-side pre-check mirroring the FAQ schemas for fast feedback. */
function validateForm(
  form: FaqFormState,
  isEditing: boolean,
): Record<string, string> {
  const errors: Record<string, string> = {}
  const question = form.question.trim()
  const answer = form.answer.trim()
  const category = form.category.trim()

  if (question.length < 5) {
    errors.question = "Question is required (at least 5 characters)."
  }
  if (answer.length < 5) {
    errors.answer = "Answer is required (at least 5 characters)."
  }
  if (isEditing) {
    if (category.length < 2) {
      errors.category = "Category is required."
    }
  } else if (category.length > 0 && category.length < 2) {
    errors.category = "Category must be at least 2 characters."
  }

  const order = form.displayOrder.trim()
  if (order !== "") {
    const parsedOrder = Number(order)
    if (!Number.isInteger(parsedOrder) || parsedOrder < 0 || parsedOrder > 9999) {
      errors.displayOrder = "Display order must be a whole number from 0 to 9999."
    }
  }

  return errors
}

function buildCreatePayload(form: FaqFormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    question: form.question.trim(),
    answer: form.answer.trim(),
    displayOrder: form.displayOrder.trim() === "" ? 0 : Number(form.displayOrder),
    isPublished: form.isPublished,
  }
  const category = form.category.trim()
  if (category) {payload.category = category}
  return payload
}

/** Changed-key PATCH payload — only fields that differ from the stored row. */
function buildUpdatePayload(
  existing: FaqRow,
  form: FaqFormState,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  const question = form.question.trim()
  const answer = form.answer.trim()
  const category = form.category.trim()
  const displayOrder = form.displayOrder.trim() === "" ? 0 : Number(form.displayOrder)

  if (question !== existing.question) {payload.question = question}
  if (answer !== existing.answer) {payload.answer = answer}
  if (category !== existing.category) {payload.category = category}
  if (displayOrder !== existing.displayOrder) {payload.displayOrder = displayOrder}
  if (form.isPublished !== existing.isPublished) {
    payload.isPublished = form.isPublished
  }
  return payload
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminFaqPage() {
  const list = useAdminList<FaqRow>("/api/admin/faq")

  // Categories are open-ended, so the filter options are derived from the
  // rows currently loaded rather than a fixed list.
  const categoryOptions = React.useMemo(() => {
    const categories = Array.from(
      new Set(list.items.map((item) => item.category)),
    )
    return categories
      .filter((category) => category.length > 0)
      .sort((a, b) => a.localeCompare(b))
      .map((category) => ({ value: category, label: category }))
  }, [list.items])

  // ── Dialog state ───────────────────────────────────────────────────────────
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<FaqRow | null>(null)
  const [form, setForm] = React.useState<FaqFormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const update = React.useCallback((patch: Partial<FaqFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const closeEditor = React.useCallback(() => {
    setEditorOpen(false)
    setEditing(null)
    setFieldErrors({})
  }, [])

  const openCreate = React.useCallback(() => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setEditorOpen(true)
  }, [])

  const openEdit = React.useCallback((item: FaqRow) => {
    setEditing(item)
    setForm({
      question: item.question,
      answer: item.answer,
      category: item.category,
      displayOrder: String(item.displayOrder),
      isPublished: item.isPublished,
    })
    setFieldErrors({})
    setEditorOpen(true)
  }, [])

  const handleSave = React.useCallback(async () => {
    const errors = validateForm(form, editing !== null)
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
        await adminMutate(`/api/admin/faq/${editing.id}`, "PATCH", payload, {
          successMessage: "FAQ entry updated.",
        })
      } else {
        await adminMutate("/api/admin/faq", "POST", buildCreatePayload(form), {
          successMessage: "FAQ entry created.",
        })
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
          ? "Could not update the FAQ entry."
          : "Could not create the FAQ entry.",
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
        `/api/admin/faq/${editing.id}`,
        "DELETE",
        undefined,
        { successMessage: "FAQ entry deleted." },
      )
      setDeleteOpen(false)
      closeEditor()
      list.refresh()
    } catch (err) {
      toastApiError(err, "Could not delete the FAQ entry.")
    } finally {
      setDeleting(false)
    }
  }, [closeEditor, editing, list])

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: Column<FaqRow>[] = [
    {
      key: "question",
      header: "Question",
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">
            {item.question}
          </p>
          <p className="mt-0.5 max-w-md truncate text-xs text-text-muted">
            {item.answer}
          </p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (item) => (
        <span className="whitespace-nowrap text-sm text-text-muted">
          {item.category || "—"}
        </span>
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
      key: "order",
      header: "Order",
      render: (item) => (
        <span className="font-mono text-xs text-text-faint">
          {item.displayOrder}
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
              <HelpCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              FAQ
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Questions and answers shown on the public FAQ page. Entries appear
            in display order; drafts stay hidden until published.
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
        emptyTitle="No FAQ entries found"
        emptyDescription="Create the first entry, or adjust the filters."
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowClick={openEdit}
        toolbar={
          <>
            <AdminSearchInput
              value={list.query}
              onChange={list.setQuery}
              placeholder="Search FAQ by question…"
            />
            <AdminFilterSelect
              value={list.filters.isPublished ?? ""}
              onChange={(value) => list.setFilter("isPublished", value)}
              options={PUBLISHED_FILTER_OPTIONS}
              allLabel="All entries"
              ariaLabel="Filter by published status"
            />
            <AdminFilterSelect
              value={list.filters.category ?? ""}
              onChange={(value) => list.setFilter("category", value)}
              options={categoryOptions}
              allLabel="All categories"
              ariaLabel="Filter by category"
            />
            <Button
              size="sm"
              className="sm:ml-auto"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={openCreate}
            >
              New FAQ
            </Button>
          </>
        }
      />

      {/* ── Create / edit dialog ───────────────────────────────────────────── */}
      <Modal
        open={editorOpen}
        onClose={() => {
          if (!saving && !deleting) {closeEditor()}
        }}
        title={editing ? "Edit FAQ entry" : "New FAQ entry"}
        description={
          editing
            ? "Only the fields you change are saved and recorded in the audit log."
            : "All fields are validated again on the server before saving."
        }
        size="lg"
        footer={
          <>
            {editing && (
              <Button
                variant="danger"
                className="mr-auto"
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                disabled={saving || deleting}
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={saving || deleting}
              onClick={closeEditor}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSave()}
              loading={saving}
              loadingText={editing ? "Saving…" : "Creating…"}
            >
              {editing ? "Save changes" : "Create entry"}
            </Button>
          </>
        }
      >
        <FormGrid cols={2}>
          <div className="sm:col-span-2">
            <Input
              label="Question"
              required
              value={form.question}
              onChange={(e) => update({ question: e.target.value })}
              maxLength={300}
              placeholder="e.g. Who can participate in the CTF?"
              error={fieldErrors.question}
            />
          </div>

          <div className="sm:col-span-2">
            <Textarea
              label="Answer"
              required
              rows={6}
              value={form.answer}
              onChange={(e) => update({ answer: e.target.value })}
              maxLength={3000}
              showCount
              placeholder="The full answer shown on the public FAQ page…"
              error={fieldErrors.answer}
            />
          </div>

          <Input
            label="Category"
            value={form.category}
            onChange={(e) => update({ category: e.target.value })}
            maxLength={60}
            placeholder="general"
            helper="Entries are grouped by this label on the public FAQ page."
            error={fieldErrors.category}
          />
          <Input
            label="Display order"
            type="number"
            min={0}
            max={9999}
            step={1}
            value={form.displayOrder}
            onChange={(e) => update({ displayOrder: e.target.value })}
            placeholder="0"
            helper="Lower numbers appear first."
            error={fieldErrors.displayOrder}
          />

          <div className="sm:col-span-2">
            <Toggle
              checked={form.isPublished}
              onChange={(checked) => update({ isPublished: checked })}
              label="Published"
              description="Published entries are visible on the public FAQ page."
            />
          </div>
        </FormGrid>
      </Modal>

      {/* ── Delete confirmation ────────────────────────────────────────────── */}
      <ConfirmModal
        open={deleteOpen && editing !== null}
        onClose={() => {
          if (!deleting) {setDeleteOpen(false)}
        }}
        onConfirm={() => void handleDelete()}
        title="Delete FAQ entry"
        description="This permanently removes the entry from the public FAQ page — it cannot be restored."
        confirmLabel="Delete entry"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
