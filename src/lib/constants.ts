// =============================================================================
// DIU CyberCon 2026 — Application Constants
// Never hardcode these elsewhere — always import from here.
// =============================================================================

// ─── App Identity ─────────────────────────────────────────────────────────────

export const APP_NAME = "DIU CyberCon 2026" as const
export const APP_TAGLINE = "LEARN · SECURE · DEFEND" as const
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://www.diucybercon.com"
export const APP_EMAIL = "info@diucybercon.com" as const
export const APP_YEAR = 2026 as const

export const ORGANIZER = {
  name: "Cyber Security Club, Department of CSE",
  university: "Daffodil International University",
  shortName: "DIU CSC",
  website: "https://diu.edu.bd",
} as const

// ─── Event Dates ──────────────────────────────────────────────────────────────

export const EVENT_DATES = {
  day1: {
    date: "2026-10-24",
    label: "Day 01 · Online",
    description: "CTF Preliminary Round",
  },
  day2: {
    date: "2026-11-14",
    label: "Day 02 · On-site",
    description: "Project Showcasing · Poster Presentation · Trace & Route · Hands-on Activities",
  },
  day3: {
    date: "2026-11-15",
    label: "Day 03 · On-site",
    description: "CTF Final Round · Panel Discussion · Prize Giving · Closing Ceremony",
  },
  // Countdown target: Day 2 opening — main event
  countdownTarget: "2026-11-14T09:00:00+06:00",
} as const

// ─── Venue ────────────────────────────────────────────────────────────────────

export const VENUE = {
  name: "Daffodil Smart City (DSC)",
  address: "Birulia, Savar, Dhaka-1216, Bangladesh",
  shortAddress: "Birulia, Savar, Dhaka",
} as const

// ─── Registration ─────────────────────────────────────────────────────────────

export const REGISTRATION = {
  idPrefix: process.env.REGISTRATION_ID_PREFIX ?? "CYB26",
  idLength: 6, // CYB26-XXXXXX — 6 random chars after prefix

  // Default team size limits (overridable from admin settings)
  defaults: {
    ctfMinTeamSize: 2,
    ctfMaxTeamSize: 5, // Hard cap — never exceed this
    projectMinTeamSize: 1,
    projectMaxTeamSize: 5,
    posterMinTeamSize: 1,
    posterMaxTeamSize: 4,
  },
} as const

// ─── File Upload ──────────────────────────────────────────────────────────────

export const FILE_UPLOAD = {
  // Allowed MIME types for student ID uploads
  studentId: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ] as const,
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"] as const,
    // Magic bytes for client-side hint (server validates independently)
    maxSizeBytes:
      Number(process.env.MAX_STUDENT_ID_SIZE_BYTES) || 5 * 1024 * 1024, // 5MB
  },
  projectImage: {
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"] as const,
    maxSizeBytes:
      Number(process.env.MAX_PROJECT_IMAGE_SIZE_BYTES) || 10 * 1024 * 1024, // 10MB
  },
  posterFile: {
    allowedMimeTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ] as const,
    allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png", ".webp"] as const,
    maxSizeBytes:
      Number(process.env.MAX_POSTER_FILE_SIZE_BYTES) || 20 * 1024 * 1024, // 20MB
  },
  presentationFile: {
    allowedMimeTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ] as const,
    allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png", ".webp"] as const,
    maxSizeBytes:
      Number(process.env.MAX_PRESENTATION_FILE_SIZE_BYTES) ||
      25 * 1024 * 1024, // 25MB
  },
  sponsorLogo: {
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/svg+xml",
    ] as const,
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".svg"] as const,
    maxSizeBytes:
      Number(process.env.MAX_SPONSOR_LOGO_SIZE_BYTES) || 5 * 1024 * 1024, // 5MB
  },
  gallery: {
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
    allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"] as const,
    maxSizeBytes: 15 * 1024 * 1024, // 15MB
  },
} as const

// Magic byte signatures for server-side MIME validation
export const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/jpg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header (check offset 8 for WEBP)
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
}

// ─── Signed URL ───────────────────────────────────────────────────────────────

export const SIGNED_URL = {
  ttlSeconds: Number(process.env.SIGNED_URL_TTL_SECONDS) || 300, // 5 minutes max
} as const

// ─── Rate Limiting ────────────────────────────────────────────────────────────

