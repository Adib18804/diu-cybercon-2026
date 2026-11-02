// =============================================================================
// DIU_CYBERCON 2026 — Registration Service
// All business rules for event + workshop registration live here.
// Routes stay thin: auth → validate → call service → respond.
//
// Design:
// - Every rule is enforced server-side; the client is never trusted.
// - One participant row per user per event (@@unique([eventId, userId])).
// - Team size clamped by hard caps that admins can never exceed.
// - All multi-row writes run in a single interactive transaction.
// - Student-ID upload tokens are HMAC-verified and bound to the leader.
// =============================================================================

import { Prisma, type EventType, type RegistrationPhase, type TShirtSize } from "@prisma/client"

import { REGISTRATION } from "@/lib/constants"
import { prisma } from "@/lib/db"
import { generateRegistrationId } from "@/lib/registrations/id"
import { sanitizeFilename } from "@/lib/security/file-validation"
import { verifySignedUploadTokenWithFile } from "@/lib/storage"
import { isDeadlinePassed } from "@/lib/utils"
import type {
  InnovationSymposiumRegistrationInput,
  SubmitRegistrationInput,
  TeamMemberInput,
  WorkshopRegistrationInput,
} from "@/lib/validations/registration"

// ─── Error type ───────────────────────────────────────────────────────────────

/**
 * Domain error thrown by registration rules. The route maps it to a clean
 * JSON response — messages are user-safe, stack traces never leave the server.
 */
export class RegistrationError extends Error {
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
    this.name = "RegistrationError"
    this.code = code
    this.status = status
    this.details = details
  }
}

// ─── Team size limits ─────────────────────────────────────────────────────────

/** Absolute caps per event type — admins can lower but never exceed these. */
const HARD_LIMITS: Partial<Record<EventType, { min: number; max: number }>> = {
  CTF: { min: 2, max: 4 },
  INNOVATION_SYMPOSIUM: { min: 1, max: 3 },
  PROJECT_SHOWCASE: { min: 1, max: 5 },
  POSTER_PRESENTATION: { min: 1, max: 4 },
}

/**
 * Effective team limits for an event: admin-set values (if any) clamped
 * against per-type defaults and absolute hard caps.
 * Sizes INCLUDE the team leader.
 */
export function resolveTeamLimits(event: {
  type: EventType
  minTeamSize: number | null
  maxTeamSize: number | null
}): { min: number; max: number } {
  const d = REGISTRATION.defaults
  const defaultsByType: Partial<Record<EventType, { min: number; max: number }>> = {
    CTF: { min: d.ctfMinTeamSize, max: d.ctfMaxTeamSize },
    INNOVATION_SYMPOSIUM: { min: 1, max: 3 },
    PROJECT_SHOWCASE: { min: d.projectMinTeamSize, max: d.projectMaxTeamSize },
    POSTER_PRESENTATION: { min: d.posterMinTeamSize, max: d.posterMaxTeamSize },
  }

  const fallback = defaultsByType[event.type] ?? { min: 1, max: 5 }
  const hard = HARD_LIMITS[event.type] ?? { min: 1, max: 10 }

  const clamp = (value: number, lo: number, hi: number): number =>
    Math.max(lo, Math.min(value, hi))

  const min = clamp(event.minTeamSize ?? fallback.min, hard.min, hard.max)
  const max = Math.max(min, clamp(event.maxTeamSize ?? fallback.max, hard.min, hard.max))

  return { min, max }
}

// ─── University resolution ────────────────────────────────────────────────────

type UniversityInput = { universityId?: string; universityName?: string }

/**
 * Resolve the university FK for a participant.
 * - Known institution → use it (must be active).
 * - Free-text name → reuse an existing match (case-insensitive) or create
 *   a new entry (type OTHER) for admin review.
 *
 * NOTE: must be called OUTSIDE the interactive transaction — a P2002 unique
 * race on create aborts a Postgres tx, so the catch/refetch has to happen on
 * the plain client.
 */
