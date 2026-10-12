"use client"

// =============================================================================
// Admin — Sponsors list (/admin/sponsors)
// Tiered sponsor roster for the public site. Filters by tier and active state,
// opens a row to edit every field, and supports deletion — all mutations are
// written to the audit log by the API routes.
// =============================================================================

import {
  ExternalLink,
  Handshake,
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
  Textarea,
} from "@/components/ui"
import { cn } from "@/lib/utils"

// ─── Types (mirror GET /api/admin/sponsors) ──────────────────────────────────

type SponsorTierValue =
  | "TITLE"
  | "PLATINUM"
  | "GOLD"
  | "CUSTOM"
  | "PARTNER"
  | "MEDIA_PARTNER"
  | "TECHNICAL_PARTNER"
  | "OTHER_PARTNER"

type SponsorRow = {
  id: string
  name: string
  tier: SponsorTierValue
  logoKey: string
  websiteUrl: string | null
  description: string | null
  year: number
  isActive: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
}

// ─── Filter + form options ────────────────────────────────────────────────────

const TIER_OPTIONS: { value: SponsorTierValue; label: string }[] = [
  { value: "TITLE", label: "Title Sponsor" },
  { value: "PLATINUM", label: "Platinum Sponsor" },
  { value: "GOLD", label: "Gold Sponsor" },
  { value: "CUSTOM", label: "Custom Sponsorship" },
  { value: "PARTNER", label: "Partner" },
  { value: "MEDIA_PARTNER", label: "Media Partner" },
  { value: "TECHNICAL_PARTNER", label: "Technical Partner" },
  { value: "OTHER_PARTNER", label: "Other Partner" },
]

const TIER_LABELS: Record<string, string> = Object.fromEntries(
  TIER_OPTIONS.map((option) => [option.value, option.label]),
)

const ACTIVE_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
]

const URL_PATTERN = /^https?:\/\/\S+$/i

type SponsorFormState = {
  name: string
  tier: SponsorTierValue
  logoUrl: string
  websiteUrl: string
  description: string
  year: string
  isActive: boolean
  displayOrder: string
}

const EMPTY_FORM: SponsorFormState = {
  name: "",
  tier: "GOLD",
  logoUrl: "",
  websiteUrl: "",
  description: "",
  year: "2026",
  isActive: true,
  displayOrder: "0",
}

