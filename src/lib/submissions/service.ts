// =============================================================================
// DIU CyberCon 2026 — Submission Service
// All business rules for Project Showcasing + Poster Presentation submissions.
// Routes stay thin: auth → validate → call service → respond.
//
// Design:
// - Every rule is enforced server-side; the client is never trusted.
// - Submitters must hold a non-cancelled registration for the target event.
// - One active submission per user per type (soft-deleted rows don't count).
// - Editing is only possible while the submission is not under/after review
//   in a locked state; a successful edit resets the status to SUBMITTED so
//   the review workflow always runs on the latest content.
// - Staged public upload tokens are HMAC-verified and bound to the owner.
// =============================================================================

import { prisma } from "@/lib/db"
import {
  deletePublicFile,
  verifySignedPublicUploadTokenWithFile,
} from "@/lib/storage"
import type {
  PosterSubmissionCreateInput,
  PosterSubmissionUpdateInput,
  ProjectSubmissionCreateInput,
  ProjectSubmissionUpdateInput,
} from "@/lib/validations/submission"

// ─── Error type ───────────────────────────────────────────────────────────────

/**
 * Domain error thrown by submission rules. The route maps it to a clean
 * JSON response — messages are user-safe, stack traces never leave the server.
 */
export class SubmissionError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: Record<string, string[]>

  constructor(
    message: string,
    code: string,
    status = 400,
    details?: Record<string, string[]>,
  ) {
    super(message)
    this.name = "SubmissionError"
    this.code = code
    this.status = status
    this.details = details
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Event slugs that own the two submission types. */
export const SUBMISSION_EVENT_SLUGS = {
  project: "project-showcase",
  poster: "poster",
} as const

/** Statuses in which the owner may still edit the submission. */
const EDITABLE_STATUSES = ["SUBMITTED", "REVISION_REQUIRED", "REJECTED"] as const

/** Statuses in which the owner may soft-delete the submission. */
const DELETABLE_STATUSES = [
  "SUBMITTED",
  "REVISION_REQUIRED",
  "REJECTED",
] as const

// ─── Shared guards ────────────────────────────────────────────────────────────

type RegistrationGate = {
  eventId: string
  eventName: string
  registrationId: string
  teamId: string | null
}

/**
 * The user must be registered (non-cancelled) for the submission's event.
 * Returns the event + registration facts, or throws a SubmissionError.
 */
async function requireSubmittableRegistration(
  userId: string,
  eventSlug: string,
): Promise<RegistrationGate> {
  const event = await prisma.event.findUnique({
    where: { slug: eventSlug },
    select: { id: true, name: true },
  })
  if (!event) {
    throw new SubmissionError("Event not found.", "EVENT_NOT_FOUND", 404)
  }

  const registration = await prisma.eventRegistration.findFirst({
    where: { userId, eventId: event.id, status: { not: "CANCELLED" } },
    select: { registrationId: true, teamId: true },
  })
  if (!registration) {
    throw new SubmissionError(
      `You must be registered for ${event.name} before submitting.`,
      "REGISTRATION_REQUIRED",
      403,
    )
  }

  return {
    eventId: event.id,
    eventName: event.name,
    registrationId: registration.registrationId,
    teamId: registration.teamId,
  }
}

/** Resolve an optional staged upload token → storage key (or throw). */
async function resolveOptionalUpload(
  token: string | undefined,
  userId: string,
  field: string,
  label: string,
): Promise<string | null | undefined> {
  if (token === undefined) {return undefined}
  const upload = await verifySignedPublicUploadTokenWithFile(token, userId)
  if (!upload) {
    throw new SubmissionError(
      `Your ${label} upload has expired. Please re-upload it.`,
      "UPLOAD_EXPIRED",
      400,
      { [field]: ["Upload expired — please re-upload"] },
    )
  }
  return upload.key
}

/** Resolve a mandatory staged upload token → storage key (or throw). */
async function resolveRequiredUpload(
  token: string,
  userId: string,
  field: string,
  label: string,
): Promise<string> {
  const upload = await verifySignedPublicUploadTokenWithFile(token, userId)
  if (!upload) {
    throw new SubmissionError(
      `Your ${label} upload has expired. Please re-upload it.`,
      "UPLOAD_EXPIRED",
      400,
      { [field]: ["Upload expired — please re-upload"] },
    )
  }
  return upload.key
}

// ─── Project Showcasing ───────────────────────────────────────────────────────

export type ProjectSummary = {
  id: string
  projectName: string
  teamName: string
  status: string
  imageUrl: string | null
  presentationUrl: string | null
}

function toProjectSummary(row: {
  id: string
  projectName: string
  teamName: string
  status: string
  imageKey: string | null
  presentationKey: string | null
}): ProjectSummary {
  return {
    id: row.id,
    projectName: row.projectName,
    teamName: row.teamName,
    status: row.status,
    imageUrl: row.imageKey ? `/uploads/${row.imageKey}` : null,
    presentationUrl: row.presentationKey ? `/uploads/${row.presentationKey}` : null,
  }
}

export async function createProjectSubmission(args: {
  userId: string
  input: ProjectSubmissionCreateInput
}): Promise<ProjectSummary> {
  const { userId, input } = args

  await requireSubmittableRegistration(userId, SUBMISSION_EVENT_SLUGS.project)

  const existing = await prisma.project.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  })
  if (existing) {
    throw new SubmissionError(
      "You already have a project submission. Edit it from My Submissions.",
      "DUPLICATE_SUBMISSION",
      409,
    )
  }

  const imageKey = await resolveOptionalUpload(
    input.imageToken,
    userId,
    "imageToken",
    "project image",
  )
  const presentationKey = await resolveOptionalUpload(
    input.presentationToken,
    userId,
    "presentationToken",
    "presentation file",
  )

  const created = await prisma.project.create({
    data: {
      userId,
      projectName: input.projectName,
      teamName: input.teamName,
      university: input.university,
      department: input.department,
      category: input.category,
      description: input.description,
      problemStatement: input.problemStatement,
      proposedSolution: input.proposedSolution,
      technologies: input.technologies,
      githubUrl: input.githubUrl ?? null,
      demoUrl: input.demoUrl ?? null,
      imageKey: imageKey ?? null,
      presentationKey: presentationKey ?? null,
      status: "SUBMITTED",
    },
    select: {
      id: true,
      projectName: true,
      teamName: true,
      status: true,
      imageKey: true,
      presentationKey: true,
    },
  })

  return toProjectSummary(created)
}

