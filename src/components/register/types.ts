// =============================================================================
// Registration wizard — shared serializable types
// Passed from the /register server page to the client wizard. Only plain
// JSON-safe values cross the boundary (dates are pre-formatted or ISO).
// =============================================================================

export const UNIVERSITY_OTHER = "__other__"

export const TSHIRT_SIZES = ["M", "L", "XL", "XXL", "XXXL"] as const
export type TShirtSizeValue = (typeof TSHIRT_SIZES)[number]

// ─── Event option (non-HANDS_ON modules) ─────────────────────────────────────

export interface WizardEvent {
  id: string
  type: string
  name: string
  slug: string
  shortDescription: string
  venue: string | null
  prizes: string | null
  isTeamEvent: boolean
  /** Resolved team limits (leader included) — same rules the API enforces. */
  minTeamSize: number
  maxTeamSize: number
  participantLimit: number | null
  registrationFee: string
  registeredCount: number
  registrationDeadline: string | null
  deadlineLabel: string | null
  isOpen: boolean
  alreadyRegistered: boolean
  rules: string | null
}

// ─── Workshop option (Hands-on Activities) ───────────────────────────────────

export interface WizardWorkshop {
  id: string
  title: string
  skillLevel: string
  dateLabel: string
  startTime: string
  endTime: string
  venue: string
  registrationFee: string
  seatsLeft: number
  alreadyRegistered: boolean
}

// ─── Supporting data ─────────────────────────────────────────────────────────

export interface UniversityOption {
  id: string
  name: string
  shortName: string | null
}

export interface ViewerProfile {
  fullName: string
  studentId: string
  department: string
  phone: string
  tshirtSize: string
  universityId: string
}

export interface Viewer {
  name: string | null
  email: string
  profile: ViewerProfile | null
}

// ─── Wizard form values ──────────────────────────────────────────────────────

export interface ParticipantFormValues {
  fullName: string
  studentId: string
  department: string
  phone: string
  tshirtSize: string
  /** University id, UNIVERSITY_OTHER, or "" when not chosen yet. */
  universityId: string
  /** Free-text institution name — used when universityId === UNIVERSITY_OTHER. */
  universityName: string
}

export function emptyParticipantForm(): ParticipantFormValues {
  return {
    fullName: "",
    studentId: "",
    department: "",
    phone: "",
    tshirtSize: "",
    universityId: "",
    universityName: "",
  }
}

export interface MemberFormValues extends ParticipantFormValues {
  email: string
}

// ─── Staged upload (result of POST /api/upload/document) ─────────────────────

export interface StagedUpload {
  token: string
  fileName: string
  sizeBytes: number
}

// ─── Submission outcome (success screen) ─────────────────────────────────────

export interface RegisteredEntry {
  registrationId: string
  participantName: string
  isLeader: boolean
  qrDataUrl: string | null
}

export interface RegistrationOutcome {
  mode: "event" | "workshop"
  eventType?: string
  /** Event name or workshop title. */
  title: string
  teamName: string | null
  emailSent: boolean
  registrations: RegisteredEntry[]
  registrationFee?: string
  bkashNumber?: string
  /** Workshops only — remaining seats after this registration. */
  seatsRemaining: number | null
}
