"use client"

// =============================================================================
// Admin — Gallery (/admin/gallery)
// Imagery shown on the public gallery page. Cards render the stored upload
// directly; create/edit happens in a dialog and delete removes both the row
// and the stored file. Categories are admin-authored free text (the public
// gallery uses the same open taxonomy), so the filter and form options are
// derived from the loaded images rather than a fixed list.
// =============================================================================

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Images,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react"
import * as React from "react"
import toast from "react-hot-toast"

import {
  AdminApiError,
  adminMutate,
  AdminFilterSelect,
  AdminSearchInput,
  FormGrid,
  ImageUrlField,
  StatusPill,
  Toggle,
  toastApiError,
  useAdminList,
} from "@/components/admin"
import {
  Button,
  ConfirmModal,
  Input,
  Modal,
  Select,
} from "@/components/ui"
import { APP_YEAR } from "@/lib/constants"
import { cn } from "@/lib/utils"

// ─── Types (mirror GET /api/admin/gallery) ───────────────────────────────────

type GalleryRow = {
  id: string
  title: string | null
  imageKey: string
  publicUrl: string | null
  category: string
  altText: string
  year: number
  displayOrder: number
  isPublished: boolean
  uploadedBy: string
  createdAt: string
  updatedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "behind-the-scenes" → "Behind The Scenes" (same helper as the public grid). */
function categoryLabel(category: string): string {
  return category
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

const DEFAULT_CATEGORY = "general"

// ─── Filter + form state ──────────────────────────────────────────────────────

type GalleryFormState = {
  imageUrl: string
  title: string
  altText: string
  category: string
  year: string
  displayOrder: string
  isPublished: boolean
}

const EMPTY_FORM: GalleryFormState = {
  imageUrl: "",
  title: "",
  altText: "",
  category: DEFAULT_CATEGORY,
  year: String(APP_YEAR),
  displayOrder: "0",
  isPublished: false,
}

/** Light client-side pre-check mirroring gallery schemas for fast feedback. */
function validateForm(form: GalleryFormState): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!form.imageUrl.trim()) {
    errors.imageUrl = "Upload an image for this gallery card."
  }
  if (form.altText.trim().length < 3) {
    errors.altText = "Alt text is required (at least 3 characters)."
  }
  if (form.category.trim().length < 2) {
    errors.category = "Category is required."
  }
  const year = Number(form.year)
  if (!Number.isInteger(year) || year < 2024 || year > 2100) {
    errors.year = "Year must be between 2024 and 2100."
  }
  const order = Number(form.displayOrder)
  if (!Number.isInteger(order) || order < 0 || order > 9999) {
    errors.displayOrder = "Display order must be between 0 and 9999."
  }
  return errors
}

function buildCreatePayload(form: GalleryFormState): Record<string, unknown> {
  const title = form.title.trim()
  return {
    imageUrl: form.imageUrl.trim(),
    ...(title ? { title } : {}),
    altText: form.altText.trim(),
    category: form.category.trim(),
    year: form.year,
    displayOrder: form.displayOrder,
    isPublished: form.isPublished,
  }
}

