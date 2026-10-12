"use client"

// =============================================================================
// Admin — Speakers list (/admin/speakers)
// Speakers shown on the public site: photo, bio, expertise tags, and link
// fields, plus a visibility flag. Rows open the edit dialog; "Add speaker"
// opens the create dialog. Deletion is blocked while a speaker is assigned
// to a panel (server-enforced 409).
// =============================================================================

import { Mic, Plus, RefreshCw } from "lucide-react"
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
  TagsField,
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
import { cn } from "@/lib/utils"

// ─── Types (mirror GET /api/admin/speakers) ──────────────────────────────────

type SpeakerRow = {
  id: string
  name: string
  title: string
  organization: string
  bio: string | null
  expertise: string[]
  photoKey: string | null
  linkedinUrl: string | null
  twitterUrl: string | null
  websiteUrl: string | null
  isVisible: boolean
  displayOrder: number
}

// ─── Filter options ───────────────────────────────────────────────────────────

const VISIBILITY_OPTIONS = [
  { value: "true", label: "Visible" },
  { value: "false", label: "Hidden" },
]

const LINK_PATTERN = /^https?:\/\/\S+$/i

// ─── Form state ───────────────────────────────────────────────────────────────

type SpeakerFormState = {
  name: string
  title: string
  organization: string
  bio: string
  expertise: string[]
  photoUrl: string
  linkedinUrl: string
  twitterUrl: string
  websiteUrl: string
  isVisible: boolean
  displayOrder: string
}

const EMPTY_FORM: SpeakerFormState = {
  name: "",
  title: "",
  organization: "",
  bio: "",
  expertise: [],
  photoUrl: "",
  linkedinUrl: "",
  twitterUrl: "",
  websiteUrl: "",
  isVisible: true,
  displayOrder: "0",
}

function rowToForm(row: SpeakerRow): SpeakerFormState {
  return {
    name: row.name,
    title: row.title,
    organization: row.organization,
    bio: row.bio ?? "",
    expertise: row.expertise,
    photoUrl: row.photoKey ?? "",
    linkedinUrl: row.linkedinUrl ?? "",
    twitterUrl: row.twitterUrl ?? "",
    websiteUrl: row.websiteUrl ?? "",
    isVisible: row.isVisible,
    displayOrder: String(row.displayOrder),
  }
}

/** Light client-side pre-check mirroring speakerCreateSchema for fast feedback. */
function validateForm(form: SpeakerFormState): Record<string, string> {
  const errors: Record<string, string> = {}
  if (form.name.trim().length < 2) {
    errors.name = "Speaker name is required."
  }
  if (form.title.trim().length < 2) {
    errors.title = "Professional title is required."
  }
  if (form.organization.trim().length < 2) {
    errors.organization = "Organization is required."
  }
  if (form.bio.trim().length > 2000) {
    errors.bio = "Bio must be at most 2000 characters."
  }
  if (form.expertise.length > 10) {
    errors.expertise = "Add at most 10 expertise areas."
  }
  if (form.linkedinUrl.trim() && !LINK_PATTERN.test(form.linkedinUrl.trim())) {
    errors.linkedinUrl = "Enter a full URL starting with http:// or https://."
  }
  if (form.twitterUrl.trim() && !LINK_PATTERN.test(form.twitterUrl.trim())) {
    errors.twitterUrl = "Enter a full URL starting with http:// or https://."
  }
  if (form.websiteUrl.trim() && !LINK_PATTERN.test(form.websiteUrl.trim())) {
    errors.websiteUrl = "Enter a full URL starting with http:// or https://."
  }
  const order = Number(form.displayOrder)
  if (!Number.isInteger(order) || order < 0 || order > 9999) {
    errors.displayOrder = "Display order must be between 0 and 9999."
  }
  return errors
}

/**
 * All keys are always sent (empty strings included) so the server can
 * distinguish "clear this field" from "leave it untouched" on PATCH.
 */