export async function resolveUniversityId(
  client: Prisma.TransactionClient,
  input: UniversityInput,
): Promise<string> {
  if (input.universityId) {
    const uni = await client.university.findUnique({
      where: { id: input.universityId },
      select: { id: true, isActive: true },
    })
    if (!uni || !uni.isActive) {
      throw new RegistrationError(
        "The selected institution is not available.",
        "INVALID_UNIVERSITY",
        400,
        { universityId: ["Select a valid institution"] },
      )
    }
    return uni.id
  }

  const name = (input.universityName ?? "").trim()
  if (!name) {
    throw new RegistrationError(
      "Institution is required.",
      "INVALID_UNIVERSITY",
      400,
      { universityId: ["Select your institution"] },
    )
  }

  const existing = await client.university.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true, isActive: true },
  })
  if (existing) {
    if (!existing.isActive) {
      throw new RegistrationError(
        "This institution is not available for registration.",
        "INVALID_UNIVERSITY",
        400,
      )
    }
    return existing.id
  }

  try {
    const created = await client.university.create({
      data: { name, type: "OTHER" },
      select: { id: true },
    })
    return created.id
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const raced = await client.university.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      })
      if (raced) {return raced.id}
    }
    throw err
  }
}

// ─── Self profile upsert ──────────────────────────────────────────────────────

type SelfProfilePayload = {
  fullName: string
  studentId: string
  department: string
  phone: string
  tshirtSize: TShirtSize
}

/**
 * Create or update the authenticated user's own participant profile.
 * Self-edits are allowed (it is their own data), but their student ID must
 * not collide with another account (case-insensitive).
 */
async function upsertSelfProfile(
  tx: Prisma.TransactionClient,
  userId: string,
  payload: SelfProfilePayload & { universityId: string },
): Promise<{ id: string }> {
  const collision = await tx.participantProfile.findFirst({
    where: {
      studentId: { equals: payload.studentId, mode: "insensitive" },
      NOT: { userId },
    },
    select: { id: true },
  })
  if (collision) {
    throw new RegistrationError(
      "This student ID is already registered with another account.",
      "DUPLICATE_STUDENT_ID",
      409,
      { studentId: ["This student ID is already registered"] },
    )
  }

  const existing = await tx.participantProfile.findUnique({
    where: { userId },
    select: { id: true },
  })

  if (existing) {
    return tx.participantProfile.update({
      where: { userId },
      data: {
        fullName: payload.fullName,
        studentId: payload.studentId,
        department: payload.department,
        phone: payload.phone,
        tshirtSize: payload.tshirtSize,
        universityId: payload.universityId,
      },
      select: { id: true },
    })
  }

  return tx.participantProfile.create({
    data: {
      userId,
      fullName: payload.fullName,
      studentId: payload.studentId,
      department: payload.department,
      phone: payload.phone,
      tshirtSize: payload.tshirtSize,
      universityId: payload.universityId,
    },
    select: { id: true },
  })
}

// ─── Registration ID generation ───────────────────────────────────────────────

/**
 * Generate a unique event-coded CYB26 registration ID inside a transaction.
 * Retries a few times in the unlikely event of a collision.
 */
async function generateUniqueRegistrationId(
  tx: Prisma.TransactionClient,
  eventId: string,
  eventType: EventType,
): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const counter = await tx.eventRegistrationCounter.upsert({
      where: { eventId },
      create: { eventId, lastValue: 101 },
      update: { lastValue: { increment: 1 } },
      select: { lastValue: true },
    })
    const candidate = generateRegistrationId(eventType, counter.lastValue)
    const taken = await tx.eventRegistration.findUnique({
      where: { registrationId: candidate },
      select: { id: true },
    })
    if (!taken) {return candidate}
  }
  throw new RegistrationError(
    "Could not allocate a registration ID. Please try again.",
    "INTERNAL",
    500,
  )
}

// ─── Team dissolution (re-registration cleanup) ───────────────────────────────

/**
 * Soft-delete a team while freeing its unique name for reuse.
 * The name is suffixed so @@unique([name, eventId]) does not collide with a
 * future team using the same name.
 */
async function dissolveTeam(
  tx: Prisma.TransactionClient,
  teamId: string,
): Promise<void> {
  const team = await tx.team.findUnique({
    where: { id: teamId },
    select: { name: true },
  })
  if (!team) {return}

  const base = team.name.slice(0, 36)
  const suffix = Date.now().toString(36)
  await tx.team.update({
    where: { id: teamId },
    data: { deletedAt: new Date(), name: `${base} [cancelled-${suffix}]` },
  })
}

// ─── Shared transaction helpers (registration wizard + team management) ──────

export type AttachMemberInput = {
  fullName: string
  studentId: string
  department: string
  phone: string
  tshirtSize: TShirtSize
  email: string
}

export type AttachedMember = {
  userId: string
  teamMemberId: string
  name: string
  email: string
  existingRegistrationId: string | null
}