export const RATE_LIMIT = {
  global: {
    points: 100,
    durationSeconds: 15 * 60, // 15 minutes
    blockDurationSeconds: 15 * 60,
  },
  registration: {
    points: 10,
    durationSeconds: 60 * 60, // 1 hour
    blockDurationSeconds: 60 * 60,
  },
  submission: {
    points: 30,
    durationSeconds: 60 * 60, // 1 hour
    blockDurationSeconds: 60 * 60,
  },
  sponsorApplication: {
    points: 10,
    durationSeconds: 60 * 60,
    blockDurationSeconds: 60 * 60,
  },
  login: {
    points: 5,
    durationSeconds: 15 * 60,
    blockDurationSeconds: 15 * 60,
  },
  passwordReset: {
    points: 3,
    durationSeconds: 60 * 60,
    blockDurationSeconds: 60 * 60,
  },
  fileUpload: {
    points: 20,
    durationSeconds: 60 * 60,
    blockDurationSeconds: 60 * 60,
  },
  contactForm: {
    points: 5,
    durationSeconds: 60 * 60,
    blockDurationSeconds: 2 * 60 * 60,
  },
  unsubscribe: {
    // Generous on purpose: mailbox providers send RFC 8058 one-click POSTs
    // from shared IP pools. This limiter only bounds abuse — the mutation
    // itself is idempotent.
    points: 60,
    durationSeconds: 60 * 60,
    blockDurationSeconds: 60 * 60,
  },
} as const

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const AUTH = {
  sessionMaxAge: Number(process.env.AUTH_SESSION_MAX_AGE) || 7 * 24 * 60 * 60, // 7 days
  passwordResetExpiry: 60 * 60, // 1 hour (seconds)
  emailVerificationExpiry: 24 * 60 * 60, // 24 hours (seconds)
  bcryptCost: 12, // argon2 equivalent cost
  qrTokenExpiry: Number(process.env.QR_TOKEN_EXPIRY) || 24 * 60 * 60, // 24 hours
} as const

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PAGINATION = {
  defaultPageSize: 20,
  maxPageSize: 100,
  adminDefaultPageSize: 25,
  adminMaxPageSize: 200,
} as const

// ─── Event Module Metadata ────────────────────────────────────────────────────
// Display info only — not DB data. DB data is seeded via prisma/seed.ts.

export const EVENT_MODULES = {
  CTF: {
    slug: "ctf",
    name: "Capture The Flag",
    shortName: "CTF",
    icon: "terminal",
    accentColor: "#00e5ff",
    isTeam: true,
    isSolo: false,
    day: 1,
    href: "/events/ctf",
  },
  TRACE_ROUTE: {
    slug: "trace-route",
    name: "Trace & Route",
    shortName: "T&R",
    icon: "network",
    accentColor: "#39ff14",
    isTeam: false,
    isSolo: true,
    day: 2,
    href: "/events/trace-route",
  },
  PROJECT_SHOWCASE: {
    slug: "project-showcase",
    name: "Project Showcasing",
    shortName: "Project",
    icon: "folder-open",
    accentColor: "#7c3aed",
    isTeam: true,
    isSolo: false,
    day: 2,
    href: "/events/project-showcase",
  },
  POSTER_PRESENTATION: {
    slug: "poster",
    name: "Poster Presentation",
    shortName: "Poster",
    icon: "image",
    accentColor: "#ff2e88",
    isTeam: true,
    isSolo: false,
    day: 2,
    href: "/events/poster",
  },
  PANEL_DISCUSSION: {
    slug: "panel",
    name: "Panel Discussion",
    shortName: "Panel",
    icon: "users",
    accentColor: "#ffb020",
    isTeam: false,
    isSolo: false,
    isAttendance: true,
    day: 3,
    href: "/events/panel",
  },
  HANDS_ON: {
    slug: "workshops",
    name: "Hands-on Activities",
    shortName: "Workshops",
    icon: "wrench",
    accentColor: "#7c3aed",
    isTeam: false,
    isSolo: false,
    isIndividual: true,
    day: 2,
    href: "/events/workshops",
  },
} as const

// ─── CTF Domains ─────────────────────────────────────────────────────────────

export const CTF_DOMAINS = [
  "Web Security & Exploitation",
  "Cryptography",
  "Digital Forensics",
  "Reverse Engineering",
  "Binary Exploitation / Pwn",
  "OSINT",
  "Network Security",
  "Miscellaneous",
] as const

// ─── Sponsor Tiers ───────────────────────────────────────────────────────────

export const SPONSOR_TIERS = {
  TITLE: {
    label: "Title Sponsor",
    priceBDT: 1000000,
    priceDisplay: "BDT 10,00,000",
    tagline: "Presented by",
    accentColor: "#ffb020",
  },
  PLATINUM: {
    label: "Platinum Sponsor",
    priceBDT: 700000,
    priceDisplay: "BDT 7,00,000",
    tagline: "Powered by",
    accentColor: "#8b949e",
  },
  GOLD: {
    label: "Gold Sponsor",
    priceBDT: 500000,
    priceDisplay: "BDT 5,00,000",
    tagline: "Associate with",
    accentColor: "#ffb020",
  },
  CUSTOM: {
    label: "Custom Sponsorship",
    priceBDT: null,
    priceDisplay: "Flexible",
    tagline: "Partner",
    accentColor: "#00e5ff",
  },
} as const

