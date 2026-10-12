// =============================================================================
// DIU CyberCon 2026 — API Types
// Request/Response shapes for all API routes.
// =============================================================================

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type SignUpRequest = {
  email: string
  password: string
  name: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type ForgotPasswordRequest = {
  email: string
}

export type ResetPasswordRequest = {
  token: string
  password: string
}

export type VerifyEmailRequest = {
  token: string
}

// ─── Registration ─────────────────────────────────────────────────────────────

export type IndividualRegistrationRequest = {
  eventType: string
  fullName: string
  studentId: string
  department: string
  universityId: string
  phone: string
  tshirtSize: string
  studentIdFileKey: string
}

export type TeamRegistrationRequest = {
  eventType: string
  teamName: string
  leader: {
    fullName: string
    studentId: string
    department: string
    universityId: string
    phone: string
    tshirtSize: string
    studentIdFileKey: string
  }
  members: {
    fullName: string
    email: string
    studentId: string
    department: string
    universityId: string
    phone: string
    tshirtSize: string
    studentIdFileKey: string
  }[]
}

export type RegistrationConfirmation = {
  registrationId: string
  teamId: string | null
  eventName: string
  participantName: string
  teamName: string | null
  memberCount: number | null
}

// ─── Workshop Registration ────────────────────────────────────────────────────

export type WorkshopRegistrationRequest = {
  workshopId: string
}

// ─── Project Submission ───────────────────────────────────────────────────────

export type ProjectSubmissionRequest = {
  teamName: string
  projectName: string
  university: string
  department: string
  category: string
  description: string
  problemStatement: string
  proposedSolution: string
  technologies: string[]
  githubUrl?: string
  demoUrl?: string
  imageKey?: string
  presentationKey?: string
}

// ─── Poster Submission ────────────────────────────────────────────────────────

export type PosterSubmissionRequest = {
  teamName: string
  title: string
  authors: string[]
  university: string
  department: string
  abstract: string
  keywords: string[]
  category: string
  fileKey: string
  contactInfo: string
}

// ─── Sponsor Application ──────────────────────────────────────────────────────

export type SponsorApplicationRequest = {
  orgName: string
  contactPerson: string
  email: string
  phone: string
  website?: string
  tier: string
  logoKey?: string
  message?: string
}

// ─── Contact ──────────────────────────────────────────────────────────────────

export type ContactRequest = {
  name: string
  email: string
  subject: string
  message: string
}

// ─── Admin — Verification ─────────────────────────────────────────────────────

export type VerificationDecisionRequest = {
  status: "VERIFIED" | "REJECTED" | "REVISION_REQUIRED"
  note?: string
}

// ─── Admin — Settings ─────────────────────────────────────────────────────────

export type SettingUpdateRequest = {
  key: string
  value: string
}

export type BatchSettingsUpdateRequest = {
  settings: SettingUpdateRequest[]
}

// ─── Admin — Role Assignment ──────────────────────────────────────────────────

export type RoleAssignmentRequest = {
  userId: string
  adminRole: string | null
}

// ─── Check-in ─────────────────────────────────────────────────────────────────

export type CheckInRequest = {
  registrationId?: string
  qrToken?: string
}

export type CheckInActionRequest = {
  action: "CHECK_IN" | "CHECK_OUT"
}

// ─── File Upload ──────────────────────────────────────────────────────────────

export type FileUploadResponse = {
  fileKey: string
  publicUrl?: string
  fileName: string
  fileSizeBytes: number
  fileMimeType: string
}

// ─── Pagination query params ──────────────────────────────────────────────────

export type PaginationQuery = {
  page?: string | number
  pageSize?: string | number
}
