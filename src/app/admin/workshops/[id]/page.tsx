"use client"

// =============================================================================
// Admin — Workshop detail (/admin/workshops/[id])
// Full workshop information (instructor, schedule, venue, seats, deadline),
// the participant registration list, an edit dialog, and the delete action.
// Deletion is only offered while no participant has registered — otherwise
// the correct action is to close registration.
// =============================================================================

import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  Clock,
  ListChecks,
  Loader2,
  MapPin,
  Pencil,
  ShieldAlert,
  Trash2,
  User,
  Users,
  Wrench,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"

import {
  adminFetch,
  adminMutate,
  AdminApiError,
  DataTable,
  FormGrid,
  StatusPill,
  humanizeStatus,
  toastApiError,
  type Column,
} from "@/components/admin"
import {
  Button,
  ConfirmModal,
  Input,
  Modal,
  ProgressBar,
  Select,
  Textarea,
} from "@/components/ui"
import { formatDate, relativeTime } from "@/lib/utils"

// ─── Types (mirror GET /api/admin/workshops/[id]) ────────────────────────────

type WorkshopDetail = {
  id: string
  title: string
  instructorName: string
  instructorOrg: string
  instructorBio: string | null
  description: string
  skillLevel: string
  date: string
  startTime: string
  endTime: string
  venue: string
  totalSeats: number
  registeredCount: number
  registrationDeadline: string
  requiredEquipment: string | null
  prerequisites: string | null
  status: string
  displayOrder: number
  createdAt: string
  updatedAt: string
}

type WorkshopRegistrationRow = {
  id: string
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string
    profile: { fullName: string; studentId: string } | null
  }
}

type DetailPayload = {
  workshop: WorkshopDetail
  registrations: WorkshopRegistrationRow[]
}

// ─── Options + form model ─────────────────────────────────────────────────────

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

function formFromWorkshop(workshop: WorkshopDetail): WorkshopFormState {
  return {
    title: workshop.title,
    instructorName: workshop.instructorName,
    instructorOrg: workshop.instructorOrg,
    instructorBio: workshop.instructorBio ?? "",
    description: workshop.description,
    skillLevel: workshop.skillLevel,
    date: workshop.date.slice(0, 10),
    startTime: workshop.startTime,
    endTime: workshop.endTime,
    venue: workshop.venue,
    totalSeats: String(workshop.totalSeats),
    registrationDeadline: workshop.registrationDeadline.slice(0, 10),
    requiredEquipment: workshop.requiredEquipment ?? "",
    prerequisites: workshop.prerequisites ?? "",
    status: workshop.status,
    displayOrder: String(workshop.displayOrder),
  }
}

/** Light client-side pre-check mirroring workshopUpdateSchema for fast feedback. */
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

// ─── Local building blocks ────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  className,
  action,
}: {
  title: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <section className={cnLocal("rounded-lg border border-border bg-bg-panel p-5", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-micro uppercase tracking-wider text-text-muted">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function cnLocal(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ")
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-faint" />
      <div className="min-w-0">
        <p className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
          {label}
        </p>
        <p className="mt-0.5 break-words text-sm text-text-primary">{value}</p>
      </div>
    </div>
  )
}

// ─── Edit form fields (shared across the dialog) ──────────────────────────────