/**
 * Attach one participant to a team inside a transaction.
 *
 * Identity resolution (never duplicates accounts):
 * - Existing profile with the same student ID → emails must match.
 * - No profile but email belongs to an account with a different student ID → conflict.
 * - Otherwise a shadow account + profile is created for the member.
 *
 * Enforces: one active team per event, one active registration per event.
 * `errorKeyPrefix` scopes field errors for the calling form
 * (e.g. `team.members.0` in the wizard, `member` on the team dashboard).
 */
export async function attachMemberToTeam(
  tx: Prisma.TransactionClient,
  args: {
    teamId: string
    eventId: string
    member: AttachMemberInput
    universityId: string
    errorKeyPrefix: string
  },
): Promise<AttachedMember> {
  const { teamId, eventId, member, universityId, errorKeyPrefix } = args

  // Identity: existing profile by student ID (case-insensitive)
  const existingProfile = await tx.participantProfile.findFirst({
    where: { studentId: { equals: member.studentId, mode: "insensitive" } },
    select: {
      id: true,
      userId: true,
      user: { select: { email: true } },
    },
  })

  let memberProfileId: string
  let memberUserId: string

  if (existingProfile) {
    // Must be the same person — email has to match
    if (existingProfile.user.email.toLowerCase() !== member.email) {
      throw new RegistrationError(
        `Student ID ${member.studentId} is already registered with a different email address.`,
        "MEMBER_IDENTITY_CONFLICT",
        409,
        {
          [`${errorKeyPrefix}.studentId`]: [
            "This student ID belongs to a different account",
          ],
        },
      )
    }
    memberProfileId = existingProfile.id
    memberUserId = existingProfile.userId
  } else {
    // No profile for this student ID — match or create a user by email
    const existingUser = await tx.user.findUnique({
      where: { email: member.email },
      select: { id: true, profile: { select: { id: true } } },
    })
    if (existingUser?.profile) {
      throw new RegistrationError(
        `The email ${member.email} is already linked to a different student ID.`,
        "MEMBER_IDENTITY_CONFLICT",
        409,
        {
          [`${errorKeyPrefix}.email`]: [
            "This email is linked to a different student ID",
          ],
        },
      )
    }

    memberUserId = existingUser
      ? existingUser.id
      : (
          await tx.user.create({
            data: {
              email: member.email,
              name: member.fullName,
              role: "PARTICIPANT",
            },
            select: { id: true },
          })
        ).id

    const createdProfile = await tx.participantProfile.create({
      data: {
        userId: memberUserId,
        fullName: member.fullName,
        studentId: member.studentId,
        department: member.department,
        phone: member.phone,
        tshirtSize: member.tshirtSize,
        universityId,
      },
      select: { id: true },
    })
    memberProfileId = createdProfile.id
  }

  // Member must not already be in an active team for this event
  const inTeam = await tx.teamMember.findFirst({
    where: {
      profileId: memberProfileId,
      team: { eventId, deletedAt: null },
    },
    select: { id: true, teamId: true },
  })
  if (inTeam) {
    const sameTeam = inTeam.teamId === teamId
    throw new RegistrationError(
      sameTeam
        ? `${member.fullName} is already a member of your team.`
        : `${member.fullName} is already part of another team for this event.`,
      "DUPLICATE_TEAM_MEMBER",
      409,
      {
        [`${errorKeyPrefix}.studentId`]: [
          sameTeam ? "Already in your team" : "This participant is already in a team",
        ],
      },
    )
  }

  // Member must not already have an active registration for this event
  const memberRegistration = await tx.eventRegistration.findUnique({
    where: { eventId_userId: { eventId, userId: memberUserId } },
    select: { id: true, status: true },
  })
  if (memberRegistration && memberRegistration.status !== "CANCELLED") {
    throw new RegistrationError(
      `${member.fullName} is already registered for this event.`,
      "DUPLICATE_REGISTRATION",
      409,
      {
        [`${errorKeyPrefix}.studentId`]: [
          "This participant is already registered",
        ],
      },
    )
  }

  const teamMemberRow = await tx.teamMember.create({
    data: { teamId, profileId: memberProfileId, isLeader: false },
    select: { id: true },
  })

  return {
    userId: memberUserId,
    teamMemberId: teamMemberRow.id,
    name: member.fullName,
    email: member.email,
    existingRegistrationId: memberRegistration?.id ?? null,
  }
}

/**
 * Create a StudentVerification row for a staged student ID upload.
 */