// Sponsor benefits matrix — from official proposal, do not invent extras
export const SPONSOR_BENEFITS = [
  { benefit: "Logo on Event Banner & Website", title: true, platinum: true, gold: true },
  { benefit: "Logo on T-Shirt", title: true, platinum: true, gold: false },
  { benefit: "Logo on Invitation Letter", title: true, platinum: true, gold: false },
  { benefit: "Logo on Crest", title: true, platinum: true, gold: false },
  { benefit: "Logo on Gift Box", title: true, platinum: true, gold: true },
  { benefit: "Presented By Credit", title: true, platinum: false, gold: false },
  { benefit: "Powered By Credit", title: false, platinum: true, gold: false },
  { benefit: "Associate With Credit", title: false, platinum: false, gold: true },
  { benefit: "Event Announcements", title: true, platinum: true, gold: true },
  { benefit: "Media Coverage Mention", title: true, platinum: true, gold: true },
  { benefit: "Maximum Banner Visibility", title: true, platinum: false, gold: false },
  { benefit: "Premium Banner Visibility", title: false, platinum: true, gold: false },
] as const

// ─── Sponsor Application Status Pipeline ──────────────────────────────────────

export const SPONSOR_APP_STATUSES = [
  "SUBMITTED",
  "CONTACTED",
  "NEGOTIATION",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
] as const

// ─── 2025 Legacy Stats (historical — labeled clearly) ─────────────────────────

export const LEGACY_2025 = {
  year: 2025,
  teams: 212,
  universities: 53,
  colleges: 5,
  schools: 3,
  professionals: 5,
  totalOrgs: 66, // 53 + 5 + 3 + 5
  mediaTypes: ["National TV", "Tech Blogs", "University Channels"],
} as const

// ─── T-Shirt Sizes ────────────────────────────────────────────────────────────

export const TSHIRT_SIZES = ["M", "L", "XL", "XXL", "XXXL"] as const

// ─── Navigation ───────────────────────────────────────────────────────────────

export const NAV_LINKS = [
  { label: "Events", href: "/events" },
  { label: "Schedule", href: "/schedule" },
  { label: "Speakers", href: "/speakers" },
  { label: "Sponsors", href: "/sponsors" },
  { label: "Gallery", href: "/gallery" },
  { label: "Venue", href: "/venue" },
  { label: "FAQ", href: "/faq" },
] as const

export const NAV_EVENT_LINKS = [
  { label: "Capture The Flag", href: "/events/ctf", accent: "#00e5ff" },
  { label: "Trace & Route", href: "/events/trace-route", accent: "#39ff14" },
  { label: "Project Showcase", href: "/events/project-showcase", accent: "#7c3aed" },
  { label: "Poster Presentation", href: "/events/poster", accent: "#ff2e88" },
  { label: "Panel Discussion", href: "/events/panel", accent: "#ffb020" },
  { label: "Hands-on Activities", href: "/events/workshops", accent: "#7c3aed" },
] as const

// ─── Admin ────────────────────────────────────────────────────────────────────

export const ADMIN_ROLES = [
  { role: "SUPER_ADMIN", label: "Super Admin", description: "Full access to everything" },
  { role: "EVENT_ADMIN", label: "Event Admin", description: "Events, schedule, speakers, panels, workshops" },
  { role: "REGISTRATION_ADMIN", label: "Registration Admin", description: "Participants, teams, registrations, check-in" },
  { role: "CONTENT_ADMIN", label: "Content Admin", description: "Announcements, gallery, FAQ, homepage content" },
  { role: "SPONSORSHIP_ADMIN", label: "Sponsorship Admin", description: "Sponsors, applications, partners" },
  { role: "VERIFICATION_ADMIN", label: "Verification Admin", description: "Student ID verification queue only" },
] as const

// ─── HTTP Status Messages ─────────────────────────────────────────────────────
// User-friendly messages — never expose internals

export const ERROR_MESSAGES = {
  UNAUTHORIZED: "You must be logged in to access this.",
  FORBIDDEN: "You do not have permission to perform this action.",
  NOT_FOUND: "The requested resource was not found.",
  INTERNAL: "An unexpected error occurred. Please try again.",
  RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  VALIDATION: "Please check your input and try again.",
  DUPLICATE_EMAIL: "An account with this email already exists.",
  DUPLICATE_STUDENT_ID: "This student ID is already registered.",
  DUPLICATE_REGISTRATION: "You are already registered for this event.",
  DUPLICATE_TEAM_MEMBER: "This participant is already a member of your team.",
  TEAM_FULL: "This team has reached its maximum size.",
  TEAM_TOO_SMALL: "This team does not meet the minimum team size for this event.",
  EVENT_CLOSED: "Registration for this event is currently closed.",
  EVENT_FULL: "This event has reached its participant limit.",
  WORKSHOP_FULL: "This workshop is fully booked.",
  WORKSHOP_DEADLINE_PASSED: "The registration deadline for this workshop has passed.",
  FILE_TOO_LARGE: "The uploaded file exceeds the maximum allowed size.",
  FILE_TYPE_INVALID: "This file type is not allowed. Please upload a valid file.",
  FILE_CORRUPTED: "The uploaded file could not be verified. Please try again.",
  EMAIL_NOT_VERIFIED: "Please verify your email address before proceeding.",
  SESSION_EXPIRED: "Your session has expired. Please log in again.",
  INVALID_TOKEN: "This link is invalid or has expired.",
} as const