function buildPayload(form: SpeakerFormState): Record<string, unknown> {
  return {
    name: form.name.trim(),
    title: form.title.trim(),
    organization: form.organization.trim(),
    bio: form.bio.trim(),
    expertise: form.expertise,
    photoUrl: form.photoUrl.trim(),
    linkedinUrl: form.linkedinUrl.trim(),
    twitterUrl: form.twitterUrl.trim(),
    websiteUrl: form.websiteUrl.trim(),
    isVisible: form.isVisible,
    displayOrder: form.displayOrder,
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "?"
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSpeakersPage() {
  const list = useAdminList<SpeakerRow>("/api/admin/speakers", {
    initialFilters: { isVisible: "" },
  })

  // ── Dialog state — one modal for create + edit ─────────────────────────────
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<SpeakerRow | null>(null)
  const [form, setForm] = React.useState<SpeakerFormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)

  // ── Delete state ───────────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const update = React.useCallback((patch: Partial<SpeakerFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const openCreate = React.useCallback(() => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setModalOpen(true)
  }, [])

  const openEdit = React.useCallback((row: SpeakerRow) => {
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
          `/api/admin/speakers/${editing.id}`,
          "PATCH",
          buildPayload(form),
          { successMessage: "Speaker updated." },
        )
      } else {
        await adminMutate("/api/admin/speakers", "POST", buildPayload(form), {
          successMessage: "Speaker created.",
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
        editing ? "Could not update the speaker." : "Could not create the speaker.",
      )
    } finally {
      setSaving(false)
    }
  }, [editing, form, list])

  const handleDelete = React.useCallback(async () => {
    if (!editing) {return}
    setDeleting(true)
    try {
      await adminMutate(`/api/admin/speakers/${editing.id}`, "DELETE", undefined, {
        successMessage: "Speaker deleted.",
      })
      setDeleteOpen(false)
      setModalOpen(false)
      setEditing(null)
      setForm(EMPTY_FORM)
      list.refresh()
    } catch (err) {
      toastApiError(err, "Could not delete the speaker.")
    } finally {
      setDeleting(false)
    }
  }, [editing, list])

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: Column<SpeakerRow>[] = [
    {
      key: "photo",
      header: "",
      className: "w-14",
      render: (item) =>
        item.photoKey ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-elevated">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.photoKey}
              alt=""
              className="h-full w-full object-cover"
            />
          </span>
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-bg-elevated font-mono text-xs font-bold text-text-muted">
            {initials(item.name)}
          </span>
        ),
    },
    {
      key: "name",
      header: "Name",
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">{item.name}</p>
          <p className="mt-0.5 truncate text-xs text-text-muted">
            {item.title}
          </p>
        </div>
      ),
    },
    {
      key: "organization",
      header: "Organization",
      render: (item) => (
        <span className="block max-w-[14rem] truncate text-sm text-text-muted">
          {item.organization}
        </span>
      ),
    },
    {
      key: "expertise",
      header: "Expertise",
      desktopOnly: true,
      render: (item) => {
        if (item.expertise.length === 0) {
          return <span className="text-xs text-text-faint">—</span>
        }
        const shown = item.expertise.slice(0, 4)
        const extra = item.expertise.length - shown.length
        return (
          <span className="flex max-w-[16rem] flex-wrap items-center gap-1">
            {shown.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border border-cyan/30 bg-cyan/10 px-2 py-0.5 text-[0.6875rem] text-cyan"
              >
                {tag}
              </span>
            ))}
            {extra > 0 && (
              <span className="text-[0.6875rem] text-text-faint">
                +{extra}
              </span>
            )}
          </span>
        )
      },
    },
    {
      key: "status",
      header: "Status",
      render: (item) => (
        <StatusPill status={item.isVisible ? "ACTIVE" : "INACTIVE"} />
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
              <Mic className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Speakers
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Speakers shown on the public site — photos, bios, expertise tags,
            and visibility. Click a row to edit; hidden speakers stay off the
            public pages.
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
        emptyTitle="No speakers found"
        emptyDescription="Add the first speaker, or adjust the filters."
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowClick={openEdit}
        toolbar={
          <>
            <AdminSearchInput
              value={list.query}
              onChange={list.setQuery}
              placeholder="Search speakers or organizations…"
            />
            <AdminFilterSelect
              value={list.filters.isVisible ?? ""}
              onChange={(value) => list.setFilter("isVisible", value)}
              options={VISIBILITY_OPTIONS}
              allLabel="All speakers"
              ariaLabel="Filter by visibility"
            />
            <Button
              size="sm"
              className="sm:ml-auto"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={openCreate}
            >
              Add speaker
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
        title={editing ? "Edit speaker" : "Add speaker"}
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
              {editing ? "Save changes" : "Add speaker"}
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
            placeholder="e.g. Dr. Ayesha Rahman"
            error={fieldErrors.name}
          />
          <Input
            label="Professional title"
            required
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            maxLength={120}
            placeholder="e.g. Chief Security Officer"
            error={fieldErrors.title}
          />

          <Input
            label="Organization"
            required
            value={form.organization}
            onChange={(e) => update({ organization: e.target.value })}
            maxLength={150}
            placeholder="e.g. Daffodil International University"
            error={fieldErrors.organization}
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
            <ImageUrlField
              label="Photo"
              value={form.photoUrl}
              onChange={(url) => update({ photoUrl: url })}
              category="speakerPhoto"
              aspect="square"
              hint="Square crop works best. Upload a JPEG, PNG, or WebP."
              error={fieldErrors.photoUrl}
            />
          </div>

          <div className="sm:col-span-2">
            <TagsField
              label="Expertise"
              value={form.expertise}
              onChange={(tags) => update({ expertise: tags })}
              max={10}
              placeholder="Type an area and press Enter…"
              hint="Up to 10 areas, e.g. Network security, Digital forensics."
              error={fieldErrors.expertise}
            />
          </div>

          <div className="sm:col-span-2">
            <Textarea
              label="Bio"
              value={form.bio}
              onChange={(e) => update({ bio: e.target.value })}
              maxLength={2000}
              showCount
              placeholder="A short introduction shown on the speaker's profile…"
              error={fieldErrors.bio}
            />
          </div>

          <div className="sm:col-span-2">
            <Toggle
              checked={form.isVisible}
              onChange={(checked) => update({ isVisible: checked })}
              label="Visible on the public site"
              description="When off, this speaker is hidden from the public speakers page."
            />
          </div>

          <Input
            label="LinkedIn"
            type="url"
            value={form.linkedinUrl}
            onChange={(e) => update({ linkedinUrl: e.target.value })}
            placeholder="https://linkedin.com/in/…"
            error={fieldErrors.linkedinUrl}
          />
          <Input
            label="X (Twitter)"
            type="url"
            value={form.twitterUrl}
            onChange={(e) => update({ twitterUrl: e.target.value })}
            placeholder="https://x.com/…"
            error={fieldErrors.twitterUrl}
          />

          <div className="sm:col-span-2">
            <Input
              label="Website"
              type="url"
              value={form.websiteUrl}
              onChange={(e) => update({ websiteUrl: e.target.value })}
              placeholder="https://…"
              error={fieldErrors.websiteUrl}
            />
          </div>

          {editing && (
            <div className="space-y-3 rounded-lg border border-pink/30 bg-pink/5 p-4 sm:col-span-2">
              <div>
                <p className="text-sm font-semibold text-pink">Danger zone</p>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  Deleting a speaker is permanent. Speakers assigned to a panel
                  cannot be deleted until they are removed from the panel.
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDeleteOpen(true)}
              >
                Delete speaker
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
        title="Delete this speaker?"
        description={
          editing
            ? `"${editing.name}" will be permanently removed. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete speaker"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