export async function createVerificationRow(
  tx: Prisma.TransactionClient,
  args: {
    userId: string
    teamMemberId: string | null
    upload: { key: string; sizeBytes: number }
    fileName: string
  },
): Promise<void> {
  await tx.studentVerification.create({
    data: {
      userId: args.userId,
      teamMemberId: args.teamMemberId,
      fileKey: args.upload.key,
      fileName: sanitizeFilename(args.fileName),
      fileMimeType: "image/webp",
      fileSizeBytes: args.upload.sizeBytes,
      status: "PENDING",
    },
  })
}

/**
 * Issue a fresh registration ID for a participant and create the row —
 * or revive a previously CANCELLED registration (re-registration).
 */
export async function createOrReviveRegistration(
  tx: Prisma.TransactionClient,
  args: {
    userId: string
    eventId: string
    eventType: EventType
    teamId: string | null
    existingRegistrationId: string | null
    registrationPhase?: RegistrationPhase
    domain?: string
    ideaSummary?: string
  },
): Promise<string> {
  const registrationId = await generateUniqueRegistrationId(
    tx,
    args.eventId,
    args.eventType,
  )

  if (args.existingRegistrationId) {
    await tx.eventRegistration.update({
      where: { id: args.existingRegistrationId },
      data: {
        status: "PENDING",
        registrationPhase: args.registrationPhase ?? "PRELIMINARY",
        domain: args.domain ?? null,
        ideaSummary: args.ideaSummary ?? null,
        registrationId,
        teamId: args.teamId,
      },
    })
  } else {
    await tx.eventRegistration.create({
      data: {
        registrationId,
        userId: args.userId,
        eventId: args.eventId,
        teamId: args.teamId,
        status: "PENDING",
        registrationPhase: args.registrationPhase ?? "PRELIMINARY",
        domain: args.domain ?? null,
        ideaSummary: args.ideaSummary ?? null,
      },
    })
  }

  return registrationId
}

// ─── Result types ─────────────────────────────────────────────────────────────

export type RegisteredParticipant = {
  userId: string
  registrationId: string
  participantName: string
  email: string
  isLeader: boolean
}

export type RegisterForEventResult = {
  eventId: string
  eventName: string
  eventType: EventType
  teamId: string | null
  teamName: string | null
  registrations: RegisteredParticipant[]
}

export type RegisterForWorkshopResult = {
  workshopId: string
  workshopTitle: string
  workshopDate: Date
  startTime: string
  endTime: string
  venue: string
  seatsRemaining: number
}

// ─── Event registration ───────────────────────────────────────────────────────

export type EventRegistrationInput = SubmitRegistrationInput | InnovationSymposiumRegistrationInput

export type RegisterForEventArgs = {
  userId: string
  input: EventRegistrationInput
}

/**
 * Register the authenticated user (the team leader for team events, or the
 * solo participant) plus their team members for an event.
 *
 * All validations run before the transaction; critical uniqueness checks run
 * again inside it so concurrent submissions cannot corrupt state.
 */
