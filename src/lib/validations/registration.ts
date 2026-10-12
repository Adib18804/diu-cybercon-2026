// =============================================================================
// DIU CyberCon 2026 — Registration Validation Schemas (Zod)
// Shared between client (wizard form validation) and server (API validation).
// Server ALWAYS validates independently of the client.
// =============================================================================

import { z } from "zod"

import { isValidBDPhone } from "@/lib/utils"

// ─── Reusable field schemas ───────────────────────────────────────────────────

export const registrationEmailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .max(254, "Email is too long")
  .transform((v) => v.toLowerCase().trim())

export const fullNameSchema = z
  .string()
  .min(2, "Full name must be at least 2 characters")
  .max(100, "Full name is too long")
  .regex(
    /^[a-zA-Z\s\-.']+$/,
    "Name can only contain letters, spaces, hyphens, dots, and apostrophes",
  )
  .transform((v) => v.trim().replace(/\s+/g, " "))

export const studentIdSchema = z
  .string()
  .min(2, "Student ID must be at least 2 characters")
  .max(40, "Student ID is too long")
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9\-_./ ]{1,39}$/,
    "Student ID may only contain letters, numbers, hyphens, dots, slashes, and spaces",
  )
  .transform((v) => v.trim().replace(/\s+/g, " "))

export const departmentSchema = z
  .string()
  .min(2, "Department must be at least 2 characters")
  .max(120, "Department is too long")
  .transform((v) => v.trim().replace(/\s+/g, " "))

export const universityNameSchema = z
  .string()
  .min(2, "Institution name must be at least 2 characters")
  .max(160, "Institution name is too long")
  .transform((v) => v.trim().replace(/\s+/g, " "))

export const phoneSchema = z
  .string()
  .min(11, "Phone number is too short")
  .max(20, "Phone number is too long")
  .refine(
    (v) => isValidBDPhone(v),
    "Enter a valid Bangladeshi mobile number (e.g. 01XXXXXXXXX)",
  )
  .transform((v) => v.replace(/\s|-/g, ""))

export const tshirtSizeSchema = z.enum(["M", "L", "XL", "XXL", "XXXL"], {
  errorMap: () => ({ message: "Select a t-shirt size" }),
})

export const teamNameSchema = z
  .string()
  .min(3, "Team name must be at least 3 characters")
  .max(60, "Team name is too long")
  .transform((v) => v.trim().replace(/\s+/g, " "))

export const verificationUploadSchema = z.object({
  token:    z.string().min(20, "Upload is missing or invalid").max(2048),
  fileName: z.string().min(1, "File name is missing").max(255),
})

// ─── Participant profile (wizard payload) ────────────────────────────────────

const universityFields = {
  universityId:   z.string().min(1).max(40).optional(),
  universityName: universityNameSchema.optional(),
}

export const participantProfileSchema = z
  .object({
    fullName:   fullNameSchema,
    studentId:  studentIdSchema,
    department: departmentSchema,
    phone:      phoneSchema,
    tshirtSize: tshirtSizeSchema,
    ...universityFields,
  })
  .refine((data) => Boolean(data.universityId ?? data.universityName), {
    message: "Select your institution",
    path: ["universityId"],
  })

export type ParticipantProfileInput = z.infer<typeof participantProfileSchema>

// ─── Team member (includes own email + student ID upload) ────────────────────

export const teamMemberSchema = z
  .object({
    fullName:   fullNameSchema,
    studentId:  studentIdSchema,
    department: departmentSchema,
    phone:      phoneSchema,
    tshirtSize: tshirtSizeSchema,
    email:      registrationEmailSchema,
    verification: verificationUploadSchema,
    ...universityFields,
  })
  .refine((data) => Boolean(data.universityId ?? data.universityName), {
    message: "Select the member's institution",
    path: ["universityId"],
  })

export type TeamMemberInput = z.infer<typeof teamMemberSchema>

// ─── Submit registration ─────────────────────────────────────────────────────

export const submitRegistrationSchema = z.object({
  eventId: z.string().min(1, "Event is required").max(40),
  participant: participantProfileSchema.and(
    z.object({ verification: verificationUploadSchema }),
  ),
  team: z
    .object({
      name:    teamNameSchema,
      members: z.array(teamMemberSchema).max(10, "Too many team members").default([]),
    })
    .optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms to register" }),
  }),
})

export type SubmitRegistrationInput = z.infer<typeof submitRegistrationSchema>

// ─── Workshop registration ───────────────────────────────────────────────────

export const workshopRegistrationSchema = z.object({
  workshopId: z.string().min(1, "Workshop is required").max(40),
  participant: participantProfileSchema.and(
    z.object({ verification: verificationUploadSchema }),
  ),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms to register" }),
  }),
})

export type WorkshopRegistrationInput = z.infer<
  typeof workshopRegistrationSchema
>

// ─── Team management (dashboard, later phase) ────────────────────────────────

export const teamRenameSchema = z.object({
  name: teamNameSchema,
})

export const teamMemberUpdateSchema = z
  .object({
    fullName:   fullNameSchema.optional(),
    department: departmentSchema.optional(),
    phone:      phoneSchema.optional(),
    tshirtSize: tshirtSizeSchema.optional(),
    ...universityFields,
  })
  .refine(
    (data) =>
      data.fullName !== undefined ||
      data.department !== undefined ||
      data.phone !== undefined ||
      data.tshirtSize !== undefined ||
      data.universityId !== undefined ||
      data.universityName !== undefined,
    { message: "No changes provided" },
  )
