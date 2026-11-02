// =============================================================================
// DIU_CYBERCON 2026 — Submission Validation Schemas (Zod)
// Project Showcasing + Poster Presentation submissions.
// Shared shape between client forms and the API — the server ALWAYS validates
// independently (never trust the client), and upload tokens are only verified
// server-side against the public storage root.
// =============================================================================

import { z } from "zod"

// ─── Reusable primitives ──────────────────────────────────────────────────────

/** Single-line text — trimmed, inner whitespace collapsed. */
const singleLineText = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .min(min, message)
    .max(max, `Must be at most ${max} characters`)
    .transform((v) => v.replace(/\s+/g, " "))

/** Long/form text — trimmed but keeps paragraph breaks. */
const longText = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .min(min, message)
    .max(max, `Must be at most ${max} characters`)

/** Optional link — only http(s) URLs, empty string treated as absent. */
const optionalHttpUrl = z
  .union([
    z
      .string()
      .trim()
      .max(300, "Link is too long")
      .regex(
        /^https?:\/\/\S+$/i,
        "Enter a valid link starting with http:// or https://",
      ),
    z.literal(""),
  ])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v))

/** HMAC-signed upload token minted by /api/upload/submission. */
const uploadToken = z
  .string()
  .min(20, "Upload is missing or invalid")
  .max(2048)

const technologiesSchema = z
  .array(
    z.string().trim().min(1, "Technology cannot be empty").max(50),
  )
  .min(1, "Add at least one technology")
  .max(15, "Too many technologies")

const authorsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(2, "Author name is too short")
      .max(100, "Author name is too long"),
  )
  .min(1, "Add at least one author")
  .max(15, "Too many authors")

const keywordsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(2, "Keyword is too short")
      .max(40, "Keyword is too long"),
  )
  .min(1, "Add at least one keyword")
  .max(10, "Too many keywords")

// ─── Project Showcasing ───────────────────────────────────────────────────────

export const projectSubmissionSchema = z.object({
  projectName: singleLineText(3, 150, "Project name is required"),
  teamName: singleLineText(2, 80, "Team name is required"),
  university: singleLineText(2, 160, "University is required"),
  department: singleLineText(2, 120, "Department is required"),
  category: singleLineText(2, 80, "Category is required"),
  description: longText(30, 4000, "Description must be at least 30 characters"),
  problemStatement: longText(
    20,
    2000,
    "Problem statement must be at least 20 characters",
  ),
  proposedSolution: longText(
    20,
    2000,
    "Proposed solution must be at least 20 characters",
  ),
  technologies: technologiesSchema,
  githubUrl: optionalHttpUrl,
  demoUrl: optionalHttpUrl,
  /** Staged upload tokens — verified server-side, never trusted as keys. */
  imageToken: uploadToken.optional(),
  presentationToken: uploadToken.optional(),
})

export const projectSubmissionUpdateSchema = projectSubmissionSchema
  .partial()
  .extend({
    removeImage: z.boolean().optional(),
    removePresentation: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "No changes provided",
  })

export type ProjectSubmissionCreateInput = z.infer<
  typeof projectSubmissionSchema
>
export type ProjectSubmissionUpdateInput = z.infer<
  typeof projectSubmissionUpdateSchema
>

// ─── Poster Presentation ──────────────────────────────────────────────────────

export const posterSubmissionSchema = z.object({
  title: singleLineText(3, 200, "Poster title is required"),
  teamName: singleLineText(2, 80, "Team name is required"),
  authors: authorsSchema,
  university: singleLineText(2, 160, "University is required"),
  department: singleLineText(2, 120, "Department is required"),
  abstract: longText(30, 5000, "Abstract must be at least 30 characters"),
  keywords: keywordsSchema,
  category: singleLineText(2, 80, "Category is required"),
  contactInfo: singleLineText(
    5,
    200,
    "Contact info is required (email or phone)",
  ),
  /** Poster file is mandatory for a poster submission. */
  posterToken: uploadToken,
})

export const posterSubmissionUpdateSchema = posterSubmissionSchema
  .partial()
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "No changes provided",
  })

export type PosterSubmissionCreateInput = z.infer<typeof posterSubmissionSchema>
export type PosterSubmissionUpdateInput = z.infer<
  typeof posterSubmissionUpdateSchema
>