export async function registerForEvent(
  args: RegisterForEventArgs,
): Promise<RegisterForEventResult> {
  const { userId, input } = args
  const { participant, team } = input

  // ── 1. Load + validate event ────────────────────────────────────────────────
  const event = await prisma.event.findUnique({ where: { id: input.eventId } })
  if (!event) {
    throw new RegistrationError("Event not found.", "EVENT_NOT_FOUND", 404)
  }
  if (event.type === "HANDS_ON") {
    throw new RegistrationError(
      "Hands-on activities are registered from the workshops section.",
      "INVALID_EVENT",
      400,
    )
  }
  if (event.status !== "OPEN" || !event.registrationOpen) {
    throw new RegistrationError(
      "Registration for this event is currently closed.",
      "EVENT_CLOSED",
      409,
    )
  }
  if (event.registrationDeadline && isDeadlinePassed(event.registrationDeadline)) {
    throw new RegistrationError(
      "The registration deadline for this event has passed.",
      "EVENT_DEADLINE_PASSED",
      409,
    )
  }

  // ── 2. Capacity ─────────────────────────────────────────────────────────────
  if (event.participantLimit !== null) {
    const registered = await prisma.eventRegistration.count({
      where: {
        eventId: event.id,
        status: { in: ["PENDING", "PRELIM_APPROVED", "PAYMENT_PENDING", "PENDING_PAYMENT", "CONFIRMED", "WAITLISTED"] },
      },
    })
    if (registered >= event.participantLimit) {
      throw new RegistrationError(
        "This event has reached its participant limit.",
        "EVENT_FULL",
        409,
      )
    }
  }

  // ── 3. Team shape ───────────────────────────────────────────────────────────
  const members = event.isTeamEvent ? (team?.members ?? []) : []

  if (event.isTeamEvent) {
    if (!team?.name) {
      throw new RegistrationError(
        "Team details are required for this event.",
        "TEAM_REQUIRED",
        400,
      )
    }
    const limits = resolveTeamLimits(event)
    const totalSize = 1 + members.length // leader + members
    if (totalSize < limits.min) {
      throw new RegistrationError(
        `This team does not meet the minimum team size (${limits.min}).`,
        "TEAM_TOO_SMALL",
        400,
      )
    }
    if (totalSize > limits.max) {
      throw new RegistrationError(
        `Teams for this event can have at most ${limits.max} members.`,
        "TEAM_FULL",
        400,
      )
    }
  } else if (team) {
    throw new RegistrationError(
      "This event is for individual participation.",
      "INVALID_TEAM",
      400,
    )
  }

  // ── 4. Leader account ───────────────────────────────────────────────────────
  const leaderUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, isSuspended: true },
  })
  if (!leaderUser) {
    throw new RegistrationError("Account not found.", "UNAUTHORIZED", 401)
  }
  if (leaderUser.isSuspended) {
    throw new RegistrationError("Your account is suspended.", "ACCOUNT_SUSPENDED", 403)
  }

  // ── 5. In-payload uniqueness ────────────────────────────────────────────────
  const leaderEmail = leaderUser.email.toLowerCase()
  const seenStudentIds = new Set<string>([participant.studentId.toLowerCase()])
  const seenEmails = new Set<string>()

  for (const [index, member] of members.entries()) {
    const sid = member.studentId.toLowerCase()
    if (seenStudentIds.has(sid)) {
      throw new RegistrationError(
        `Duplicate student ID in team: ${member.studentId}`,
        "DUPLICATE_TEAM_MEMBER",
        409,
        { [`team.members.${index}.studentId`]: ["Duplicate student ID"] },
      )
    }
    seenStudentIds.add(sid)

    if (member.email === leaderEmail) {
      throw new RegistrationError(
        "You cannot add yourself as a team member.",
        "DUPLICATE_TEAM_MEMBER",
        400,
        { [`team.members.${index}.email`]: ["This is your own email"] },
      )
    }
    if (seenEmails.has(member.email)) {
      throw new RegistrationError(
        `Duplicate email in team: ${member.email}`,
        "DUPLICATE_TEAM_MEMBER",
        409,
        { [`team.members.${index}.email`]: ["Duplicate email"] },
      )
    }
    seenEmails.add(member.email)
  }

  // ── 6. Upload tokens (all staged by the leader) ─────────────────────────────
  const leaderUpload = await verifySignedUploadTokenWithFile(
    participant.verification.token,
    userId,
  )
  if (!leaderUpload) {
    throw new RegistrationError(
      "Your student ID upload has expired. Please re-upload it.",
      "UPLOAD_EXPIRED",
      400,
      { "participant.verification.token": ["Upload expired — please re-upload"] },
    )
  }

  const memberUploads: { key: string; sizeBytes: number }[] = []
  for (const [index, member] of members.entries()) {
    const upload = await verifySignedUploadTokenWithFile(
      member.verification.token,
      userId,
    )
    if (!upload) {
      throw new RegistrationError(
        `The student ID upload for ${member.fullName} has expired. Please re-upload it.`,
        "UPLOAD_EXPIRED",
        400,
        {
          [`team.members.${index}.verification.token`]: [
            "Upload expired — please re-upload",
          ],
        },
      )
    }
    memberUploads.push(upload)
  }

  // ── 7. Resolve universities (outside tx — race-safe create) ─────────────────
  const leaderUniversityId = await resolveUniversityId(prisma, participant)
  const memberUniversityIds: string[] = []
  for (const member of members) {
    memberUniversityIds.push(await resolveUniversityId(prisma, member))
  }

  // ── 8. Transaction ──────────────────────────────────────────────────────────
  const result = await prisma.$transaction(
    async (tx) => {
      // a. Leader profile (self — allowed to update own info)
      const leaderProfile = await upsertSelfProfile(tx, userId, {
        fullName: participant.fullName,
        studentId: participant.studentId,
        department: participant.department,
        phone: participant.phone,
        tshirtSize: participant.tshirtSize,
        universityId: leaderUniversityId,
      })

      // b. Existing registration for this event?
      const existingRegistration = await tx.eventRegistration.findUnique({
        where: { eventId_userId: { eventId: event.id, userId } },
        select: { id: true, status: true },
      })
      if (existingRegistration && existingRegistration.status !== "CANCELLED") {
        throw new RegistrationError(
          "You are already registered for this event.",
          "DUPLICATE_REGISTRATION",
          409,
        )
      }

      let teamId: string | null = null
      let leaderTeamMemberId: string | null = null

      type MemberRow = AttachedMember & {
        upload: { key: string; sizeBytes: number }
        fileName: string
      }
      const memberRows: MemberRow[] = []

      // c. Team event — create team + members
      if (event.isTeamEvent) {
        // Clear the leader's own previous team attachments for this event
        // (re-registration after a cancellation).
        const activeMemberships = await tx.teamMember.findMany({
          where: {
            profileId: leaderProfile.id,
            team: { eventId: event.id, deletedAt: null },
          },
          select: {
            id: true,
            teamId: true,
            team: { select: { leaderId: true } },
          },
        })
        for (const membership of activeMemberships) {
          if (membership.team.leaderId === userId) {
            await dissolveTeam(tx, membership.teamId)
          } else {
            await tx.teamMember.delete({ where: { id: membership.id } })
          }
        }

        // Team name must be unique per event (case-insensitive, active only)
        const dupTeam = await tx.team.findFirst({
          where: {
            eventId: event.id,
            deletedAt: null,
            name: { equals: team!.name, mode: "insensitive" },
          },
          select: { id: true },
        })
        if (dupTeam) {
          throw new RegistrationError(
            "A team with this name already exists for this event.",
            "DUPLICATE_TEAM_NAME",
            409,
            { "team.name": ["This team name is already taken"] },
          )
        }

        const createdTeam = await tx.team.create({
          data: { name: team!.name, eventId: event.id, leaderId: userId },
          select: { id: true },
        })
        teamId = createdTeam.id

        const leaderTeamMember = await tx.teamMember.create({
          data: { teamId: createdTeam.id, profileId: leaderProfile.id, isLeader: true },
          select: { id: true },
        })
        leaderTeamMemberId = leaderTeamMember.id

        for (const [index, member] of members.entries()) {
          const attached = await attachMemberToTeam(tx, {
            teamId: createdTeam.id,
            eventId: event.id,
            member,
            universityId: memberUniversityIds[index]!,
            errorKeyPrefix: `team.members.${index}`,
          })
          memberRows.push({
            ...attached,
            upload: memberUploads[index]!,
            fileName: sanitizeFilename(member.verification.fileName),
          })
        }
      }

      // d. Student ID verification rows (leader first)
      await createVerificationRow(tx, {
        userId,
        teamMemberId: leaderTeamMemberId,
        upload: leaderUpload,
        fileName: participant.verification.fileName,
      })

      for (const row of memberRows) {
        await createVerificationRow(tx, {
          userId: row.userId,
          teamMemberId: row.teamMemberId,
          upload: row.upload,
          fileName: row.fileName,
        })
      }

      // e. Event registrations — one row per participant
      const registrations: RegisteredParticipant[] = []

      const leaderRegistrationId = await createOrReviveRegistration(tx, {
        userId,
        eventId: event.id,
        eventType: event.type,
        teamId,
        existingRegistrationId: existingRegistration?.id ?? null,
        registrationPhase: "PRELIMINARY",
        domain: "domain" in input ? input.domain : undefined,
        ideaSummary: "ideaSummary" in input ? input.ideaSummary : undefined,
      })
      registrations.push({
        userId,
        registrationId: leaderRegistrationId,
        participantName: participant.fullName,
        email: leaderUser.email,
        isLeader: true,
      })

      for (const row of memberRows) {
        const memberRegistrationId = await createOrReviveRegistration(tx, {
          userId: row.userId,
          eventId: event.id,
          eventType: event.type,
          teamId,
          existingRegistrationId: row.existingRegistrationId,
          registrationPhase: "PRELIMINARY",
          domain: "domain" in input ? input.domain : undefined,
          ideaSummary: "ideaSummary" in input ? input.ideaSummary : undefined,
        })
        registrations.push({
          userId: row.userId,
          registrationId: memberRegistrationId,
          participantName: row.name,
          email: row.email,
          isLeader: false,
        })
      }

      return { teamId, registrations }
    },
    { timeout: 20000, maxWait: 10000 },
  )

  return {
    eventId: event.id,
    eventName: event.name,
    eventType: event.type,
    teamId: event.isTeamEvent ? result.teamId : null,
    teamName: event.isTeamEvent ? (team?.name ?? null) : null,
    registrations: result.registrations,
  }
}