function WorkshopFormFields({
  form,
  errors,
  update,
}: {
  form: WorkshopFormState
  errors: Record<string, string>
  update: (patch: Partial<WorkshopFormState>) => void
}) {
  return (
    <FormGrid cols={2}>
      <Input
        label="Title"
        required
        value={form.title}
        onChange={(e) => update({ title: e.target.value })}
        maxLength={150}
        error={errors.title}
      />
      <Select
        label="Status"
        value={form.status}
        onChange={(e) => update({ status: e.target.value })}
        options={STATUS_OPTIONS}
        error={errors.status}
      />

      <Input
        label="Instructor name"
        required
        value={form.instructorName}
        onChange={(e) => update({ instructorName: e.target.value })}
        maxLength={100}
        error={errors.instructorName}
      />
      <Input
        label="Instructor organization"
        required
        value={form.instructorOrg}
        onChange={(e) => update({ instructorOrg: e.target.value })}
        maxLength={150}
        error={errors.instructorOrg}
      />

      <Select
        label="Skill level"
        value={form.skillLevel}
        onChange={(e) => update({ skillLevel: e.target.value })}
        options={SKILL_LEVEL_OPTIONS}
        error={errors.skillLevel}
      />
      <Input
        label="Venue"
        required
        value={form.venue}
        onChange={(e) => update({ venue: e.target.value })}
        maxLength={150}
        error={errors.venue}
      />

      <Input
        label="Date"
        type="date"
        required
        value={form.date}
        onChange={(e) => update({ date: e.target.value })}
        error={errors.date}
      />
      <Input
        label="Registration deadline"
        type="date"
        required
        value={form.registrationDeadline}
        onChange={(e) => update({ registrationDeadline: e.target.value })}
        error={errors.registrationDeadline}
      />

      <Input
        label="Start time"
        required
        value={form.startTime}
        onChange={(e) => update({ startTime: e.target.value })}
        placeholder="HH:MM"
        maxLength={5}
        className="font-mono"
        error={errors.startTime}
      />
      <Input
        label="End time"
        required
        value={form.endTime}
        onChange={(e) => update({ endTime: e.target.value })}
        placeholder="HH:MM"
        maxLength={5}
        className="font-mono"
        error={errors.endTime}
      />

      <Input
        label="Total seats"
        type="number"
        min={1}
        max={1000}
        required
        value={form.totalSeats}
        onChange={(e) => update({ totalSeats: e.target.value })}
        error={errors.totalSeats}
      />
      <Input
        label="Display order"
        type="number"
        min={0}
        max={9999}
        value={form.displayOrder}
        onChange={(e) => update({ displayOrder: e.target.value })}
        helper="Lower numbers appear first."
        error={errors.displayOrder}
      />

      <div className="sm:col-span-2">
        <Textarea
          label="Instructor bio"
          value={form.instructorBio}
          onChange={(e) => update({ instructorBio: e.target.value })}
          maxLength={1000}
          showCount
          error={errors.instructorBio}
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
          error={errors.description}
        />
      </div>
      <div className="sm:col-span-2">
        <Textarea
          label="Required equipment"
          value={form.requiredEquipment}
          onChange={(e) => update({ requiredEquipment: e.target.value })}
          maxLength={500}
          showCount
          error={errors.requiredEquipment}
        />
      </div>
      <div className="sm:col-span-2">
        <Textarea
          label="Prerequisites"
          value={form.prerequisites}
          onChange={(e) => update({ prerequisites: e.target.value })}
          maxLength={500}
          showCount
          error={errors.prerequisites}
        />
      </div>
    </FormGrid>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminWorkshopDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const router = useRouter()

  const [data, setData] = React.useState<DetailPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  // ── Edit dialog state ──────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = React.useState(false)
  const [form, setForm] = React.useState<WorkshopFormState | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)

  // ── Delete state ───────────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const payload = await adminFetch<DetailPayload>(
        `/api/admin/workshops/${id}`,
      )
      setData(payload)
      setLoadError(null)
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to load this workshop.",
      )
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    void load()
  }, [load])

  const update = React.useCallback((patch: Partial<WorkshopFormState>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const openEdit = React.useCallback(() => {
    if (!data) {return}
    setForm(formFromWorkshop(data.workshop))
    setFieldErrors({})
    setEditOpen(true)
  }, [data])

  const handleSave = React.useCallback(async () => {
    if (!form) {return}
    const errors = validateForm(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSaving(true)
    setFieldErrors({})
    try {
      const updated = await adminMutate<WorkshopDetail>(
        `/api/admin/workshops/${id}`,
        "PATCH",
        buildPayload(form),
        { successMessage: "Workshop updated." },
      )
      setData((prev) =>
        prev ? { ...prev, workshop: updated } : prev,
      )
      setEditOpen(false)
    } catch (err) {
      if (err instanceof AdminApiError && err.details) {
        const mapped: Record<string, string> = {}
        for (const [key, messages] of Object.entries(err.details)) {
          if (messages?.[0]) {mapped[key] = messages[0]}
        }
        setFieldErrors(mapped)
      }
      toastApiError(err, "Could not save the workshop.")
    } finally {
      setSaving(false)
    }
  }, [form, id])

  const confirmDelete = React.useCallback(async () => {
    setDeleting(true)
    try {
      await adminMutate(
        `/api/admin/workshops/${id}`,
        "DELETE",
        undefined,
        { successMessage: "Workshop deleted." },
      )
      setDeleteOpen(false)
      router.push("/admin/workshops")
    } catch (err) {
      toastApiError(err, "Could not delete the workshop.")
      if (err instanceof AdminApiError && err.code === "HAS_REGISTRATIONS") {
        setDeleteOpen(false)
        await load()
      }
    } finally {
      setDeleting(false)
    }
  }, [id, router, load])

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-panel px-6 py-16 text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span className="text-sm">Loading workshop…</span>
      </div>
    )
  }

  if (loadError && !data) {
    return (
      <div className="rounded-lg border border-pink/30 bg-pink/5 px-6 py-14 text-center">
        <ShieldAlert className="mx-auto mb-3 h-6 w-6 text-pink" aria-hidden="true" />
        <p className="text-sm font-medium text-text-primary">
          Could not load this workshop
        </p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-text-muted">{loadError}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!data) {return null}

  const { workshop, registrations } = data
  const hasRegistrations = registrations.length > 0
  const seatPct =
    workshop.totalSeats > 0
      ? (workshop.registeredCount / workshop.totalSeats) * 100
      : 0
  const seatVariant = seatPct >= 90 ? "pink" : seatPct >= 70 ? "amber" : "cyan"

  const registrationColumns: Column<WorkshopRegistrationRow>[] = [
    {
      key: "participant",
      header: "Participant",
      render: (registration) => (
        <p className="truncate font-medium text-text-primary">
          {registration.user.profile?.fullName ??
            registration.user.name ??
            "Unnamed participant"}
        </p>
      ),
    },
    {
      key: "studentId",
      header: "Student ID",
      desktopOnly: true,
      render: (registration) =>
        registration.user.profile?.studentId ? (
          <span className="font-mono text-xs text-text-primary">
            {registration.user.profile.studentId}
          </span>
        ) : (
          <span className="text-xs text-text-faint">—</span>
        ),
    },
    {
      key: "email",
      header: "Email",
      render: (registration) => (
        <span className="text-xs text-text-muted">{registration.user.email}</span>
      ),
    },
    {
      key: "registered",
      header: "Registered",
      render: (registration) => (
        <span className="whitespace-nowrap text-xs text-text-muted">
          {relativeTime(registration.createdAt)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <Link
          href="/admin/workshops"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted transition-colors hover:text-cyan"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to workshops
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
            {workshop.title}
          </h1>
          <StatusPill status={workshop.status} />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {workshop.instructorName} · {formatDate(workshop.date)} ·{" "}
          {workshop.startTime}–{workshop.endTime}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column: details + registrations ───────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          <SectionCard
            title="Workshop details"
            action={
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Pencil className="h-3.5 w-3.5" />}
                onClick={openEdit}
              >
                Edit workshop
              </Button>
            }
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <InfoRow
                icon={User}
                label="Instructor"
                value={`${workshop.instructorName} · ${workshop.instructorOrg}`}
              />
              <InfoRow
                icon={ListChecks}
                label="Skill level"
                value={humanizeStatus(workshop.skillLevel)}
              />
              <InfoRow
                icon={CalendarDays}
                label="Date & time"
                value={`${formatDate(workshop.date)} · ${workshop.startTime}–${workshop.endTime}`}
              />
              <InfoRow icon={MapPin} label="Venue" value={workshop.venue} />
              <InfoRow
                icon={Users}
                label="Seats"
                value={`${workshop.registeredCount} / ${workshop.totalSeats} registered`}
              />
              <InfoRow
                icon={Clock}
                label="Registration deadline"
                value={`${formatDate(workshop.registrationDeadline)} · ${relativeTime(workshop.registrationDeadline)}`}
              />
              {workshop.instructorBio && (
                <div className="sm:col-span-2">
                  <InfoRow
                    icon={User}
                    label="Instructor bio"
                    value={workshop.instructorBio}
                  />
                </div>
              )}
              {workshop.requiredEquipment && (
                <div className="sm:col-span-2">
                  <InfoRow
                    icon={Wrench}
                    label="Required equipment"
                    value={workshop.requiredEquipment}
                  />
                </div>
              )}
              {workshop.prerequisites && (
                <div className="sm:col-span-2">
                  <InfoRow
                    icon={ListChecks}
                    label="Prerequisites"
                    value={workshop.prerequisites}
                  />
                </div>
              )}
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>Seats filled</span>
                <span className="font-mono tabular-nums">
                  {workshop.registeredCount} / {workshop.totalSeats}
                </span>
              </div>
              <ProgressBar
                className="mt-2"
                value={workshop.registeredCount}
                max={workshop.totalSeats}
                variant={seatVariant}
                size="sm"
              />
            </div>
          </SectionCard>

          <SectionCard title="Description">
            <p className="whitespace-pre-line text-sm leading-relaxed text-text-muted">
              {workshop.description}
            </p>
          </SectionCard>

          <SectionCard title={`Registrations (${registrations.length})`}>
            <DataTable
              columns={registrationColumns}
              items={registrations}
              rowKey={(registration) => registration.id}
              emptyTitle="No registrations yet"
              emptyDescription="Participants will appear here once they register for this workshop."
            />
          </SectionCard>
        </div>

        {/* ── Right column: overview + danger zone ───────────────────────── */}
        <div className="space-y-6">
          <SectionCard title="Overview">
            <div className="space-y-4">
              <InfoRow
                icon={ListChecks}
                label="Status"
                value={<StatusPill status={workshop.status} />}
              />
              <InfoRow
                icon={CalendarClock}
                label="Display order"
                value={<span className="font-mono tabular-nums">{workshop.displayOrder}</span>}
              />
              <InfoRow
                icon={Clock}
                label="Created"
                value={`${formatDate(workshop.createdAt)} · ${relativeTime(workshop.createdAt)}`}
              />
              <InfoRow
                icon={Clock}
                label="Last updated"
                value={relativeTime(workshop.updatedAt)}
              />
            </div>
          </SectionCard>

          <SectionCard title="Danger zone">
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-text-muted">
                Deleting a workshop is permanent and is recorded in the audit
                log. It is only possible while no participant has registered.
              </p>
              {hasRegistrations && (
                <p className="border-l-2 border-amber/50 pl-2.5 text-xs leading-relaxed text-amber">
                  This workshop has {registrations.length} registrations and
                  cannot be deleted. Close registration instead.
                </p>
              )}
              <Button
                variant="danger"
                fullWidth
                disabled={hasRegistrations || deleting}
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => setDeleteOpen(true)}
              >
                Delete workshop
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* ── Edit dialog ────────────────────────────────────────────────────── */}
      <Modal
        open={editOpen}
        onClose={() => {
          if (!saving) {setEditOpen(false)}
        }}
        title="Edit workshop"
        description="Changes are validated again on the server and written to the audit log."
        size="lg"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSave()}
              loading={saving}
              loadingText="Saving…"
            >
              Save changes
            </Button>
          </>
        }
      >
        {form && (
          <WorkshopFormFields
            form={form}
            errors={fieldErrors}
            update={update}
          />
        )}
      </Modal>

      {/* ── Delete confirmation ────────────────────────────────────────────── */}
      <ConfirmModal
        open={deleteOpen}
        onClose={() => {
          if (!deleting) {setDeleteOpen(false)}
        }}
        onConfirm={() => void confirmDelete()}
        title="Delete this workshop?"
        description={`${workshop.title} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete workshop"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