export async function updateProjectSubmission(args: {
  userId: string
  submissionId: string
  input: ProjectSubmissionUpdateInput
}): Promise<ProjectSummary> {
  const { userId, submissionId, input } = args

  const project = await prisma.project.findFirst({
    where: { id: submissionId, deletedAt: null },
    select: {
      id: true,
      userId: true,
      status: true,
      imageKey: true,
      presentationKey: true,
    },
  })
  if (!project) {
    throw new SubmissionError("Submission not found.", "NOT_FOUND", 404)
  }
  if (project.userId !== userId) {
    throw new SubmissionError(
      "You can only edit your own submission.",
      "FORBIDDEN",
      403,
    )
  }
  if (!(EDITABLE_STATUSES as readonly string[]).includes(project.status)) {
    throw new SubmissionError(
      "This submission can no longer be edited. Contact the organizers if you need changes.",
      "SUBMISSION_LOCKED",
      409,
    )
  }

  // ── Resolve uploads ─────────────────────────────────────────────────────────
  const imageKey = await resolveOptionalUpload(
    input.imageToken,
    userId,
    "imageToken",
    "project image",
  )
  const presentationKey = await resolveOptionalUpload(
    input.presentationToken,
    userId,
    "presentationToken",
    "presentation file",
  )

  // ── Build the change set (only provided fields) ────────────────────────────
  const data: Record<string, unknown> = {}
  if (input.projectName !== undefined) {data.projectName = input.projectName}
  if (input.teamName !== undefined) {data.teamName = input.teamName}
  if (input.university !== undefined) {data.university = input.university}
  if (input.department !== undefined) {data.department = input.department}
  if (input.category !== undefined) {data.category = input.category}
  if (input.description !== undefined) {data.description = input.description}
  if (input.problemStatement !== undefined) {
    data.problemStatement = input.problemStatement
  }
  if (input.proposedSolution !== undefined) {
    data.proposedSolution = input.proposedSolution
  }
  if (input.technologies !== undefined) {data.technologies = input.technologies}
  if (input.githubUrl !== undefined) {data.githubUrl = input.githubUrl ?? null}
  if (input.demoUrl !== undefined) {data.demoUrl = input.demoUrl ?? null}

  const staleKeys: string[] = []

  if (imageKey !== undefined) {
    data.imageKey = imageKey
    if (project.imageKey && project.imageKey !== imageKey) {
      staleKeys.push(project.imageKey)
    }
  } else if (input.removeImage === true) {
    data.imageKey = null
    if (project.imageKey) {staleKeys.push(project.imageKey)}
  }

  if (presentationKey !== undefined) {
    data.presentationKey = presentationKey
    if (project.presentationKey && project.presentationKey !== presentationKey) {
      staleKeys.push(project.presentationKey)
    }
  } else if (input.removePresentation === true) {
    data.presentationKey = null
    if (project.presentationKey) {staleKeys.push(project.presentationKey)}
  }

  // An edit always re-enters the review workflow.
  data.status = "SUBMITTED"

  const updated = await prisma.project.update({
    where: { id: project.id },
    data,
    select: {
      id: true,
      projectName: true,
      teamName: true,
      status: true,
      imageKey: true,
      presentationKey: true,
    },
  })

  // Best-effort cleanup of replaced/removed files (never blocks the update).
  for (const key of staleKeys) {
    const deleted = await deletePublicFile(key)
    if (!deleted) {
      console.warn(`[submissions] stale public file not removed: ${key}`)
    }
  }

  return toProjectSummary(updated)
}

