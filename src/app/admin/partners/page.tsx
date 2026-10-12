"use client"

// =============================================================================
// Admin — Partners list (/admin/partners)
// Partner organizations (academic, technical, media, industry, …) shown on the
// public site. Filter by category and active state, open a row to edit every
// field, and delete partners — all mutations are written to the audit log by
// the API routes.
// =============================================================================

import {
  Building2,
  ExternalLink,
  ImagePlus,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"
import * as React from "react"
import toast from "react-hot-toast"

import {
  AdminApiError,
  adminMutate,
  AdminFilterSelect,
  AdminSearchInput,
  DataTable,
  FormGrid,
  ImageUrlField,
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
} from "@/components/ui"
import { cn } from "@/lib/utils"

// ─── Types (mirror GET /api/admin/partners) ──────────────────────────────────

type PartnerRow = {
  id: string
  name: string
  category: string
  logoKey: string
  websiteUrl: string | null
  isActive: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
}

// ─── Filter + form options ────────────────────────────────────────────────────

const CATEGORY_HINTS = ["Academic", "Technical", "Media", "Industry"]

const CATEGORY_FILTER_OPTIONS = CATEGORY_HINTS.map((category) => ({
  value: category,
  label: category,
}))

const ACTIVE_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
]

const URL_PATTERN = /^https?:\/\/\S+$/i

type PartnerFormState = {
  name: string
  category: string
  logoUrl: string
  websiteUrl: string
  isActive: boolean
  displayOrder: string
}

const EMPTY_FORM: PartnerFormState = {
  name: "",
  category: "",
  logoUrl: "",
  websiteUrl: "",
  isActive: true,
  displayOrder: "0",
}

/** Light client-side pre-check mirroring partnerCreateSchema for fast feedback. */
function validateForm(form: PartnerFormState): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = form.name.trim()
  if (name.length < 2) {
    errors.name = "Partner name is required."
  } else if (name.length > 100) {
    errors.name = "Partner name is too long."
  }
  const category = form.category.trim()
  if (category.length < 2) {
    errors.category = "Category is required."
  } else if (category.length > 60) {
    errors.category = "Category is too long."
  }
  if (!form.logoUrl.trim()) {
    errors.logoUrl = "Upload a logo for this partner."
  } else if (!URL_PATTERN.test(form.logoUrl.trim())) {
    errors.logoUrl = "Logo must be a full https:// URL."
  }
  if (form.websiteUrl.trim() && !URL_PATTERN.test(form.websiteUrl.trim())) {
    errors.websiteUrl = "Website must start with http:// or https://."
  }
  const order = Number(form.displayOrder)
  if (!Number.isInteger(order) || order < 0 || order > 9999) {
    errors.displayOrder = "Display order must be between 0 and 9999."
  }
  return errors
}