/** Changed-key PATCH payload — only fields that differ from the stored row. */
function buildUpdatePayload(
  existing: GalleryRow,
  form: GalleryFormState,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  const imageUrl = form.imageUrl.trim()
  const title = form.title.trim()
  const altText = form.altText.trim()
  const category = form.category.trim()
  const year = Number(form.year)
  const displayOrder = Number(form.displayOrder)

  if (imageUrl !== existing.imageKey) {payload.imageUrl = imageUrl}
  if (title !== (existing.title ?? "")) {payload.title = title}
  if (altText !== existing.altText) {payload.altText = altText}
  if (category !== existing.category) {payload.category = category}
  if (year !== existing.year) {payload.year = year}
  if (displayOrder !== existing.displayOrder) {
    payload.displayOrder = displayOrder
  }
  if (form.isPublished !== existing.isPublished) {
    payload.isPublished = form.isPublished
  }
  return payload
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminGalleryPage() {
  const list = useAdminList<GalleryRow>("/api/admin/gallery")

  // ── Dialog state ───────────────────────────────────────────────────────────
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<GalleryRow | null>(null)
  const [form, setForm] = React.useState<GalleryFormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const update = React.useCallback((patch: Partial<GalleryFormState>) => {
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

  const openEdit = React.useCallback((item: GalleryRow) => {
    setEditing(item)
    setForm({
      imageUrl: item.imageKey,
      title: item.title ?? "",
      altText: item.altText,
      category: item.category,
      year: String(item.year),
      displayOrder: String(item.displayOrder),
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
        await adminMutate(`/api/admin/gallery/${editing.id}`, "PATCH", payload, {
          successMessage: "Gallery image updated.",
        })
      } else {
        await adminMutate("/api/admin/gallery", "POST", buildCreatePayload(form), {
          successMessage: "Gallery image added.",
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
          ? "Could not update the gallery image."
          : "Could not add the gallery image.",
      )
    } finally {
      setSaving(false)
    }
  }, [closeEditor, editing, form, list])

  const handleDelete = React.useCallback(async () => {
    if (!editing) {return}

    setDeleting(true)
    try {
      await adminMutate(`/api/admin/gallery/${editing.id}`, "DELETE", undefined, {
        successMessage: "Gallery image deleted.",
      })
      setDeleteOpen(false)
      closeEditor()
      list.refresh()
    } catch (err) {
      toastApiError(err, "Could not delete the gallery image.")
    } finally {
      setDeleting(false)
    }
  }, [closeEditor, editing, list])

  // ── Derived option lists (open category taxonomy → derive from data) ───────
  const categoryFilterOptions = React.useMemo(() => {
    const values = new Set<string>()
    for (const item of list.items) {values.add(item.category)}
    if (list.filters.category) {values.add(list.filters.category)}
    return Array.from(values)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: categoryLabel(value) }))
  }, [list.items, list.filters.category])

  const yearFilterOptions = React.useMemo(() => {
    const values = new Set<string>()
    for (const item of list.items) {values.add(String(item.year))}
    if (list.filters.year) {values.add(list.filters.year)}
    return Array.from(values)
      .sort((a, b) => Number(b) - Number(a))
      .map((value) => ({ value, label: value }))
  }, [list.items, list.filters.year])

  const categoryOptions = React.useMemo(() => {
    const values = new Set<string>([DEFAULT_CATEGORY])
    for (const item of list.items) {values.add(item.category)}
    if (form.category) {values.add(form.category)}
    return Array.from(values)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: categoryLabel(value) }))
  }, [form.category, list.items])

  const pagination = list.pagination
  const showEmpty = !list.loading && !list.error && list.items.length === 0

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan/30 bg-cyan/5 text-cyan">
              <Images className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Gallery
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Imagery shown on the public gallery page. Published images appear
            immediately; drafts stay hidden until published.
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

      {/* ── Gallery panel ──────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border border-border bg-bg-panel">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <AdminSearchInput
            value={list.query}
            onChange={list.setQuery}
            placeholder="Search images by title or alt text…"
          />
          <AdminFilterSelect
            value={list.filters.category ?? ""}
            onChange={(value) => list.setFilter("category", value)}
            options={categoryFilterOptions}
            allLabel="All categories"
            ariaLabel="Filter by category"
          />
          <AdminFilterSelect
            value={list.filters.year ?? ""}
            onChange={(value) => list.setFilter("year", value)}
            options={yearFilterOptions}
            allLabel="All years"
            ariaLabel="Filter by year"
          />
          <Button
            size="sm"
            className="sm:ml-auto"
            leftIcon={<Upload className="h-3.5 w-3.5" />}
            onClick={openCreate}
          >
            Upload image
          </Button>
        </div>

        {/* Error state */}
        {list.error && !list.loading && (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-pink/30 bg-pink/5 text-pink">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-text-primary">
              Could not load images
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-text-muted">
              {list.error}
            </p>
            <button
              type="button"
              onClick={list.refresh}
              className="mt-1 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {showEmpty && (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-bg-elevated text-text-faint">
              <Images className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-text-primary">No images yet</p>
            <p className="max-w-sm text-xs leading-relaxed text-text-muted">
              Upload the first gallery image, or adjust the filters.
            </p>
          </div>
        )}

        {/* Card grid */}
        {!list.error && (list.loading || list.items.length > 0) && (
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.loading
              ? Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={`skeleton-${index}`}
                    className="overflow-hidden rounded-lg border border-border bg-bg-panel"
                  >
                    <div className="aspect-video animate-pulse bg-bg-elevated" />
                    <div className="space-y-2 p-3">
                      <div className="h-3.5 w-2/3 animate-pulse rounded bg-bg-elevated" />
                      <div className="h-3 w-1/3 animate-pulse rounded bg-bg-elevated" />
                    </div>
                  </div>
                ))
              : list.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openEdit(item)}
                    className="group overflow-hidden rounded-lg border border-border bg-bg-panel text-left transition-colors hover:border-cyan/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
                  >
                    {/* Stored uploads are absolute URLs — rendered with <img>. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageKey}
                      alt={item.altText}
                      loading="lazy"
                      className="aspect-video w-full object-cover"
                    />
                    <div className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-medium text-text-primary">
                          {item.title || "Untitled"}
                        </p>
                        <StatusPill
                          status={item.isPublished ? "PUBLISHED" : "DRAFT"}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-border bg-bg-elevated px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-text-muted">
                          {categoryLabel(item.category)}
                        </span>
                        <span className="font-mono text-[0.625rem] tabular-nums text-text-faint">
                          {item.year}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
          </div>
        )}

        {/* Pagination bar */}
        {pagination && !list.error && pagination.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <p className="font-mono text-micro uppercase tracking-wider text-text-faint">
              Showing{" "}
              <span className="text-text-muted">
                {(pagination.page - 1) * pagination.pageSize + 1}–
                {Math.min(
                  pagination.page * pagination.pageSize,
                  pagination.total,
                )}
              </span>{" "}
              of <span className="text-text-muted">{pagination.total}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!pagination.hasPrevPage || list.loading}
                onClick={() => list.setPage(pagination.page - 1)}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Prev
              </button>
              <span className="font-mono text-micro uppercase tracking-wider text-text-faint">
                Page {pagination.page} / {Math.max(1, pagination.totalPages)}
              </span>
              <button
                type="button"
                disabled={!pagination.hasNextPage || list.loading}
                onClick={() => list.setPage(pagination.page + 1)}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create / edit dialog ───────────────────────────────────────────── */}
      <Modal
        open={editorOpen}
        onClose={() => {
          if (!saving && !deleting) {closeEditor()}
        }}
        title={editing ? "Edit image" : "Upload image"}
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
              loadingText={editing ? "Saving…" : "Adding…"}
            >
              {editing ? "Save changes" : "Add image"}
            </Button>
          </>
        }
      >
        <FormGrid cols={2}>
          <div className="sm:col-span-2">
            <ImageUrlField
              label="Image"
              category="gallery"
              required
              value={form.imageUrl}
              onChange={(url) => update({ imageUrl: url })}
              hint="JPEG, PNG, or WebP — re-encoded and EXIF-stripped on upload."
              error={fieldErrors.imageUrl}
            />
          </div>

          <Input
            label="Title"
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            maxLength={150}
            placeholder="Optional short caption"
            helper="Optional — shown on the public gallery card."
            error={fieldErrors.title}
          />
          <Input
            label="Year"
            type="number"
            min={2024}
            max={2100}
            required
            value={form.year}
            onChange={(e) => update({ year: e.target.value })}
            helper="Event year used by the public year filter."
            error={fieldErrors.year}
          />

          <div className="sm:col-span-2">
            <Input
              label="Alt text"
              required
              value={form.altText}
              onChange={(e) => update({ altText: e.target.value })}
              maxLength={200}
              placeholder="Describe the image for screen readers"
              error={fieldErrors.altText}
            />
          </div>

          <Select
            label="Category"
            value={form.category}
            onChange={(e) => update({ category: e.target.value })}
            options={categoryOptions}
            error={fieldErrors.category}
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

          <div className="sm:col-span-2">
            <Toggle
              checked={form.isPublished}
              onChange={(checked) => update({ isPublished: checked })}
              label="Published"
              description="Published images are visible on the public gallery page."
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
        title="Delete image"
        description="This permanently removes the image from the public gallery and deletes the uploaded file."
        confirmLabel="Delete image"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
