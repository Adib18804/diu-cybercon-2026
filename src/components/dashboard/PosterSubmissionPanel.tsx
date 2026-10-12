"use client"

import { ExternalLink, Pencil, Send, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import toast from "react-hot-toast"

import { StatusBadge } from "./StatusBadge"
import {
  SubmissionUploadField,
  type StagedSubmissionUpload,
} from "./SubmissionUploadField"
import { TagInput } from "./TagInput"

import {
  Alert,
  Button,
  Card,
  CardContent,
  ConfirmModal,
  Input,
  Textarea,
} from "@/components/ui"
import { FILE_UPLOAD } from "@/lib/constants"
import type { MyPosterSubmission } from "@/lib/dashboard/queries"
import { formatDate } from "@/lib/utils"
import {
  posterSubmissionSchema,
  posterSubmissionUpdateSchema,
} from "@/lib/validations/submission"

// =============================================================================
// PosterSubmissionPanel — view / create / edit / delete a Poster Presentation
// submission. The poster file is mandatory on first submission; on later edits
// it can be replaced (edits re-enter the review workflow).
// =============================================================================

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: string
  code?: string
  details?: Record<string, string[]>
  message?: string
}

const EDITABLE_STATUSES = ["SUBMITTED", "REVISION_REQUIRED", "REJECTED"] as const

const STATUS_HINTS: Record<string, string> = {
  UNDER_REVIEW: "under review",
  APPROVED: "approved",
  PUBLISHED: "published",
}

export interface PosterSubmissionPanelProps {
  existing: MyPosterSubmission | null
  /** Non-cancelled registration for the Poster Presentation event. */
  eligible: boolean
  defaults: {
    teamName: string
    university: string
    department: string
    contactName: string
    contactEmail: string
  }
}

