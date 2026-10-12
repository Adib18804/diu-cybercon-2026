"use client"

// =============================================================================
// Admin — Projects review queue (/admin/projects)
// Every project submission with its submitter, status, and featured flag.
// Clicking a row opens the review panel: full submission content, media
// links, and the decision form (status / review note / featured). Every
// review is written to the audit log.
// =============================================================================

import {
  ExternalLink,
  FileText,
  FolderKanban,
  Github,
  RefreshCw,
  Star,
} from "lucide-react"
import * as React from "react"
import toast from "react-hot-toast"

import {
  adminMutate,
  AdminFilterSelect,
  AdminSearchInput,
  DataTable,
  humanizeStatus,
  StatusPill,
  Toggle,
  toastApiError,
  useAdminList,
  type Column,
} from "@/components/admin"
import { Button, Modal, Select, Textarea } from "@/components/ui"
import { cn, relativeTime } from "@/lib/utils"

// ─── Types (mirror the API payload) ──────────────────────────────────────────

type SubmissionStatusValue =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "REVISION_REQUIRED"
  | "PUBLISHED"

type ProjectRow = {
  id: string
  projectName: string
  teamName: string
  university: string
  department: string
  category: string
  description: string
  problemStatement: string
  proposedSolution: string
  technologies: string[]
  githubUrl: string | null
  demoUrl: string | null
  imageKey: string | null
  presentationKey: string | null
  status: SubmissionStatusValue
  reviewNote: string | null
  reviewedAt: string | null
  isFeatured: boolean
  createdAt: string
  user: { id: string; name: string | null; email: string } | null
}

const STATUS_VALUES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "REVISION_REQUIRED",
  "PUBLISHED",
] as const

const STATUS_OPTIONS = STATUS_VALUES.map((value) => ({
  value,
  label: humanizeStatus(value),
}))

// ─── Small building blocks ────────────────────────────────────────────────────

function ContentBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-text-primary">
        {value}
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminProjectsPage() {
  const list = useAdminList<ProjectRow>("/api/admin/projects", {
    initialFilters: { status: "" },
  })

  // ── Review panel state ────────────────────────────────────────────────────
  const [selected, setSelected] = React.useState<ProjectRow | null>(null)
  const [formStatus, setFormStatus] =
    React.useState<SubmissionStatusValue>("SUBMITTED")
  const [formNote, setFormNote] = React.useState("")
  const [formFeatured, setFormFeatured] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const openReview = React.useCallback((row: ProjectRow) => {
    setSelected(row)
    setFormStatus(row.status)
    setFormNote(row.reviewNote ?? "")
    setFormFeatured(row.isFeatured)
  }, [])

  const saveReview = React.useCallback(async () => {
    if (!selected) {return}
    if (
      (formStatus === "REJECTED" || formStatus === "REVISION_REQUIRED") &&
      formNote.trim().length === 0
    ) {
      toast.error("A review note is required for this status.")
      return
    }
    setSaving(true)
    try {
      await adminMutate(
        `/api/admin/projects/${selected.id}`,
        "PATCH",
        {
          status: formStatus,
          reviewNote: formNote.trim() || undefined,
          isFeatured: formFeatured,
        },
        { successMessage: "Review saved." },
      )
      setSelected(null)
      list.refresh()
    } catch (err) {
      toastApiError(err, "Could not save the review.")
    } finally {
      setSaving(false)
    }
  }, [selected, formStatus, formNote, formFeatured, list.refresh])

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns: Column<ProjectRow>[] = [
    {
      key: "project",
      header: "Project",
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text-primary">
            {item.projectName}
          </p>
          <p className="truncate text-xs text-text-muted">{item.teamName}</p>
        </div>
      ),
    },
    {
      key: "university",
      header: "University",
      desktopOnly: true,
      render: (item) => (
        <span className="text-sm text-text-muted">{item.university}</span>
      ),
    },
    {
      key: "category",
      header: "Category",
      desktopOnly: true,
      render: (item) => (
        <span className="font-mono text-[0.625rem] uppercase tracking-wider text-text-muted">
          {item.category}
        </span>
      ),
    },
    {
      key: "submitted",
      header: "Submitted",
      desktopOnly: true,
      render: (item) => (
        <span className="whitespace-nowrap text-xs text-text-muted">
          {relativeTime(item.createdAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusPill status={item.status} />,
    },
    {
      key: "featured",
      header: "Featured",
      render: (item) =>
        item.isFeatured ? (
          <Star
            className="h-4 w-4 text-amber"
            fill="currentColor"
            role="img"
            aria-label="Featured"
          />
        ) : (
          <span className="text-xs text-text-faint">—</span>
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
              <FolderKanban className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Projects
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Project showcase submissions. Open a row to read the full
            submission and record a review decision — every change is written
            to the audit log.
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
        emptyTitle="No project submissions found"
        emptyDescription="Project submissions will appear here as teams submit them, or adjust the filters."
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowClick={openReview}
        toolbar={
          <>
            <AdminSearchInput
              value={list.query}
              onChange={list.setQuery}
              placeholder="Search projects, teams or universities…"
            />
            <AdminFilterSelect
              value={list.filters.status ?? ""}
              onChange={(value) => list.setFilter("status", value)}
              options={STATUS_OPTIONS}
              allLabel="All statuses"
              ariaLabel="Filter by review status"
            />
          </>
        }
      />

      {/* ── Review panel ───────────────────────────────────────────────────── */}
      <Modal
        open={selected !== null}
        onClose={() => {
          if (!saving) {setSelected(null)}
        }}
        title={selected ? selected.projectName : "Review project"}
        description={
          selected ? `${selected.teamName} · ${selected.category}` : undefined
        }
        size="xl"
      >
        {selected && (
          <div className="space-y-5">
            {/* Submitter */}
            <div className="rounded-md border border-border bg-bg-elevated/50 px-4 py-3">
              <p className="text-sm font-medium text-text-primary">
                {selected.user?.name ?? selected.user?.email ?? "—"}
              </p>
              {selected.user?.name && (
                <p className="mt-0.5 text-xs text-text-muted">
                  {selected.user.email}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-muted">
                <span>
                  University:{" "}
                  <span className="text-text-primary">
                    {selected.university || "—"}
                  </span>
                </span>
                <span>
                  Department:{" "}
                  <span className="text-text-primary">
                    {selected.department || "—"}
                  </span>
                </span>
                <span>
                  Submitted:{" "}
                  <span className="text-text-primary">
                    {relativeTime(selected.createdAt)}
                  </span>
                </span>
              </div>
            </div>

            {/* Submission content */}
            <div className="space-y-4 rounded-md border border-border bg-bg-elevated/30 p-4">
              <ContentBlock label="Description" value={selected.description} />
              <ContentBlock
                label="Problem statement"
                value={selected.problemStatement}
              />
              <ContentBlock
                label="Proposed solution"
                value={selected.proposedSolution}
              />

              <div>
                <p className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                  Technologies
                </p>
                {selected.technologies.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {selected.technologies.map((tech) => (
                      <span
                        key={tech}
                        className="rounded-full border border-cyan/30 bg-cyan/10 px-2 py-0.5 text-xs text-cyan"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-text-muted">None listed.</p>
                )}
              </div>

              {(selected.githubUrl || selected.demoUrl) && (
                <div className="flex flex-wrap gap-4">
                  {selected.githubUrl && (
                    <a
                      href={selected.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan transition-colors hover:text-cyan/80"
                    >
                      <Github className="h-3.5 w-3.5" aria-hidden="true" />
                      GitHub repository
                      <ExternalLink className="h-3 w-3 opacity-60" aria-hidden="true" />
                    </a>
                  )}
                  {selected.demoUrl && (
                    <a
                      href={selected.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan transition-colors hover:text-cyan/80"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      Live demo
                    </a>
                  )}
                </div>
              )}

              {selected.imageKey && (
                <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
                  {/* Stored imageKey is an absolute URL (also works for /uploads/... paths). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selected.imageKey}
                    alt="Project image"
                    className="max-h-72 w-full object-contain"
                  />
                </div>
              )}

              {selected.presentationKey && (
                <a
                  href={selected.presentationKey}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan transition-colors hover:text-cyan/80"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  Open presentation file
                  <ExternalLink className="h-3 w-3 opacity-60" aria-hidden="true" />
                </a>
              )}
            </div>

            {/* Previous review */}
            {selected.reviewedAt && (
              <div className="rounded-md border border-border bg-bg-elevated/50 px-4 py-3">
                <p className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                  Last review
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Reviewed{" "}
                  <span className="text-text-primary">
                    {relativeTime(selected.reviewedAt)}
                  </span>
                </p>
                {selected.reviewNote && (
                  <p className="mt-2 border-l-2 border-violet/40 pl-2.5 text-xs italic text-text-muted">
                    “{selected.reviewNote}”
                  </p>
                )}
              </div>
            )}

            {/* Review form */}
            <div className="space-y-4 rounded-md border border-border bg-bg-elevated/30 p-4">
              <p className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                Review decision
              </p>

              <Select
                label="Status"
                value={formStatus}
                onChange={(e) =>
                  setFormStatus(e.target.value as SubmissionStatusValue)
                }
                options={STATUS_OPTIONS}
              />

              <Textarea
                label="Review note"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Explain the decision — the submitting team sees this as the reviewer note. Required when rejecting or requesting a revision."
              />

              <Toggle
                checked={formFeatured}
                onChange={setFormFeatured}
                label="Feature this project"
                description="Featured projects are marked for highlight in the showcase."
              />

              <div className="flex justify-end">
                <Button
                  onClick={() => void saveReview()}
                  loading={saving}
                  loadingText="Saving…"
                >
                  Save review
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
