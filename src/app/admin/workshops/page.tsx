"use client"

// =============================================================================
// Admin — Workshops list (/admin/workshops)
// Hands-on workshops with instructor, schedule, venue, and seat capacity.
// Clicking a row opens the workshop detail page; "New workshop" opens the
// create dialog. Every create is validated server-side and written to the
// audit log.
// =============================================================================

import { Plus, RefreshCw, Wrench } from "lucide-react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
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
  humanizeStatus,
  toastApiError,
  useAdminList,
  type Column,
} from "@/components/admin"
import {
  Button,
  Input,
  Modal,
  ProgressBar,
  Select,
  Textarea,
} from "@/components/ui"
import { cn, formatDate } from "@/lib/utils"

// ─── Types (mirror GET /api/admin/workshops) ─────────────────────────────────

type WorkshopRow = {
  id: string
  title: string
  skillLevel: string
  instructorName: string
  instructorOrg: string
  date: string
  startTime: string
  endTime: string
  venue: string
  totalSeats: number
  registeredCount: number
  status: string
  displayOrder: number
}

// ─── Filter + form options ────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
  { value: "COMPLETED", label: "Completed" },
]

const SKILL_LEVEL_OPTIONS = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
]

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

type WorkshopFormState = {
  title: string
  instructorName: string
  instructorOrg: string
  instructorBio: string
  description: string
  skillLevel: string
  date: string
  startTime: string
  endTime: string
  venue: string
  totalSeats: string
  registrationDeadline: string
  requiredEquipment: string
  prerequisites: string
  status: string
  displayOrder: string
}

const EMPTY_FORM: WorkshopFormState = {
  title: "",
  instructorName: "",
  instructorOrg: "",
  instructorBio: "",
  description: "",
  skillLevel: "BEGINNER",
  date: "",
  startTime: "",
  endTime: "",
  venue: "",
  totalSeats: "40",
  registrationDeadline: "",
  requiredEquipment: "",
  prerequisites: "",
  status: "DRAFT",
  displayOrder: "0",
}

/** Light client-side pre-check mirroring workshopCreateSchema for fast feedback. */
function validateForm(form: WorkshopFormState): Record<string, string> {
  const errors: Record<string, string> = {}
  if (form.title.trim().length < 3) {
    errors.title = "Workshop title is required."
  }
  if (form.instructorName.trim().length < 2) {
    errors.instructorName = "Instructor name is required."
  }
  if (form.instructorOrg.trim().length < 2) {
    errors.instructorOrg = "Instructor organization is required."
  }
  if (form.description.trim().length < 10) {
    errors.description = "Description is required."
  }
  if (!TIME_PATTERN.test(form.startTime.trim())) {
    errors.startTime = "Use 24-hour time format HH:MM."
  }
  if (!TIME_PATTERN.test(form.endTime.trim())) {
    errors.endTime = "Use 24-hour time format HH:MM."
  }
  if (form.venue.trim().length < 2) {
    errors.venue = "Venue is required."
  }
  const seats = Number(form.totalSeats)
  if (!Number.isInteger(seats) || seats < 1 || seats > 1000) {
    errors.totalSeats = "Total seats must be between 1 and 1000."
  }
  const order = Number(form.displayOrder)
  if (!Number.isInteger(order) || order < 0 || order > 9999) {
    errors.displayOrder = "Display order must be between 0 and 9999."
  }
  if (!form.date) {
    errors.date = "Enter the workshop date."
  }
  if (!form.registrationDeadline) {
    errors.registrationDeadline = "Enter the registration deadline."
  }
  return errors
}

