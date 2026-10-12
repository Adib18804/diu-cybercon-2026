"use client"

import {
  ExternalLink,
  Github,
  Globe,
  Pencil,
  Send,
  Trash2,
} from "lucide-react"
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
import type { MyProjectSubmission } from "@/lib/dashboard/queries"
import { formatDate } from "@/lib/utils"
import {
  projectSubmissionSchema,
  projectSubmissionUpdateSchema,
} from "@/lib/validations/submission"

// =============================================================================
// ProjectSubmissionPanel — view / create / edit / delete a Project Showcasing
// submission. Only SUBMITTED, REVISION_REQUIRED and REJECTED are editable or
// deletable (server-enforced; mirrored here for UI state).
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

export interface ProjectSubmissionPanelProps {
  existing: MyProjectSubmission | null
  /** Non-cancelled registration for the Project Showcasing event. */
  eligible: boolean
  defaults: {
    teamName: string
    university: string
    department: string
  }
}

export function ProjectSubmissionPanel({
  existing,
  eligible,
  defaults,
}: ProjectSubmissionPanelProps) {
  const router = useRouter()

  const [mode, setMode] = React.useState<"view" | "form">("view")
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // ── Form state ──────────────────────────────────────────────────────────────
  const [projectName, setProjectName] = React.useState(
    existing?.projectName ?? "",
  )
  const [teamName, setTeamName] = React.useState(
    existing?.teamName ?? defaults.teamName,
  )
  const [university, setUniversity] = React.useState(
    existing?.university ?? defaults.university,
  )
  const [department, setDepartment] = React.useState(
    existing?.department ?? defaults.department,
  )
  const [category, setCategory] = React.useState(existing?.category ?? "")
  const [description, setDescription] = React.useState(existing?.description ?? "")
  const [problemStatement, setProblemStatement] = React.useState(
    existing?.problemStatement ?? "",
  )
  const [proposedSolution, setProposedSolution] = React.useState(
    existing?.proposedSolution ?? "",
  )
  const [technologies, setTechnologies] = React.useState<string[]>(
    existing?.technologies ?? [],
  )
  const [githubUrl, setGithubUrl] = React.useState(existing?.githubUrl ?? "")
  const [demoUrl, setDemoUrl] = React.useState(existing?.demoUrl ?? "")

  const [image, setImage] = React.useState<StagedSubmissionUpload | null>(null)
  const [presentation, setPresentation] =
    React.useState<StagedSubmissionUpload | null>(null)
  const [removeImage, setRemoveImage] = React.useState(false)
  const [removePresentation, setRemovePresentation] = React.useState(false)

  const [submitting, setSubmitting] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  const editable =
    existing !== null &&
    (EDITABLE_STATUSES as readonly string[]).includes(existing.status)
  const deletable = editable

  // existing === null → create form (when eligible); with a submission → view
  // until the participant explicitly opens the edit form.
  const showingForm = existing ? mode === "form" : eligible

  function startEdit(): void {
    if (!existing) {return}
    setProjectName(existing.projectName)
    setTeamName(existing.teamName)
    setUniversity(existing.university)
    setDepartment(existing.department)
    setCategory(existing.category)
    setDescription(existing.description)
    setProblemStatement(existing.problemStatement)
    setProposedSolution(existing.proposedSolution)
    setTechnologies(existing.technologies)
    setGithubUrl(existing.githubUrl ?? "")
    setDemoUrl(existing.demoUrl ?? "")
    setImage(null)
    setPresentation(null)
    setRemoveImage(false)
    setRemovePresentation(false)
    setErrors({})
    setMode("form")
  }

  async function handleSubmit(): Promise<void> {
    const payload: Record<string, unknown> = {
      projectName: projectName.trim(),
      teamName: teamName.trim(),
      university: university.trim(),
      department: department.trim(),
      category: category.trim(),
      description: description.trim(),
      problemStatement: problemStatement.trim(),
      proposedSolution: proposedSolution.trim(),
      technologies,
      githubUrl: githubUrl.trim(),
      demoUrl: demoUrl.trim(),
    }

    if (image) {payload.imageToken = image.token}
    else if (removeImage) {payload.removeImage = true}
    if (presentation) {payload.presentationToken = presentation.token}
    else if (removePresentation) {payload.removePresentation = true}

    const schema = existing
      ? projectSubmissionUpdateSchema
      : projectSubmissionSchema
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
        existing ? `/api/submissions/project/${existing.id}` : "/api/submissions/project",
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
          setImage(null)
          setPresentation(null)
        }
        toast.error(
          json?.error ??
            (res.status === 429
              ? "Too many attempts. Please wait a moment and try again."
              : "Could not save the submission. Please try again."),
        )
        return
      }

      toast.success(json.message ?? "Project submission saved.")
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
      const res = await fetch(`/api/submissions/project/${existing.id}`, {
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

      toast.success(json.message ?? "Project submission deleted.")
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
            Register for Project Showcasing
          </Link>
        }
      >
        You must be registered for the Project Showcasing event before
        submitting a project. Registration is free and takes a few minutes.
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
              {existing ? "Edit project submission" : "Submit your project"}
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              {existing
                ? "Saving changes re-enters the review workflow, so the review team always sees your latest version."
                : "Submit your cybersecurity project for review. Approved projects are published in the public showcase."}
            </p>
          </div>

          <div className="space-y-5 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Project Name"
                placeholder="e.g. PhishGuard — Real-time Phishing Detector"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                error={errors.projectName}
                disabled={submitting}
                required
                className="sm:col-span-2"
              />
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
                placeholder="e.g. Network Security, AI for Security"
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
              <Input
                label="GitHub Repository (optional)"
                placeholder="https://github.com/…"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                error={errors.githubUrl}
                leftIcon={<Github size={16} />}
                disabled={submitting}
              />
              <Input
                label="Live Demo (optional)"
                placeholder="https://…"
                value={demoUrl}
                onChange={(e) => setDemoUrl(e.target.value)}
                error={errors.demoUrl}
                leftIcon={<Globe size={16} />}
                disabled={submitting}
              />
            </div>

            <Textarea
              label="Description"
              placeholder="What does your project do? Describe the idea, features, and current state."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={errors.description}
              maxLength={4000}
              helper="At least 30 characters"
              disabled={submitting}
              required
            />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Textarea
                label="Problem Statement"
                placeholder="Which problem does your project solve?"
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
                error={errors.problemStatement}
                maxLength={2000}
                helper="At least 20 characters"
                disabled={submitting}
                required
              />
              <Textarea
                label="Proposed Solution"
                placeholder="How does your project solve the problem?"
                value={proposedSolution}
                onChange={(e) => setProposedSolution(e.target.value)}
                error={errors.proposedSolution}
                maxLength={2000}
                helper="At least 20 characters"
                disabled={submitting}
                required
              />
            </div>

            <TagInput
              label="Technologies Used"
              values={technologies}
              onChange={setTechnologies}
              error={errors.technologies}
              helper="Press Enter after each technology — e.g. Python, TensorFlow, Docker"
              placeholder="Add a technology and press Enter"
              maxItems={15}
              maxLength={50}
              disabled={submitting}
              required
            />

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="space-y-3">
                {existing?.imageUrl && !image ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-elevated p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={existing.imageUrl}
                        alt="Current project image"
                        className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
                      />
                      <p className="truncate text-xs text-text-muted">
                        {removeImage
                          ? "Current image will be removed when you save."
                          : "Current image"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRemoveImage((v) => !v)}
                      className="shrink-0 text-xs text-cyan underline-offset-2 hover:underline"
                    >
                      {removeImage ? "Undo" : "Remove"}
                    </button>
                  </div>
                ) : null}
                <SubmissionUploadField
                  label="Project Image (optional)"
                  helper="A screenshot or cover image of your project. JPG, PNG or WebP up to 10MB."
                  scope="projectImage"
                  accept="image/jpeg,image/png,image/webp"
                  acceptHint="JPG, PNG, WebP"
                  maxSizeBytes={FILE_UPLOAD.projectImage.maxSizeBytes}
                  value={image}
                  onChange={(upload) => {
                    setImage(upload)
                    if (upload) {setRemoveImage(false)}
                  }}
                  error={errors.imageToken}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-3">
                {existing?.presentationUrl && !presentation ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-elevated p-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs text-text-muted">
                        {removePresentation
                          ? "Current presentation will be removed when you save."
                          : "Current presentation file"}
                      </p>
                      <a
                        href={existing.presentationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-xs text-cyan underline-offset-2 hover:underline"
                      >
                        View file
                        <ExternalLink size={11} aria-hidden="true" />
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRemovePresentation((v) => !v)}
                      className="shrink-0 text-xs text-cyan underline-offset-2 hover:underline"
                    >
                      {removePresentation ? "Undo" : "Remove"}
                    </button>
                  </div>
                ) : null}
                <SubmissionUploadField
                  label="Presentation File (optional)"
                  helper="Slides or a short PDF describing the project. PDF, JPG, PNG or WebP up to 25MB."
                  scope="presentationFile"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  acceptHint="PDF, JPG, PNG, WebP"
                  maxSizeBytes={FILE_UPLOAD.presentationFile.maxSizeBytes}
                  value={presentation}
                  onChange={(upload) => {
                    setPresentation(upload)
                    if (upload) {setRemovePresentation(false)}
                  }}
                  error={errors.presentationToken}
                  disabled={submitting}
                />
              </div>
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
                {existing ? "Save Changes" : "Submit Project"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── View mode (existing submission) ─────────────────────────────────────────
  // Reached only when `existing` is non-null (form mode covers the rest).
  if (!existing) {return null}

  const statusHint = STATUS_HINTS[existing.status] ?? existing.status.toLowerCase()

  return (
    <Card padding="none">
      <CardContent className="p-0">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-semibold text-text-primary">
                {existing.projectName}
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
            {existing.githubUrl ? (
              <div className="flex gap-2">
                <dt className="shrink-0 text-text-faint">Repository</dt>
                <dd>
                  <a
                    href={existing.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-cyan underline-offset-2 hover:underline"
                  >
                    {existing.githubUrl}
                    <ExternalLink size={11} aria-hidden="true" />
                  </a>
                </dd>
              </div>
            ) : null}
            {existing.demoUrl ? (
              <div className="flex gap-2">
                <dt className="shrink-0 text-text-faint">Live demo</dt>
                <dd>
                  <a
                    href={existing.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-cyan underline-offset-2 hover:underline"
                  >
                    {existing.demoUrl}
                    <ExternalLink size={11} aria-hidden="true" />
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>

          <div>
            <h4 className="font-mono text-xs uppercase tracking-widest text-text-faint">
              Technologies
            </h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {existing.technologies.map((tech) => (
                <span
                  key={tech}
                  className="rounded-md border border-cyan/30 bg-cyan/5 px-2 py-1 text-xs text-cyan"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-5">
            <div>
              <h4 className="font-mono text-xs uppercase tracking-widest text-text-faint">
                Description
              </h4>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-muted">
                {existing.description}
              </p>
            </div>
            <div>
              <h4 className="font-mono text-xs uppercase tracking-widest text-text-faint">
                Problem Statement
              </h4>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-muted">
                {existing.problemStatement}
              </p>
            </div>
            <div>
              <h4 className="font-mono text-xs uppercase tracking-widest text-text-faint">
                Proposed Solution
              </h4>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-muted">
                {existing.proposedSolution}
              </p>
            </div>
          </div>

          {existing.imageUrl || existing.presentationUrl ? (
            <div className="flex flex-wrap items-center gap-4 border-t border-border pt-5">
              {existing.imageUrl ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={existing.imageUrl}
                    alt="Project image"
                    className="h-14 w-14 rounded-md border border-border object-cover"
                  />
                  <a
                    href={existing.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-cyan underline-offset-2 hover:underline"
                  >
                    View image
                    <ExternalLink size={11} aria-hidden="true" />
                  </a>
                </div>
              ) : null}
              {existing.presentationUrl ? (
                <a
                  href={existing.presentationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-cyan underline-offset-2 hover:underline"
                >
                  View presentation file
                  <ExternalLink size={11} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardContent>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
        title="Delete project submission?"
        description="Your submission and uploaded files will be removed from review. You can submit a new project afterwards. This cannot be undone."
        confirmLabel="Delete Submission"
        cancelLabel="Keep It"
        variant="danger"
        loading={deleting}
      />
    </Card>
  )
}