/** Light client-side pre-check mirroring sponsorCreateSchema for fast feedback. */
function validateForm(form: SponsorFormState): Record<string, string> {
  const errors: Record<string, string> = {}
  if (form.name.trim().length < 2) {
    errors.name = "Sponsor name is required."
  }
  if (!form.logoUrl.trim()) {
    errors.logoUrl = "Upload a logo for this sponsor."
  } else if (!URL_PATTERN.test(form.logoUrl.trim())) {
    errors.logoUrl = "Logo must be a full https:// URL."
  }
  if (form.websiteUrl.trim() && !URL_PATTERN.test(form.websiteUrl.trim())) {
    errors.websiteUrl = "Website must start with http:// or https://."
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

function buildPayload(form: SponsorFormState): Record<string, unknown> {
  return {
    name: form.name.trim(),
    tier: form.tier,
    logoUrl: form.logoUrl.trim(),
    ...(form.websiteUrl.trim() ? { websiteUrl: form.websiteUrl.trim() } : {}),
    ...(form.description.trim() ? { description: form.description.trim() } : {}),
    year: form.year,
    isActive: form.isActive,
    displayOrder: form.displayOrder,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSponsorsPage() {
  const list = useAdminList<SponsorRow>("/api/admin/sponsors", {
    initialFilters: { tier: "", isActive: "" },
  })

  // ── Create / edit dialog state ─────────────────────────────────────────────
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<SponsorRow | null>(null)
  const [form, setForm] = React.useState<SponsorFormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)

  // ── Delete confirmation state ──────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const update = React.useCallback((patch: Partial<SponsorFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const openCreate = React.useCallback(() => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setFormOpen(true)
  }, [])

  const openEdit = React.useCallback((row: SponsorRow) => {
    setEditing(row)
    setForm({
      name: row.name,
      tier: row.tier,
      logoUrl: row.logoKey,
      websiteUrl: row.websiteUrl ?? "",
      description: row.description ?? "",
      year: String(row.year),
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
          `/api/admin/sponsors/${editing.id}`,
          "PATCH",
          buildPayload(form),
          { successMessage: "Sponsor updated." },
        )
      } else {
        await adminMutate("/api/admin/sponsors", "POST", buildPayload(form), {
          successMessage: "Sponsor created.",
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
        editing ? "Could not update the sponsor." : "Could not create the sponsor.",
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
        `/api/admin/sponsors/${editing.id}`,
        "DELETE",
        undefined,
        { successMessage: "Sponsor deleted." },
      )
      setDeleteOpen(false)
      closeForm()
      list.refresh()
    } catch (err) {
      toastApiError(err, "Could not delete the sponsor.")
    } finally {
      setDeleting(false)
    }
  }, [editing, list, closeForm])

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: Column<SponsorRow>[] = [
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
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">{item.name}</p>
          {item.description && (
            <p className="mt-0.5 max-w-[16rem] truncate text-xs text-text-muted">
              {item.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "tier",
      header: "Tier",
      render: (item) => (
        <span className="whitespace-nowrap text-sm text-text-primary">
          {TIER_LABELS[item.tier] ?? humanizeStatus(item.tier)}
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
      key: "year",
      header: "Year",
      render: (item) => (
        <span className="font-mono text-xs tabular-nums text-text-muted">
          {item.year}
        </span>
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
              <Handshake className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Sponsors
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Tiered sponsor roster shown on the public site. Open a row to edit
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
        emptyTitle="No sponsors found"
        emptyDescription="Add the first sponsor, or adjust the filters."
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowClick={openEdit}
        toolbar={
          <>
            <AdminSearchInput
              value={list.query}
              onChange={list.setQuery}
              placeholder="Search sponsors…"
            />
            <AdminFilterSelect
              value={list.filters.tier ?? ""}
              onChange={(value) => list.setFilter("tier", value)}
              options={TIER_OPTIONS}
              allLabel="All tiers"
              ariaLabel="Filter by tier"
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
              Add sponsor
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
        title={editing ? "Edit sponsor" : "Add sponsor"}
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
              {editing ? "Save changes" : "Create sponsor"}
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
            placeholder="e.g. Acme Cyber Security"
            error={fieldErrors.name}
          />
          <Select
            label="Tier"
            value={form.tier}
            onChange={(e) => update({ tier: e.target.value as SponsorTierValue })}
            options={TIER_OPTIONS}
            error={fieldErrors.tier}
          />

          <div className="sm:col-span-2">
            <ImageUrlField
              label="Logo"
              required
              value={form.logoUrl}
              onChange={(url) => update({ logoUrl: url })}
              category="sponsorLogo"
              aspect="logo"
              hint="Shown on the public sponsors wall. PNG, JPEG, or WebP."
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

          <div className="sm:col-span-2">
            <Textarea
              label="Description"
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              maxLength={500}
              showCount
              placeholder="A short line about what this sponsor does…"
              error={fieldErrors.description}
            />
          </div>

          <Input
            label="Year"
            type="number"
            min={2024}
            max={2100}
            required
            value={form.year}
            onChange={(e) => update({ year: e.target.value })}
            error={fieldErrors.year}
          />
          <Toggle
            checked={form.isActive}
            onChange={(checked) => update({ isActive: checked })}
            label="Active"
            description="Active sponsors are shown on the public site."
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
        </FormGrid>
      </Modal>

      {/* ── Delete confirmation ────────────────────────────────────────────── */}
      <ConfirmModal
        open={deleteOpen}
        onClose={() => {
          if (!deleting) {setDeleteOpen(false)}
        }}
        onConfirm={() => void handleDelete()}
        title="Delete this sponsor?"
        description={
          editing
            ? `"${editing.name}" will be permanently removed from the public site. This is recorded in the audit log and cannot be undone.`
            : undefined
        }
        confirmLabel="Delete sponsor"
        cancelLabel="Keep sponsor"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
