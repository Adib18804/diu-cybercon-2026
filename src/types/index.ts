// =============================================================================
// DIU CyberCon 2026 — Shared TypeScript Types
// =============================================================================

import type {
  User,
  ParticipantProfile,
  Event,
  EventRegistration,
  Team,
  TeamMember,
  StudentVerification,
  Workshop,
  Sponsor,
  Speaker,
  AuditLog,
} from "@prisma/client"

// ─── Re-export Prisma enums for convenience ───────────────────────────────────

export type {
  UserRole,
  AdminRole,
  VerificationStatus,
  EventType,
  EventStatus,
  RegistrationStatus,
  SubmissionStatus,
  SponsorTier,
  SponsorApplicationStatus,
  CheckInStatus,
  TShirtSize,
  SkillLevel,
} from "@prisma/client"

// ─── Composite / Enriched Types ───────────────────────────────────────────────

/** User with profile attached — used throughout dashboard */
export type UserWithProfile = User & {
  profile: ParticipantProfile | null
}

/** Team with full member details */
export type TeamWithMembers = Team & {
  members: (TeamMember & {
    profile: ParticipantProfile & {
      user: Pick<User, "id" | "email" | "emailVerified">
    }
    verification: StudentVerification | null
  })[]
  event: Pick<Event, "id" | "type" | "name" | "slug" | "minTeamSize" | "maxTeamSize">
}

/** Registration with event and team */
export type RegistrationWithDetails = EventRegistration & {
  event: Pick<Event, "id" | "type" | "name" | "slug" | "startDate" | "venue">
  team: TeamWithMembers | null
}

/** Participant profile with university + verification status */
export type ProfileWithVerification = ParticipantProfile & {
  user: Pick<User, "id" | "email" | "emailVerified" | "isSuspended">
  university: { id: string; name: string; shortName: string | null }
  teamMembers: (TeamMember & {
    verification: Pick<StudentVerification, "id" | "status"> | null
  })[]
}

/** Workshop with registration count */
export type WorkshopWithAvailability = Workshop & {
  seatsRemaining: number
  isOpen: boolean
  isDeadlinePassed: boolean
}

/** Speaker with panel memberships */
export type SpeakerWithPanels = Speaker & {
  panelists: {
    panel: { id: string; topic: string; sessionDate: Date | null }
    role: string | null
  }[]
}

/** Sponsor with computed tier label */
export type SponsorWithMeta = Sponsor & {
  tierLabel: string
  tagline: string
}

/** Audit log with actor info */
export type AuditLogWithActor = AuditLog & {
  actor: Pick<User, "id" | "email" | "name" | "adminRole">
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

export type ApiSuccess<T> = {
  success: true
  data: T
  message?: string
}

export type ApiError = {
  success: false
  error: string
  code?: string
  details?: Record<string, string[]>
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

export type PaginatedResponse<T> = ApiSuccess<T[]> & {
  pagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

// ─── Form State ───────────────────────────────────────────────────────────────

export type FormStatus = "idle" | "submitting" | "success" | "error"

export type FieldError = {
  field: string
  message: string
}

// ─── Registration Wizard ──────────────────────────────────────────────────────

export type RegistrationStep =
  | "select-event"
  | "participant-info"
  | "student-id-upload"
  | "team-info"
  | "team-members"
  | "review"
  | "terms"
  | "submit"
  | "confirmation"

export type TeamMemberFormData = {
  fullName: string
  studentId: string
  department: string
  universityId: string
  universityName: string
  phone: string
  email: string
  tshirtSize: string
  studentIdFile?: File
  studentIdPreview?: string
}

export type RegistrationWizardState = {
  step: RegistrationStep
  eventType: string | null
  isTeamEvent: boolean
  participantInfo: TeamMemberFormData | null
  teamName: string
  teamMembers: TeamMemberFormData[]
  termsAccepted: boolean
  registrationId: string | null
  error: string | null
}

// ─── Admin Filters ────────────────────────────────────────────────────────────

export type ParticipantFilters = {
  search?: string
  universityId?: string
  verificationStatus?: string
  eventType?: string
  page?: number
  pageSize?: number
}

export type TeamFilters = {
  search?: string
  eventType?: string
  minSize?: number
  maxSize?: number
  page?: number
  pageSize?: number
}

export type RegistrationFilters = {
  search?: string
  eventType?: string
  status?: string
  checkInStatus?: string
  page?: number
  pageSize?: number
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export type DashboardStats = {
  totalParticipants: number
  verifiedParticipants: number
  pendingVerification: number
  totalTeams: number
  ctfTeams: number
  traceRouteParticipants: number
  projectTeams: number
  posterTeams: number
  workshopRegistrations: number
  panelRegistrations: number
  sponsorApplications: number
  recentActivity: ActivityItem[]
}

export type ActivityItem = {
  id: string
  type: string
  message: string
  actorName: string
  timestamp: Date
  targetId?: string
}

// ─── Workshop ─────────────────────────────────────────────────────────────────

export type WorkshopCardData = {
  id: string
  title: string
  instructorName: string
  instructorOrg: string
  description: string
  skillLevel: string
  date: Date
  startTime: string
  endTime: string
  venue: string
  totalSeats: number
  registeredCount: number
  seatsRemaining: number
  registrationDeadline: Date
  requiredEquipment: string | null
  prerequisites: string | null
  isOpen: boolean
  isDeadlinePassed: boolean
  isUserRegistered?: boolean
}

// ─── QR Code ─────────────────────────────────────────────────────────────────

export type QRPayload = {
  rid: string  // registrationId — only field in QR
  iat: number  // issued at (unix timestamp)
  exp: number  // expires at (unix timestamp)
}

export type CheckInResult = {
  success: boolean
  participant?: {
    name: string
    registrationId: string
    events: string[]
    verificationStatus: string
    checkInStatus: string
  }
  error?: string
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export type ScheduleDay = {
  day: number
  date: string
  label: string
  isOnline: boolean
  items: ScheduleItemData[]
}

export type ScheduleItemData = {
  id: string
  startTime: string
  endTime: string
  title: string
  description: string | null
  venue: string | null
  type: string
  isHighlight: boolean
  speakerName?: string
  speakerOrg?: string
}

// ─── Sponsor Portal ───────────────────────────────────────────────────────────

export type SponsorBenefit = {
  benefit: string
  title: boolean
  platinum: boolean
  gold: boolean
}

// ─── Announcement ─────────────────────────────────────────────────────────────

export type AnnouncementCard = {
  id: string
  title: string
  content: string
  isPinned: boolean
  publishedAt: Date
  authorId: string
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export type NavLink = {
  label: string
  href: string
  accent?: string
  isNew?: boolean
}

// ─── Site Settings ────────────────────────────────────────────────────────────

export type SiteSettings = {
  heroTitle: string
  heroTagline: string
  heroDescription: string
  countdownTarget: string
  announcementBarText: string
  announcementBarVisible: boolean
  maintenanceMode: boolean
  registrationOpen: boolean
  venueName: string
  venueAddress: string
  venueMapEmbedUrl: string
}