// ─── Team management ──────────────────────────────────────────────────────────

export type AddTeamMemberArgs = {
  actorId: string
  teamId: string
  input: TeamMemberInput
}

export type AddTeamMemberResult = {
  teamId: string
  teamName: string
  eventId: string
  eventName: string
  registrationId: string
  participantName: string
  email: string
  teamSize: number
}

/**
 * Leader adds one more member to an existing team (dashboard flow).
 * Mirrors the wizard's member rules: upload token bound to the leader,
 * identity resolution, active-team / active-registration exclusivity,
 * team max size and event capacity.
 */
export async function addTeamMember(
  args: AddTeamMemberArgs,
): Promise<AddTeamMemberResult> {
  const { actorId, teamId, input: member } = args

  // ── 1. Load team + event ────────────────────────────────────────────────────
  const team = await prisma.team.findFirst({
    where: { id: teamId, deletedAt: null },
    select: {
      id: true,
      name: true,
      leaderId: true,
      eventId: true,
      event: true,
    },
  })
  if (!team) {
    throw new RegistrationError("Team not found.", "TEAM_NOT_FOUND", 404)
  }
  if (team.leaderId !== actorId) {
    throw new RegistrationError(
      "Only the team leader can add members.",
      "NOT_TEAM_LEADER",
      403,
    )
  }

  const event = team.event
  if (!event.isTeamEvent || event.type === "HANDS_ON") {
    throw new RegistrationError(
      "This event does not support team registration.",
      "INVALID_EVENT",
      400,
    )
  }
  if (event.status !== "OPEN" || !event.registrationOpen) {
    throw new RegistrationError(
      "Registration for this event is currently closed.",
      "EVENT_CLOSED",
      409,
    )
  }
  if (event.registrationDeadline && isDeadlinePassed(event.registrationDeadline)) {
    throw new RegistrationError(
      "The registration deadline for this event has passed.",
      "EVENT_DEADLINE_PASSED",
      409,
    )
  }

  // ── 2. Team size + event capacity ───────────────────────────────────────────
  const currentSize = await prisma.teamMember.count({ where: { teamId } })
  const limits = resolveTeamLimits(event)
  if (currentSize + 1 > limits.max) {
    throw new RegistrationError(
      `Teams for this event can have at most ${limits.max} members.`,
      "TEAM_FULL",
      409,
    )
  }

  if (event.participantLimit !== null) {
    const registered = await prisma.eventRegistration.count({
      where: {
        eventId: event.id,
        status: { in: ["PENDING", "PRELIM_APPROVED", "PAYMENT_PENDING", "PENDING_PAYMENT", "CONFIRMED", "WAITLISTED"] },
      },
    })
    if (registered >= event.participantLimit) {
      throw new RegistrationError(
        "This event has reached its participant limit.",
        "EVENT_FULL",
        409,
      )
    }
  }

  // ── 3. Upload token (staged by the leader) ──────────────────────────────────
  const upload = await verifySignedUploadTokenWithFile(
    member.verification.token,
    actorId,
  )
  if (!upload) {
    throw new RegistrationError(
      `The student ID upload for ${member.fullName} has expired. Please re-upload it.`,
      "UPLOAD_EXPIRED",
      400,
      { "member.verification.token": ["Upload expired — please re-upload"] },
    )
  }

  // ── 4. University (outside tx — race-safe create) ───────────────────────────
  const universityId = await resolveUniversityId(prisma, member)

  // ── 5. Transaction ──────────────────────────────────────────────────────────
  const result = await prisma.$transaction(
    async (tx) => {
      // Re-count under transaction in case of drift since the outer check
      const freshSize = await tx.teamMember.count({ where: { teamId } })
      if (freshSize + 1 > limits.max) {
        throw new RegistrationError(
          `Teams for this event can have at most ${limits.max} members.`,
          "TEAM_FULL",
          409,
        )
      }

      const attached = await attachMemberToTeam(tx, {
        teamId,
        eventId: event.id,
        member,
        universityId,
        errorKeyPrefix: "member",
      })

      await createVerificationRow(tx, {
        userId: attached.userId,
        teamMemberId: attached.teamMemberId,
        upload,
        fileName: member.verification.fileName,
      })

      const registrationId = await createOrReviveRegistration(tx, {
        userId: attached.userId,
        eventId: event.id,
        eventType: event.type,
        teamId,
        existingRegistrationId: attached.existingRegistrationId,
      })

      return { registrationId, teamSize: freshSize + 1 }
    },
    { timeout: 20000, maxWait: 10000 },
  )

  return {
    teamId,
    teamName: team.name,
    eventId: event.id,
    eventName: event.name,
    registrationId: result.registrationId,
    participantName: member.fullName,
    email: member.email,
    teamSize: result.teamSize,
  }
}