function buildPayload(form: PartnerFormState): Record<string, unknown> {
  return {
    name: form.name.trim(),
    category: form.category.trim(),
    logoUrl: form.logoUrl.trim(),
    ...(form.websiteUrl.trim() ? { websiteUrl: form.websiteUrl.trim() } : {}),
    isActive: form.isActive,
    displayOrder: form.displayOrder,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPartnersPage() {
  const list = useAdminList<PartnerRow>("/api/admin/partners", {
    initialFilters: { category: "", isActive: "" },
  })

  // ── Create / edit dialog state ─────────────────────────────────────────────
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PartnerRow | null>(null)
  const [form, setForm] = React.useState<PartnerFormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)

  // ── Delete confirmation state ──────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const update = React.useCallback((patch: Partial<PartnerFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const openCreate = React.useCallback(() => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setFormOpen(true)
  }, [])

  const openEdit = React.useCallback((row: PartnerRow) => {
    setEditing(row)
    setForm({
      name: row.name,
      category: row.category,
      logoUrl: row.logoKey,
      websiteUrl: row.websiteUrl ?? "",
      isActive: row.isActive,
      displayOrder: String(row.displayOrder),
    })
    setFieldErrors({})
    setFormOpen(true)
  }, [])

  const closeForm = React.useCallback(() => {
    setFormOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
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
          `/api/admin/partners/${editing.id}`,
          "PATCH",
          buildPayload(form),
          { successMessage: "Partner updated." },
        )
      } else {
        await adminMutate("/api/admin/partners", "POST", buildPayload(form), {
          successMessage: "Partner created.",
        })
      }
      closeForm()
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
        editing ? "Could not update the partner." : "Could not create the partner.",
      )
    } finally {
      setSaving(false)
    }
  }, [form, editing, list, closeForm])

  const handleDelete = React.useCallback(async () => {
    if (!editing) {return}
    setDeleting(true)
    try {
      await adminMutate(
        `/api/admin/partners/${editing.id}`,
        "DELETE",
        undefined,
        { successMessage: "Partner deleted." },
      )
      setDeleteOpen(false)
      closeForm()
      list.refresh()
    } catch (err) {
      toastApiError(err, "Could not delete the partner.")
    } finally {
      setDeleting(false)
    }
  }, [editing, list, closeForm])

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: Column<PartnerRow>[] = [
    {
      key: "logo",
      header: "Logo",
      render: (item) => (
        <div className="flex h-9 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-bg-elevated">
          {item.logoKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.logoKey}
              alt=""
              className="h-full w-full object-contain p-0.5"
            />
          ) : (
            <ImagePlus className="h-4 w-4 text-text-faint" aria-hidden="true" />
          )}
        </div>
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (item) => (
        <span className="block truncate font-medium text-text-primary">
          {item.name}
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (item) => (
        <span className="whitespace-nowrap text-sm text-text-muted">
          {item.category}
        </span>
      ),
    },
    {
      key: "website",
      header: "Website",
      desktopOnly: true,
      render: (item) =>
        item.websiteUrl ? (
          <a
            href={item.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex max-w-[12rem] items-center gap-1 text-sm text-cyan transition-colors hover:underline"
          >
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {item.websiteUrl.replace(/^https?:\/\//, "")}
            </span>
          </a>
        ) : (
          <span className="text-xs text-text-faint">—</span>
        ),
    },
    {
      key: "active",
      header: "Active",
      render: (item) => (
        <StatusPill status={item.isActive ? "ACTIVE" : "INACTIVE"} />
      ),
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
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Partners
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Partner organizations shown on the public site. Open a row to edit
            its details or remove it — every change is written to the audit log.
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
        emptyTitle="No partners found"
        emptyDescription="Add the first partner, or adjust the filters."
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowClick={openEdit}
        toolbar={
          <>
            <AdminSearchInput
              value={list.query}
              onChange={list.setQuery}
              placeholder="Search partners…"
            />
            <AdminFilterSelect
              value={list.filters.category ?? ""}
              onChange={(value) => list.setFilter("category", value)}
              options={CATEGORY_FILTER_OPTIONS}
              allLabel="All categories"
              ariaLabel="Filter by category"
            />
            <AdminFilterSelect
              value={list.filters.isActive ?? ""}
              onChange={(value) => list.setFilter("isActive", value)}
              options={ACTIVE_OPTIONS}
              allLabel="All states"
              ariaLabel="Filter by active state"
            />
            <Button
              size="sm"
              className="sm:ml-auto"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={openCreate}
            >
              Add partner
            </Button>
          </>
        }
      />

      {/* ── Create / edit dialog ───────────────────────────────────────────── */}
      <Modal
        open={formOpen}
        onClose={() => {
          if (!saving) {closeForm()}
        }}
        title={editing ? "Edit partner" : "Add partner"}
        description="All fields are validated again on the server before saving."
        size="lg"
        footer={
          <>
            {editing && (
              <Button
                variant="danger"
                className="mr-auto"
                disabled={saving}
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={saving}
              onClick={closeForm}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSave()}
              loading={saving}
              loadingText="Saving…"
            >
              {editing ? "Save changes" : "Create partner"}
            </Button>
          </>
        }
      >
        <FormGrid cols={2}>
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            maxLength={100}
            placeholder="e.g. Bangladesh Computer Society"
            error={fieldErrors.name}
          />
          <Input
            label="Category"
            required
            value={form.category}
            onChange={(e) => update({ category: e.target.value })}
            maxLength={60}
            placeholder="e.g. Academic"
            helper="Common categories: Academic / Technical / Media / Industry."
            error={fieldErrors.category}
          />

          <div className="sm:col-span-2">
            <ImageUrlField
              label="Logo"
              required
              value={form.logoUrl}
              onChange={(url) => update({ logoUrl: url })}
              category="partnerLogo"
              aspect="logo"
              hint="Shown on the public partners section. PNG, JPEG, or WebP."
              error={fieldErrors.logoUrl}
            />
          </div>

          <Input
            label="Website"
            type="url"
            value={form.websiteUrl}
            onChange={(e) => update({ websiteUrl: e.target.value })}
            maxLength={300}
            placeholder="https://example.com"
            helper="Optional — opens in a new tab."
            error={fieldErrors.websiteUrl}
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

          <Toggle
            checked={form.isActive}
            onChange={(checked) => update({ isActive: checked })}
            label="Active"
            description="Active partners are shown on the public site."
          />
        </FormGrid>
      </Modal>

      {/* ── Delete confirmation ────────────────────────────────────────────── */}
      <ConfirmModal
        open={deleteOpen}
        onClose={() => {
          if (!deleting) {setDeleteOpen(false)}
        }}
        onConfirm={() => void handleDelete()}
        title="Delete this partner?"
        description={
          editing
            ? `"${editing.name}" will be permanently removed from the public site. This is recorded in the audit log and cannot be undone.`
            : undefined
        }
        confirmLabel="Delete partner"
        cancelLabel="Keep partner"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