export async function deleteProjectSubmission(args: {
  userId: string
  submissionId: string
}): Promise<void> {
  const { userId, submissionId } = args

  const project = await prisma.project.findFirst({
    where: { id: submissionId, deletedAt: null },
    select: { id: true, userId: true, status: true },
  })
  if (!project) {
    throw new SubmissionError("Submission not found.", "NOT_FOUND", 404)
  }
  if (project.userId !== userId) {
    throw new SubmissionError(
      "You can only delete your own submission.",
      "FORBIDDEN",
      403,
    )
  }
  if (!(DELETABLE_STATUSES as readonly string[]).includes(project.status)) {
    throw new SubmissionError(
      "Approved or published submissions cannot be deleted. Contact the organizers if you need changes.",
      "SUBMISSION_LOCKED",
      409,
    )
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { deletedAt: new Date() },
  })
}

// ─── Poster Presentation ──────────────────────────────────────────────────────

export type PosterSummary = {
  id: string
  title: string
  teamName: string
  status: string
  fileUrl: string
}

function toPosterSummary(row: {
  id: string
  title: string
  teamName: string
  status: string
  fileKey: string
}): PosterSummary {
  return {
    id: row.id,
    title: row.title,
    teamName: row.teamName,
    status: row.status,
    fileUrl: `/uploads/${row.fileKey}`,
  }
}