// ─── Workshop registration ────────────────────────────────────────────────────

export type RegisterForWorkshopArgs = {
  userId: string
  input: WorkshopRegistrationInput
}

/**
 * Register the authenticated user for a workshop (Hands-on Activity).
 * Seat claim is atomic — concurrent submissions cannot oversell capacity.
 */
export async function registerForWorkshop(
  args: RegisterForWorkshopArgs,
): Promise<RegisterForWorkshopResult> {
  const { userId, input } = args
  const { participant } = input

  const workshop = await prisma.workshop.findUnique({
    where: { id: input.workshopId },
  })
  if (!workshop) {
    throw new RegistrationError("Workshop not found.", "WORKSHOP_NOT_FOUND", 404)
  }
  if (workshop.status !== "OPEN") {
    throw new RegistrationError(
      "Registration for this workshop is currently closed.",
      "WORKSHOP_CLOSED",
      409,
    )
  }
  if (isDeadlinePassed(workshop.registrationDeadline)) {
    throw new RegistrationError(
      "The registration deadline for this workshop has passed.",
      "WORKSHOP_DEADLINE_PASSED",
      409,
    )
  }

  const existing = await prisma.workshopRegistration.findUnique({
    where: { workshopId_userId: { workshopId: workshop.id, userId } },
    select: { id: true },
  })
  if (existing) {
    throw new RegistrationError(
      "You are already registered for this workshop.",
      "DUPLICATE_WORKSHOP_REGISTRATION",
      409,
    )
  }

  const upload = await verifySignedUploadTokenWithFile(
    participant.verification.token,
    userId,
  )
  if (!upload) {
    throw new RegistrationError(
      "Your student ID upload has expired. Please re-upload it.",
      "UPLOAD_EXPIRED",
      400,
      { "participant.verification.token": ["Upload expired — please re-upload"] },
    )
  }

  const universityId = await resolveUniversityId(prisma, participant)

  const { seatsRemaining } = await prisma.$transaction(
    async (tx) => {
      // a. Profile
      await upsertSelfProfile(tx, userId, {
        fullName: participant.fullName,
        studentId: participant.studentId,
        department: participant.department,
        phone: participant.phone,
        tshirtSize: participant.tshirtSize,
        universityId,
      })

      // b. Atomic seat claim — the WHERE clause re-evaluates under row lock,
      // so two concurrent claims can never push registeredCount past capacity.
      const current = await tx.workshop.findUnique({
        where: { id: workshop.id },
        select: { totalSeats: true, registeredCount: true },
      })
      if (!current) {
        throw new RegistrationError("Workshop not found.", "WORKSHOP_NOT_FOUND", 404)
      }
      if (current.registeredCount >= current.totalSeats) {
        throw new RegistrationError(
          "This workshop is fully booked.",
          "WORKSHOP_FULL",
          409,
        )
      }

      const claim = await tx.workshop.updateMany({
        where: {
          id: workshop.id,
          registeredCount: { lt: current.totalSeats },
        },
        data: { registeredCount: { increment: 1 } },
      })
      if (claim.count === 0) {
        throw new RegistrationError(
          "This workshop is fully booked.",
          "WORKSHOP_FULL",
          409,
        )
      }

      // c. Workshop registration row
      await tx.workshopRegistration.create({
        data: { userId, workshopId: workshop.id },
      })

      // d. Student ID verification row
      await tx.studentVerification.create({
        data: {
          userId,
          teamMemberId: null,
          fileKey: upload.key,
          fileName: sanitizeFilename(participant.verification.fileName),
          fileMimeType: "image/webp",
          fileSizeBytes: upload.sizeBytes,
          status: "PENDING",
        },
      })

      return {
        seatsRemaining: Math.max(
          0,
          current.totalSeats - (current.registeredCount + 1),
        ),
      }
    },
    { timeout: 20000, maxWait: 10000 },
  )

  return {
    workshopId: workshop.id,
    workshopTitle: workshop.title,
    workshopDate: workshop.date,
    startTime: workshop.startTime,
    endTime: workshop.endTime,
    venue: workshop.venue,
    seatsRemaining,
  }
}