export function PosterSubmissionPanel({
  existing,
  eligible,
  defaults,
}: PosterSubmissionPanelProps) {
  const router = useRouter()

  const [mode, setMode] = React.useState<"view" | "form">("view")
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // ── Form state ──────────────────────────────────────────────────────────────
  const [title, setTitle] = React.useState(existing?.title ?? "")
  const [teamName, setTeamName] = React.useState(
    existing?.teamName ?? defaults.teamName,
  )
  const [authors, setAuthors] = React.useState<string[]>(
    existing?.authors ??
      (defaults.contactName.trim() ? [defaults.contactName.trim()] : []),
  )
  const [university, setUniversity] = React.useState(
    existing?.university ?? defaults.university,
  )
  const [department, setDepartment] = React.useState(
    existing?.department ?? defaults.department,
  )
  const [abstract, setAbstract] = React.useState(existing?.abstract ?? "")
  const [keywords, setKeywords] = React.useState<string[]>(
    existing?.keywords ?? [],
  )
  const [category, setCategory] = React.useState(existing?.category ?? "")
  const [contactInfo, setContactInfo] = React.useState(
    existing?.contactInfo ?? defaults.contactEmail,
  )
  const [poster, setPoster] = React.useState<StagedSubmissionUpload | null>(null)

  const [submitting, setSubmitting] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  const editable =
    existing !== null &&
    (EDITABLE_STATUSES as readonly string[]).includes(existing.status)
  const deletable = editable

  const showingForm = existing ? mode === "form" : eligible

  function startEdit(): void {
    if (!existing) {return}
    setTitle(existing.title)
    setTeamName(existing.teamName)
    setAuthors(existing.authors)
    setUniversity(existing.university)
    setDepartment(existing.department)
    setAbstract(existing.abstract)
    setKeywords(existing.keywords)
    setCategory(existing.category)
    setContactInfo(existing.contactInfo)
    setPoster(null)
    setErrors({})
    setMode("form")
  }

  async function handleSubmit(): Promise<void> {
    const payload: Record<string, unknown> = {
      title: title.trim(),
      teamName: teamName.trim(),
      authors,
      university: university.trim(),
      department: department.trim(),
      abstract: abstract.trim(),
      keywords,
      category: category.trim(),
      contactInfo: contactInfo.trim(),
    }

    // Create → posterToken required. Edit → only sent when replacing the file.
    if (poster) {
      payload.posterToken = poster.token
    } else if (!existing) {
      payload.posterToken = ""
    }

    const schema = existing
      ? posterSubmissionUpdateSchema
      : posterSubmissionSchema
    const parsed = schema.safeParse(payload)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      const flat = parsed.error.flatten().fieldErrors
      for (const [key, messages] of Object.entries(flat)) {
        const first = messages?.[0]
        if (first) {fieldErrors[key] = first}
      }
      setErrors(fieldErrors)
      toast.error("Please fix the highlighted fields and try again.")
      return
    }

    setSubmitting(true)
    setErrors({})

    try {
      const res = await fetch(
        existing ? `/api/submissions/poster/${existing.id}` : "/api/submissions/poster",
        {
          method: existing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      )

      let json: ApiEnvelope<unknown> | null = null
      try {
        json = (await res.json()) as ApiEnvelope<unknown>
      } catch {
        json = null
      }

      if (!res.ok || !json?.success) {
        if (json?.details) {
          const fieldErrors: Record<string, string> = {}
          for (const [key, messages] of Object.entries(json.details)) {
            const first = messages?.[0]
            if (first) {fieldErrors[key] = first}
          }
          setErrors(fieldErrors)
        }
        if (json?.code === "UPLOAD_EXPIRED") {
          setPoster(null)
        }
        toast.error(
          json?.error ??
            (res.status === 429
              ? "Too many attempts. Please wait a moment and try again."
              : "Could not save the submission. Please try again."),
        )
        return
      }

      toast.success(json.message ?? "Poster submission saved.")
      setMode("view")
      router.refresh()
    } catch {
      toast.error("Something went wrong. Check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (!existing) {return}
    setDeleting(true)
    try {
      const res = await fetch(`/api/submissions/poster/${existing.id}`, {
        method: "DELETE",
      })
      let json: ApiEnvelope<unknown> | null = null
      try {
        json = (await res.json()) as ApiEnvelope<unknown>
      } catch {
        json = null
      }

      if (!res.ok || !json?.success) {
        toast.error(json?.error ?? "Could not delete the submission.")
        return
      }

      toast.success(json.message ?? "Poster submission deleted.")
      setDeleteOpen(false)
      setMode("view")
      router.refresh()
    } catch {
      toast.error("Something went wrong. Check your connection and try again.")
    } finally {
      setDeleting(false)
    }
  }

  // ── Not registered and nothing submitted → registration gate ────────────────
  if (!existing && !eligible) {
    return (
      <Alert
        variant="info"
        title="Registration required"
        actions={
          <Link href="/register" className="btn-secondary !px-3 !py-1.5 !text-xs">
            Register for Poster Presentation
          </Link>
        }
      >
        You must be registered for the Poster Presentation event before
        submitting a poster. Registration is free and takes a few minutes.
      </Alert>
    )
  }

  // ── Form mode ───────────────────────────────────────────────────────────────
  if (showingForm) {
    return (
      <Card padding="none">
        <CardContent className="p-0">
          <div className="border-b border-border p-5">
            <h3 className="font-display text-base font-semibold text-text-primary">
              {existing ? "Edit poster submission" : "Submit your poster"}
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              {existing
                ? "Saving changes re-enters the review workflow, so the review team always sees your latest version."
                : "Submit your research poster for review. Approved posters are displayed at the venue and published in the online gallery."}
            </p>
          </div>

          <div className="space-y-5 p-5">
            <Input
              label="Poster Title"
              placeholder="e.g. Securing IoT Devices Against Botnet Attacks"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={errors.title}
              disabled={submitting}
              required
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Team Name"
                placeholder="Your team name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                error={errors.teamName}
                disabled={submitting}
                required
              />
              <Input
                label="Category"
                placeholder="e.g. Digital Forensics, Cryptography"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                error={errors.category}
                disabled={submitting}
                required
              />
              <Input
                label="University / Institution"
                placeholder="Your institution"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                error={errors.university}
                disabled={submitting}
                required
              />
              <Input
                label="Department"
                placeholder="e.g. Computer Science & Engineering"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                error={errors.department}
                disabled={submitting}
                required
              />
            </div>

            <TagInput
              label="Authors"
              values={authors}
              onChange={setAuthors}
              error={errors.authors}
              helper="Press Enter after each author name, in presentation order"
              placeholder="Add an author and press Enter"
              maxItems={15}
              maxLength={100}
              disabled={submitting}
              required
            />

            <Textarea
              label="Abstract"
              placeholder="Summarize your research: topic, methodology, findings, and conclusions."
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              error={errors.abstract}
              maxLength={5000}
              helper="At least 30 characters"
              disabled={submitting}
              required
            />

            <TagInput
              label="Keywords"
              values={keywords}
              onChange={setKeywords}
              error={errors.keywords}
              helper="3–5 keywords help reviewers and attendees find your poster"
              placeholder="Add a keyword and press Enter"
              maxItems={10}
              maxLength={40}
              disabled={submitting}
              required
            />

            <Input
              label="Contact Information"
              placeholder="Email or phone for review correspondence"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              error={errors.contactInfo}
              helper="Used by the review team if changes are needed"
              disabled={submitting}
              required
            />

            <div className="space-y-3">
              {existing?.fileUrl && !poster ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-elevated p-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-text-muted">
                      Current poster file (upload a new file to replace it)
                    </p>
                    <a
                      href={existing.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-xs text-cyan underline-offset-2 hover:underline"
                    >
                      View file
                      <ExternalLink size={11} aria-hidden="true" />
                    </a>
                  </div>
                </div>
              ) : null}
              <SubmissionUploadField
                label="Poster File"
                helper="PDF preferred (A0/A1 print-ready) or a high-resolution image. Up to 20MB."
                scope="posterFile"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                acceptHint="PDF, JPG, PNG, WebP"
                maxSizeBytes={FILE_UPLOAD.posterFile.maxSizeBytes}
                value={poster}
                onChange={setPoster}
                error={errors.posterToken}
                disabled={submitting}
                required
              />
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
              {existing ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setMode("view")}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              ) : null}
              <Button
                type="button"
                variant="primary"
                leftIcon={<Send size={16} />}
                loading={submitting}
                loadingText="Saving…"
                onClick={() => void handleSubmit()}
              >
                {existing ? "Save Changes" : "Submit Poster"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── View mode (existing submission) ─────────────────────────────────────────
  if (!existing) {return null}

  const statusHint = STATUS_HINTS[existing.status] ?? existing.status.toLowerCase()

  return (
    <Card padding="none">
      <CardContent className="p-0">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-semibold text-text-primary">
                {existing.title}
              </h3>
              <StatusBadge status={existing.status} size="sm" />
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {existing.teamName} · {existing.category}
            </p>
            <p className="mt-0.5 text-xs text-text-faint">
              Submitted {formatDate(existing.createdAt)} · Last updated{" "}
              {formatDate(existing.updatedAt)}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {editable ? (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Pencil size={14} />}
                onClick={startEdit}
              >
                Edit
              </Button>
            ) : null}
            {deletable ? (
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 size={14} />}
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-5 p-5">
          {existing.reviewNote ? (
            <Alert
              variant={existing.status === "REJECTED" ? "error" : "warning"}
              title="Reviewer note"
            >
              {existing.reviewNote}
            </Alert>
          ) : null}

          {!editable ? (
            <Alert variant="info" title="Locked for review">
              This submission is {statusHint} and can no longer be edited.
              Contact the organizing team if you need to make changes.
            </Alert>
          ) : null}

          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="shrink-0 text-text-faint">Institution</dt>
              <dd className="text-text-muted">{existing.university}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 text-text-faint">Department</dt>
              <dd className="text-text-muted">{existing.department}</dd>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <dt className="shrink-0 text-text-faint">Authors</dt>
              <dd className="text-text-muted">{existing.authors.join(", ")}</dd>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <dt className="shrink-0 text-text-faint">Contact</dt>
              <dd className="text-text-muted">{existing.contactInfo}</dd>
            </div>
          </dl>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-widest text-text-faint">
              Keywords
            </h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {existing.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-md border border-violet/30 bg-violet/5 px-2 py-1 text-xs text-violet"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h4 className="font-mono text-xs uppercase tracking-widest text-text-faint">
              Abstract
            </h4>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-muted">
              {existing.abstract}
            </p>
          </div>

          <div className="border-t border-border pt-5">
            <a
              href={existing.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-cyan underline-offset-2 hover:underline"
            >
              View poster file
              <ExternalLink size={11} aria-hidden="true" />
            </a>
          </div>
        </div>
      </CardContent>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
        title="Delete poster submission?"
        description="Your poster and uploaded file will be removed from review. You can submit a new poster afterwards. This cannot be undone."
        confirmLabel="Delete Submission"
        cancelLabel="Keep It"
        variant="danger"
        loading={deleting}
      />
    </Card>
  )
}