function buildPayload(form: WorkshopFormState): Record<string, unknown> {
  return {
    title: form.title.trim(),
    instructorName: form.instructorName.trim(),
    instructorOrg: form.instructorOrg.trim(),
    ...(form.instructorBio.trim()
      ? { instructorBio: form.instructorBio.trim() }
      : {}),
    description: form.description.trim(),
    skillLevel: form.skillLevel,
    date: form.date,
    startTime: form.startTime.trim(),
    endTime: form.endTime.trim(),
    venue: form.venue.trim(),
    totalSeats: form.totalSeats,
    registrationDeadline: form.registrationDeadline,
    ...(form.requiredEquipment.trim()
      ? { requiredEquipment: form.requiredEquipment.trim() }
      : {}),
    ...(form.prerequisites.trim()
      ? { prerequisites: form.prerequisites.trim() }
      : {}),
    status: form.status,
    displayOrder: form.displayOrder,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminWorkshopsPage() {
  const router = useRouter()

  const list = useAdminList<WorkshopRow>("/api/admin/workshops", {
    initialFilters: { status: "", skillLevel: "" },
  })

  // ── Create dialog state ────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = React.useState(false)
  const [form, setForm] = React.useState<WorkshopFormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [creating, setCreating] = React.useState(false)

  const update = React.useCallback((patch: Partial<WorkshopFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const openCreate = React.useCallback(() => {
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setCreateOpen(true)
  }, [])

  const handleCreate = React.useCallback(async () => {
    const errors = validateForm(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      toast.error("Please fix the highlighted fields.")
      return
    }

    setCreating(true)
    setFieldErrors({})
    try {
      await adminMutate("/api/admin/workshops", "POST", buildPayload(form), {
        successMessage: "Workshop created.",
      })
      setCreateOpen(false)
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
      toastApiError(err, "Could not create the workshop.")
    } finally {
      setCreating(false)
    }
  }, [form, list])

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: Column<WorkshopRow>[] = [
    {
      key: "title",
      header: "Title",
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">{item.title}</p>
          <p className="mt-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
            {humanizeStatus(item.skillLevel)}
          </p>
        </div>
      ),
    },
    {
      key: "instructor",
      header: "Instructor",
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-text-primary">
            {item.instructorName}
          </p>
          <p className="mt-0.5 truncate text-xs text-text-muted">
            {item.instructorOrg}
          </p>
        </div>
      ),
    },
    {
      key: "schedule",
      header: "Schedule",
      render: (item) => (
        <div className="whitespace-nowrap">
          <p className="text-sm text-text-primary">{formatDate(item.date)}</p>
          <p className="mt-0.5 font-mono text-[0.625rem] text-text-faint">
            {item.startTime}–{item.endTime}
          </p>
        </div>
      ),
    },
    {
      key: "venue",
      header: "Venue",
      desktopOnly: true,
      render: (item) => (
        <span className="block max-w-[12rem] truncate text-sm text-text-muted">
          {item.venue}
        </span>
      ),
    },
    {
      key: "seats",
      header: "Seats",
      render: (item) => {
        const pct =
          item.totalSeats > 0
            ? (item.registeredCount / item.totalSeats) * 100
            : 0
        const variant = pct >= 90 ? "pink" : pct >= 70 ? "amber" : "cyan"
        return (
          <div className="w-24">
            <p className="font-mono text-[0.6875rem] tabular-nums text-text-primary">
              {item.registeredCount}{" "}
              <span className="text-text-faint">/ {item.totalSeats}</span>
            </p>
            <ProgressBar
              value={item.registeredCount}
              max={item.totalSeats}
              variant={variant}
              size="sm"
              className="mt-1.5"
            />
          </div>
        )
      },
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
              <Wrench className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Workshops
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Hands-on workshop sessions with instructor, schedule, venue, and seat
            capacity. Open a row to view registrations or edit the details.
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
        emptyTitle="No workshops found"
        emptyDescription="Create the first workshop, or adjust the filters."
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowClick={(item) =>
          router.push(`/admin/workshops/${item.id}` as Route)
        }
        toolbar={
          <>
            <AdminSearchInput
              value={list.query}
              onChange={list.setQuery}
              placeholder="Search workshops or instructors…"
            />
            <AdminFilterSelect
              value={list.filters.status ?? ""}
              onChange={(value) => list.setFilter("status", value)}
              options={STATUS_OPTIONS}
              allLabel="All statuses"
              ariaLabel="Filter by status"
            />
            <AdminFilterSelect
              value={list.filters.skillLevel ?? ""}
              onChange={(value) => list.setFilter("skillLevel", value)}
              options={SKILL_LEVEL_OPTIONS}
              allLabel="All levels"
              ariaLabel="Filter by skill level"
            />
            <Button
              size="sm"
              className="sm:ml-auto"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={openCreate}
            >
              New workshop
            </Button>
          </>
        }
      />

      {/* ── Create dialog ──────────────────────────────────────────────────── */}
      <Modal
        open={createOpen}
        onClose={() => {
          if (!creating) {setCreateOpen(false)}
        }}
        title="New workshop"
        description="All fields are validated again on the server before saving."
        size="lg"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreate()}
              loading={creating}
              loadingText="Creating…"
            >
              Create workshop
            </Button>
          </>
        }
      >
        <FormGrid cols={2}>
          <Input
            label="Title"
            required
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            maxLength={150}
            placeholder="e.g. Web Exploitation Bootcamp"
            error={fieldErrors.title}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => update({ status: e.target.value })}
            options={STATUS_OPTIONS}
            error={fieldErrors.status}
          />

          <Input
            label="Instructor name"
            required
            value={form.instructorName}
            onChange={(e) => update({ instructorName: e.target.value })}
            maxLength={100}
            error={fieldErrors.instructorName}
          />
          <Input
            label="Instructor organization"
            required
            value={form.instructorOrg}
            onChange={(e) => update({ instructorOrg: e.target.value })}
            maxLength={150}
            error={fieldErrors.instructorOrg}
          />

          <Select
            label="Skill level"
            value={form.skillLevel}
            onChange={(e) => update({ skillLevel: e.target.value })}
            options={SKILL_LEVEL_OPTIONS}
            error={fieldErrors.skillLevel}
          />
          <Input
            label="Venue"
            required
            value={form.venue}
            onChange={(e) => update({ venue: e.target.value })}
            maxLength={150}
            error={fieldErrors.venue}
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
            label="Registration deadline"
            type="date"
            required
            value={form.registrationDeadline}
            onChange={(e) => update({ registrationDeadline: e.target.value })}
            error={fieldErrors.registrationDeadline}
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

          <Input
            label="Total seats"
            type="number"
            min={1}
            max={1000}
            required
            value={form.totalSeats}
            onChange={(e) => update({ totalSeats: e.target.value })}
            error={fieldErrors.totalSeats}
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
            <Textarea
              label="Instructor bio"
              value={form.instructorBio}
              onChange={(e) => update({ instructorBio: e.target.value })}
              maxLength={1000}
              showCount
              placeholder="A short introduction to the instructor…"
              error={fieldErrors.instructorBio}
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Description"
              required
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              maxLength={2000}
              showCount
              placeholder="What participants will learn and do in this workshop…"
              error={fieldErrors.description}
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Required equipment"
              value={form.requiredEquipment}
              onChange={(e) => update({ requiredEquipment: e.target.value })}
              maxLength={500}
              showCount
              placeholder="e.g. Laptop with Docker installed…"
              error={fieldErrors.requiredEquipment}
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Prerequisites"
              value={form.prerequisites}
              onChange={(e) => update({ prerequisites: e.target.value })}
              maxLength={500}
              showCount
              placeholder="e.g. Basic Linux command line familiarity…"
              error={fieldErrors.prerequisites}
            />
          </div>
        </FormGrid>
      </Modal>
    </div>
  )
}