export async function createPosterSubmission(args: {
  userId: string
  input: PosterSubmissionCreateInput
}): Promise<PosterSummary> {
  const { userId, input } = args

  await requireSubmittableRegistration(userId, SUBMISSION_EVENT_SLUGS.poster)

  const existing = await prisma.poster.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true },
  })
  if (existing) {
    throw new SubmissionError(
      "You already have a poster submission. Edit it from My Submissions.",
      "DUPLICATE_SUBMISSION",
      409,
    )
  }

  const fileKey = await resolveRequiredUpload(
    input.posterToken,
    userId,
    "posterToken",
    "poster file",
  )

  const created = await prisma.poster.create({
    data: {
      userId,
      title: input.title,
      teamName: input.teamName,
      authors: input.authors,
      university: input.university,
      department: input.department,
      abstract: input.abstract,
      keywords: input.keywords,
      category: input.category,
      contactInfo: input.contactInfo,
      fileKey,
      status: "SUBMITTED",
    },
    select: {
      id: true,
      title: true,
      teamName: true,
      status: true,
      fileKey: true,
    },
  })

  return toPosterSummary(created)
}

export async function updatePosterSubmission(args: {
  userId: string
  submissionId: string
  input: PosterSubmissionUpdateInput
}): Promise<PosterSummary> {
  const { userId, submissionId, input } = args

  const poster = await prisma.poster.findFirst({
    where: { id: submissionId, deletedAt: null },
    select: { id: true, userId: true, status: true, fileKey: true },
  })
  if (!poster) {
    throw new SubmissionError("Submission not found.", "NOT_FOUND", 404)
  }
  if (poster.userId !== userId) {
    throw new SubmissionError(
      "You can only edit your own submission.",
      "FORBIDDEN",
      403,
    )
  }
  if (!(EDITABLE_STATUSES as readonly string[]).includes(poster.status)) {
    throw new SubmissionError(
      "This submission can no longer be edited. Contact the organizers if you need changes.",
      "SUBMISSION_LOCKED",
      409,
    )
  }

  const fileKey = await resolveOptionalUpload(
    input.posterToken,
    userId,
    "posterToken",
    "poster file",
  )

  const data: Record<string, unknown> = {}
  if (input.title !== undefined) {data.title = input.title}
  if (input.teamName !== undefined) {data.teamName = input.teamName}
  if (input.authors !== undefined) {data.authors = input.authors}
  if (input.university !== undefined) {data.university = input.university}
  if (input.department !== undefined) {data.department = input.department}
  if (input.abstract !== undefined) {data.abstract = input.abstract}
  if (input.keywords !== undefined) {data.keywords = input.keywords}
  if (input.category !== undefined) {data.category = input.category}
  if (input.contactInfo !== undefined) {data.contactInfo = input.contactInfo}

  const staleKeys: string[] = []
  if (fileKey !== undefined) {
    data.fileKey = fileKey
    if (poster.fileKey && poster.fileKey !== fileKey) {
      staleKeys.push(poster.fileKey)
    }
  }

  // An edit always re-enters the review workflow.
  data.status = "SUBMITTED"

  const updated = await prisma.poster.update({
    where: { id: poster.id },
    data,
    select: {
      id: true,
      title: true,
      teamName: true,
      status: true,
      fileKey: true,
    },
  })

  for (const key of staleKeys) {
    const deleted = await deletePublicFile(key)
    if (!deleted) {
      console.warn(`[submissions] stale public file not removed: ${key}`)
    }
  }

  return toPosterSummary(updated)
}

export async function deletePosterSubmission(args: {
  userId: string
  submissionId: string
}): Promise<void> {
  const { userId, submissionId } = args

  const poster = await prisma.poster.findFirst({
    where: { id: submissionId, deletedAt: null },
    select: { id: true, userId: true, status: true },
  })
  if (!poster) {
    throw new SubmissionError("Submission not found.", "NOT_FOUND", 404)
  }
  if (poster.userId !== userId) {
    throw new SubmissionError(
      "You can only delete your own submission.",
      "FORBIDDEN",
      403,
    )
  }
  if (!(DELETABLE_STATUSES as readonly string[]).includes(poster.status)) {
    throw new SubmissionError(
      "Approved or published submissions cannot be deleted. Contact the organizers if you need changes.",
      "SUBMISSION_LOCKED",
      409,
    )
  }

  await prisma.poster.update({
    where: { id: poster.id },
    data: { deletedAt: new Date() },
  })
}
