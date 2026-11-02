// =============================================================================
// DIU_CYBERCON 2026 — Admin Validation Schemas (Zod)
// Every admin API route validates its payload with these schemas server-side.
// The client may pre-validate for UX, but the server ALWAYS re-validates —
// never trust the client.
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

/** Admin-uploaded asset URL — absolute http(s) as returned by /api/admin/upload. */
const adminAssetUrl = z
  .string()
  .trim()
  .max(500, "URL is too long")
  .regex(
    /^https?:\/\/\S+$/i,
    "Upload an image first — the URL must start with http:// or https://",
  )

const optionalAssetUrl = z
  .union([adminAssetUrl, z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v))

/** Integer with sane bounds, coerced from strings (form inputs). */
const boundedInt = (min: number, max: number, label: string) =>
  z.coerce
    .number()
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`)

/** Display order — non-negative small integer. */
const displayOrder = boundedInt(0, 9999, "Display order").default(0)

/** DateTime from ISO string or Date, must parse. */
const dateTime = z.coerce.date({
  errorMap: () => ({ message: "Enter a valid date and time" }),
})

/** Time string "HH:MM" (24h) — stored as plain string in the schema. */
const timeString = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time format HH:MM")

const stringArray = (min: number, max: number, itemMax: number, label: string) =>
  z
    .array(z.string().trim().min(1, `${label} cannot be empty`).max(itemMax))
    .min(min, `Add at least ${min} ${label.toLowerCase()}${min > 1 ? "s" : ""}`)
    .max(max, `Too many ${label.toLowerCase()}s`)

// ─── Enums — must mirror prisma/schema.prisma exactly ─────────────────────────

const tshirtSizeEnum = z.enum(["M", "L", "XL", "XXL", "XXXL"])
const skillLevelEnum = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"])
const eventStatusEnum = z.enum(["DRAFT", "OPEN", "CLOSED", "COMPLETED"])
const registrationStatusEnum = z.enum([
  "PENDING",
  "PRELIM_APPROVED",
  "PAYMENT_PENDING",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
  "WAITLISTED",
])
const submissionStatusEnum = z.enum([
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "REVISION_REQUIRED",
  "PUBLISHED",
])
const sponsorTierEnum = z.enum([
  "TITLE",
  "PLATINUM",
  "GOLD",
  "CUSTOM",
  "PARTNER",
  "MEDIA_PARTNER",
  "TECHNICAL_PARTNER",
  "OTHER_PARTNER",
])
const sponsorAppStatusEnum = z.enum([
  "SUBMITTED",
  "CONTACTED",
  "NEGOTIATION",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
])
const adminRoleEnum = z.enum([
  "SUPER_ADMIN",
  "EVENT_ADMIN",
  "REGISTRATION_ADMIN",
  "CONTENT_ADMIN",
  "SPONSORSHIP_ADMIN",
  "VERIFICATION_ADMIN",
])

// =============================================================================
// Participants
// =============================================================================

export const participantUpdateSchema = z.object({
  fullName: singleLineText(2, 100, "Full name is required"),
  department: singleLineText(2, 100, "Department is required"),
  phone: z
    .string()
    .trim()
    .regex(
      /^(?:\+88|88)?01[3-9]\d{8}$/,
      "Enter a valid Bangladeshi phone number",
    ),
  tshirtSize: tshirtSizeEnum,
  studentId: singleLineText(3, 40, "Student ID is required"),
})
export type ParticipantUpdateInput = z.infer<typeof participantUpdateSchema>

// =============================================================================
// Event registration settings
// =============================================================================

const nullableDateTime = z.preprocess(
  (value) => (value === null ? null : value),
  z.union([dateTime, z.null()]),
)

export const eventSettingsUpdateSchema = z
  .object({
    startDate: nullableDateTime.optional(),
    endDate: nullableDateTime.optional(),
    registrationDeadline: nullableDateTime.optional(),
    registrationFee: z.coerce.number().finite().min(0).max(99999999.99)
      .refine((value) => Math.round(value * 100) === value * 100, "Use at most two decimal places")
      .optional(),
    venue: z.string().trim().min(2).max(180).optional(),
    registrationOpen: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one event setting to update",
  })

export type EventSettingsUpdateInput = z.infer<typeof eventSettingsUpdateSchema>

export const userSuspendSchema = z.object({
  suspend: z.boolean(),
  reason: z
    .string()
    .trim()
    .max(300, "Reason is too long")
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
})
export type UserSuspendInput = z.infer<typeof userSuspendSchema>

// =============================================================================
// Verification
// =============================================================================

export const verificationDecisionSchema = z
  .object({
    decision: z.enum(["VERIFIED", "REJECTED", "REVISION_REQUIRED"]),
    note: z
      .string()
      .trim()
      .max(500, "Note is too long")
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
  })
  .refine((data) => data.decision === "VERIFIED" || !!data.note, {
    message: "A note is required when rejecting or requesting a revision",
    path: ["note"],
  })
export type VerificationDecisionInput = z.infer<
  typeof verificationDecisionSchema
>

// =============================================================================
// Teams
// =============================================================================

export const teamUpdateSchema = z.object({
  name: singleLineText(3, 60, "Team name is required"),
})
export type TeamUpdateInput = z.infer<typeof teamUpdateSchema>

// =============================================================================
// Registrations
// =============================================================================

export const registrationStatusUpdateSchema = z
  .object({
    status: registrationStatusEnum,
    reason: z.string().trim().min(5, "Provide a rejection reason").max(500).optional(),
  })
  .refine((data) => data.status !== "REJECTED" || Boolean(data.reason), {
    message: "A reason is required when rejecting a registration.",
    path: ["reason"],
  })
export type RegistrationStatusUpdateInput = z.infer<
  typeof registrationStatusUpdateSchema
>

// =============================================================================
// Check-in
// =============================================================================

export const checkInLookupSchema = z
  .object({
    /** Signed QR token payload (from the participant's QR code). */
    token: z.string().trim().min(10).max(500).optional(),
    /** Manual fallback — event-coded registration ID. */
    registrationId: z
      .string()
      .trim()
      .regex(/^CYB26-(?:C|TR|P|PJ|PN|W)-\d{3,}-[A-HJ-NP-Z2-9]{6}$/, "Enter a valid registration ID")
      .optional(),
  })
  .refine((data) => !!data.token || !!data.registrationId, {
    message: "Provide a QR token or a registration ID",
    path: ["registrationId"],
  })
export type CheckInLookupInput = z.infer<typeof checkInLookupSchema>

export const checkInActionSchema = z.object({
  registrationId: z
    .string()
    .trim()
    .regex(
      /^CYB26-(?:C|TR|P|PJ|PN|W)-\d{3,}-[A-HJ-NP-Z2-9]{6}$/,
      "Enter a valid registration ID",
    ),
  action: z.enum(["CHECK_IN", "CHECK_OUT"]),
})
export type CheckInActionInput = z.infer<typeof checkInActionSchema>

// =============================================================================
// Submissions — project / poster review
// =============================================================================

export const projectReviewSchema = z
  .object({
    status: submissionStatusEnum,
    reviewNote: z
      .string()
      .trim()
      .max(500, "Note is too long")
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
    isFeatured: z.boolean().optional(),
  })
  .refine(
    (data) =>
      !["REJECTED", "REVISION_REQUIRED"].includes(data.status) ||
      !!data.reviewNote,
    {
      message: "A note is required when rejecting or requesting a revision",
      path: ["reviewNote"],
    },
  )
export type ProjectReviewInput = z.infer<typeof projectReviewSchema>

export const posterReviewSchema = projectReviewSchema
export type PosterReviewInput = z.infer<typeof posterReviewSchema>

// =============================================================================
// Workshops
// =============================================================================

const workshopBaseSchema = z.object({
  title: singleLineText(3, 150, "Workshop title is required"),
  instructorName: singleLineText(2, 100, "Instructor name is required"),
  instructorOrg: singleLineText(2, 150, "Instructor organization is required"),
  instructorBio: longText(0, 1000, "Bio is too long").optional(),
  description: longText(10, 2000, "Description is required"),
  skillLevel: skillLevelEnum,
  date: dateTime,
  startTime: timeString,
  endTime: timeString,
  venue: singleLineText(2, 150, "Venue is required"),
  totalSeats: boundedInt(1, 1000, "Total seats"),
  registrationDeadline: dateTime,
  requiredEquipment: z
    .string()
    .trim()
    .max(500, "Too long")
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  prerequisites: z
    .string()
    .trim()
    .max(500, "Too long")
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  status: eventStatusEnum.default("DRAFT"),
  displayOrder,
})

export const workshopCreateSchema = workshopBaseSchema
export type WorkshopCreateInput = z.infer<typeof workshopCreateSchema>

export const workshopUpdateSchema = workshopBaseSchema.partial()
export type WorkshopUpdateInput = z.infer<typeof workshopUpdateSchema>

// =============================================================================
// Speakers
// =============================================================================

const speakerBaseSchema = z.object({
  name: singleLineText(2, 100, "Speaker name is required"),
  title: singleLineText(2, 120, "Professional title is required"),
  organization: singleLineText(2, 150, "Organization is required"),
  bio: longText(0, 2000, "Bio is too long").optional(),
  expertise: stringArray(0, 10, 60, "Expertise area"),
  /** Absolute URL from /api/admin/upload (speakers folder). */
  photoUrl: optionalAssetUrl,
  linkedinUrl: optionalHttpUrl,
  twitterUrl: optionalHttpUrl,
  websiteUrl: optionalHttpUrl,
  isVisible: z.boolean().default(false),
  displayOrder,
})

export const speakerCreateSchema = speakerBaseSchema
export type SpeakerCreateInput = z.infer<typeof speakerCreateSchema>

export const speakerUpdateSchema = speakerBaseSchema.partial()
export type SpeakerUpdateInput = z.infer<typeof speakerUpdateSchema>

// =============================================================================
// Panels
// =============================================================================

const panelistSchema = z.object({
  speakerId: z.string().trim().min(1, "Select a speaker"),
  role: z
    .string()
    .trim()
    .max(60, "Role is too long")
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
})

const panelBaseSchema = z.object({
  topic: singleLineText(3, 200, "Panel topic is required"),
  description: longText(0, 2000, "Description is too long").optional(),
  moderatorId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  sessionDate: dateTime.optional(),
  startTime: z
    .union([timeString, z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  endTime: z
    .union([timeString, z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  venue: z
    .string()
    .trim()
    .max(150, "Venue is too long")
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  status: eventStatusEnum.default("DRAFT"),
  displayOrder,
  panelists: z
    .array(panelistSchema)
    .max(12, "Too many panelists")
    .default([]),
})

export const panelCreateSchema = panelBaseSchema
export type PanelCreateInput = z.infer<typeof panelCreateSchema>

export const panelUpdateSchema = panelBaseSchema.partial()
export type PanelUpdateInput = z.infer<typeof panelUpdateSchema>

// =============================================================================
// Schedule
// =============================================================================

const scheduleBaseSchema = z.object({
  day: boundedInt(1, 3, "Day"),
  date: dateTime,
  startTime: timeString,
  endTime: timeString,
  title: singleLineText(3, 200, "Title is required"),
  description: longText(0, 1000, "Description is too long").optional(),
  venue: z
    .string()
    .trim()
    .max(150, "Venue is too long")
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  type: singleLineText(2, 50, "Type is required"),
  eventId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  speakerId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  isHighlight: z.boolean().default(false),
  displayOrder,
})

export const scheduleItemCreateSchema = scheduleBaseSchema
export type ScheduleItemCreateInput = z.infer<typeof scheduleItemCreateSchema>

export const scheduleItemUpdateSchema = scheduleBaseSchema.partial()
export type ScheduleItemUpdateInput = z.infer<
  typeof scheduleItemUpdateSchema
>

// =============================================================================
// Sponsors
// =============================================================================

const sponsorBaseSchema = z.object({
  name: singleLineText(2, 100, "Sponsor name is required"),
  tier: sponsorTierEnum,
  /** Absolute URL from /api/admin/upload (sponsors folder). */
  logoUrl: optionalAssetUrl,
  websiteUrl: optionalHttpUrl,
  description: longText(0, 500, "Description is too long").optional(),
  year: boundedInt(2024, 2100, "Year").default(2026),
  isActive: z.boolean().default(true),
  displayOrder,
})

export const sponsorCreateSchema = sponsorBaseSchema
export type SponsorCreateInput = z.infer<typeof sponsorCreateSchema>

export const sponsorUpdateSchema = sponsorBaseSchema.partial()
export type SponsorUpdateInput = z.infer<typeof sponsorUpdateSchema>

// ─── Sponsor applications ─────────────────────────────────────────────────────

export const sponsorAppUpdateSchema = z.object({
  status: sponsorAppStatusEnum.optional(),
  internalNotes: z
    .string()
    .trim()
    .max(2000, "Notes are too long")
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  assignedTo: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
})
export type SponsorAppUpdateInput = z.infer<typeof sponsorAppUpdateSchema>

// =============================================================================
// Partners
// =============================================================================

const partnerBaseSchema = z.object({
  name: singleLineText(2, 100, "Partner name is required"),
  category: singleLineText(2, 60, "Category is required"),
  /** Absolute URL from /api/admin/upload (partners folder). */
  logoUrl: optionalAssetUrl,
  websiteUrl: optionalHttpUrl,
  isActive: z.boolean().default(true),
  displayOrder,
})

export const partnerCreateSchema = partnerBaseSchema
export type PartnerCreateInput = z.infer<typeof partnerCreateSchema>

export const partnerUpdateSchema = partnerBaseSchema.partial()
export type PartnerUpdateInput = z.infer<typeof partnerUpdateSchema>

// =============================================================================
// Announcements
// =============================================================================

const announcementBaseSchema = z.object({
  title: singleLineText(3, 200, "Title is required"),
  content: longText(10, 5000, "Content is required"),
  isPinned: z.boolean().default(false),
  isPublished: z.boolean().default(false),
})

export const announcementCreateSchema = announcementBaseSchema
export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>

export const announcementUpdateSchema = announcementBaseSchema.partial()
export type AnnouncementUpdateInput = z.infer<
  typeof announcementUpdateSchema
>

// =============================================================================
// Gallery
// =============================================================================

const galleryBaseSchema = z.object({
  title: z
    .string()
    .trim()
    .max(150, "Title is too long")
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  /** Absolute URL from /api/admin/upload (gallery folder). */
  imageUrl: adminAssetUrl,
  category: singleLineText(2, 60, "Category is required").default("general"),
  altText: singleLineText(3, 200, "Alt text is required"),
  year: boundedInt(2024, 2100, "Year").default(2026),
  displayOrder,
  isPublished: z.boolean().default(false),
})

export const galleryCreateSchema = galleryBaseSchema
export type GalleryCreateInput = z.infer<typeof galleryCreateSchema>

export const galleryUpdateSchema = galleryBaseSchema.partial()
export type GalleryUpdateInput = z.infer<typeof galleryUpdateSchema>

// =============================================================================
// FAQ
// =============================================================================

const faqBaseSchema = z.object({
  question: singleLineText(5, 300, "Question is required"),
  answer: longText(5, 3000, "Answer is required"),
  category: singleLineText(2, 60, "Category is required").default("general"),
  displayOrder,
  isPublished: z.boolean().default(true),
})

export const faqCreateSchema = faqBaseSchema
export type FaqCreateInput = z.infer<typeof faqCreateSchema>

export const faqUpdateSchema = faqBaseSchema.partial()
export type FaqUpdateInput = z.infer<typeof faqUpdateSchema>

// =============================================================================
// Contact messages
// =============================================================================

export const contactMessageUpdateSchema = z.object({
  isRead: z.boolean().optional(),
  markReplied: z.boolean().optional(),
})
export type ContactMessageUpdateInput = z.infer<
  typeof contactMessageUpdateSchema
>

// =============================================================================
// Settings
// =============================================================================

const settingUpdateSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2, "Key is required")
    .max(100, "Key is too long")
    .regex(
      /^[a-zA-Z][a-zA-Z0-9._-]*$/,
      "Keys use letters, numbers, dots, dashes and underscores",
    ),
  value: z.string().max(5000, "Value is too long"),
})

export const settingsUpdateSchema = z.object({
  updates: z
    .array(settingUpdateSchema)
    .min(1, "No settings to update")
    .max(100, "Too many settings in one request"),
})
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>

// =============================================================================
// Admin roles
// =============================================================================

export const roleAssignSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address"),
  adminRole: adminRoleEnum,
})
export type RoleAssignInput = z.infer<typeof roleAssignSchema>
