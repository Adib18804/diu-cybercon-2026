// =============================================================================
// Participant Dashboard — shared server-side data layer.
//
// All functions are:
// - scoped to a userId (caller must pass the session user's id)
// - defensive: failures log server-side and degrade to a safe fallback
// - serializable: dates leave as ISO strings so client components can consume
//   the results without hydration surprises.
// =============================================================================

import { prisma } from "@/lib/db"

// ─── Safe query wrapper ───────────────────────────────────────────────────────

async function safe<T>(
  query: () => Promise<T>,
  fallback: T,
  label: string,
): Promise<T> {
  try {
    return await query()
  } catch (err) {
    console.error(`[dashboard/queries] ${label} failed:`, err)
    return fallback
  }
}

// ─── Serialized types ─────────────────────────────────────────────────────────

export interface DashboardProfile {
  fullName: string
  studentId: string
  department: string
  phone: string
  tshirtSize: string
  universityId: string
  universityName: string
  email: string
  memberSince: string
}

export interface MyRegistration {
  id: string
  registrationId: string
  eventId: string
  eventName: string
  eventSlug: string
  eventType: string
  isTeamEvent: boolean
  registrationFee: string
  latestPaymentStatus: string | null
  status: string
  registrationPhase: string
  domain: string | null
  ideaSummary: string | null
  checkInStatus: string
  createdAt: string
  teamId: string | null
  teamName: string | null
  isLeader: boolean
  teamMinSize: number | null
  teamMaxSize: number | null
}

export interface MyTeamMember {
  id: string
  userId: string
  fullName: string
  email: string
  phone: string
  department: string
  tshirtSize: string
  universityId: string
  universityName: string
  isLeader: boolean
  isSelf: boolean
  joinedAt: string
  verificationStatus: string | null
  verificationNote: string | null
}

export interface MyTeam {
  id: string
  name: string
  eventId: string
  eventName: string
  eventSlug: string
  eventType: string
  isLeader: boolean
  minTeamSize: number | null
  maxTeamSize: number | null
  memberCount: number
  members: MyTeamMember[]
}

export interface MyProjectSubmission {
  id: string
  projectName: string
  teamName: string
  university: string
  department: string
  category: string
  description: string
  problemStatement: string
  proposedSolution: string
  technologies: string[]
  githubUrl: string | null
  demoUrl: string | null
  imageUrl: string | null
  presentationUrl: string | null
  status: string
  reviewNote: string | null
  createdAt: string
  updatedAt: string
}

export interface MyPosterSubmission {
  id: string
  title: string
  teamName: string
  authors: string[]
  university: string
  department: string
  abstract: string
  keywords: string[]
  category: string
  contactInfo: string
  fileUrl: string
  status: string
  reviewNote: string | null
  createdAt: string
  updatedAt: string
}

export interface MyWorkshopRegistration {
  id: string
  workshopId: string
  title: string
  instructorName: string
  instructorOrg: string
  skillLevel: string
  date: string
  startTime: string
  endTime: string
  venue: string
  requiredEquipment: string | null
  prerequisites: string | null
  workshopStatus: string
  registeredAt: string
}

export interface MyVerification {
  id: string
  fileName: string
  status: string
  reviewNote: string | null
  uploadedAt: string
  eventName: string | null
  teamName: string | null
  contextLabel: string
}

export interface UniversityOption {
  id: string
  name: string
  shortName: string | null
}

export interface SponsorApplicationView {
  id: string
  orgName: string
  contactPerson: string
  email: string
  phone: string
  website: string | null
  tier: string
  message: string | null
  status: string
  createdAt: string
  updatedAt: string
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getDashboardProfile(
  userId: string,
): Promise<DashboardProfile | null> {
  return safe(
    async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          createdAt: true,
          profile: {
            select: {
              fullName: true,
              studentId: true,
              department: true,
              phone: true,
              tshirtSize: true,
              universityId: true,
              university: { select: { name: true } },
            },
          },
        },
      })
      if (!user?.profile) {return null}

      return {
        fullName: user.profile.fullName,
        studentId: user.profile.studentId,
        department: user.profile.department,
        phone: user.profile.phone,
        tshirtSize: user.profile.tshirtSize,
        universityId: user.profile.universityId,
        universityName: user.profile.university.name,
        email: user.email,
        memberSince: user.createdAt.toISOString(),
      }
    },
    null,
    "getDashboardProfile",
  )
}

// ─── Registrations ────────────────────────────────────────────────────────────

export async function getMyRegistrations(
  userId: string,
): Promise<MyRegistration[]> {
  return safe(
    async () => {
      const rows = await prisma.eventRegistration.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          registrationId: true,
          eventId: true,
          status: true,
            registrationPhase: true,
            domain: true,
            ideaSummary: true,
          checkInStatus: true,
          createdAt: true,
          teamId: true,
          event: {
            select: {
              name: true,
              slug: true,
              type: true,
              isTeamEvent: true,
              minTeamSize: true,
              maxTeamSize: true,
              registrationFee: true,
            },
          },
          payments: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true },
          },
          team: { select: { id: true, name: true, leaderId: true } },
        },
      })

      return rows.map((row) => ({
        id: row.id,
        registrationId: row.registrationId,
        eventId: row.eventId,
        eventName: row.event.name,
        eventSlug: row.event.slug,
        eventType: row.event.type,
        isTeamEvent: row.event.isTeamEvent,
        registrationFee: row.event.registrationFee.toString(),
        latestPaymentStatus: row.payments[0]?.status ?? null,
        status: row.status,
          registrationPhase: row.registrationPhase,
          domain: row.domain,
          ideaSummary: row.ideaSummary,
        checkInStatus: row.checkInStatus,
        createdAt: row.createdAt.toISOString(),
        teamId: row.teamId,
        teamName: row.team?.name ?? null,
        isLeader: row.team ? row.team.leaderId === userId : false,
        teamMinSize: row.event.minTeamSize,
        teamMaxSize: row.event.maxTeamSize,
      }))
    },
    [],
    "getMyRegistrations",
  )
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export async function getMyTeams(userId: string): Promise<MyTeam[]> {
  return safe(
    async () => {
      const teams = await prisma.team.findMany({
        where: {
          deletedAt: null,
          OR: [
            { leaderId: userId },
            { members: { some: { profile: { userId } } } },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          leaderId: true,
          eventId: true,
          event: {
            select: {
              name: true,
              slug: true,
              type: true,
              isTeamEvent: true,
              minTeamSize: true,
              maxTeamSize: true,
            },
          },
          members: {
            orderBy: { joinedAt: "asc" },
            select: {
              id: true,
              profileId: true,
              isLeader: true,
              joinedAt: true,
              profile: {
                select: {
                  userId: true,
                  fullName: true,
                  department: true,
                  phone: true,
                  tshirtSize: true,
                  universityId: true,
                  university: { select: { name: true } },
                  user: { select: { email: true } },
                },
              },
              verification: { select: { status: true, reviewNote: true } },
            },
          },
        },
      })

      return teams.map((team) => ({
        id: team.id,
        name: team.name,
        eventId: team.eventId,
        eventName: team.event.name,
        eventSlug: team.event.slug,
        eventType: team.event.type,
        isLeader: team.leaderId === userId,
        minTeamSize: team.event.minTeamSize,
        maxTeamSize: team.event.maxTeamSize,
        memberCount: team.members.length,
        members: team.members.map((m) => ({
          id: m.id,
          userId: m.profile.userId,
          fullName: m.profile.fullName,
          email: m.profile.user.email,
          phone: m.profile.phone,
          department: m.profile.department,
          tshirtSize: m.profile.tshirtSize,
          universityId: m.profile.universityId,
          universityName: m.profile.university.name,
          isLeader: m.isLeader,
          isSelf: m.profile.userId === userId,
          joinedAt: m.joinedAt.toISOString(),
          verificationStatus: m.verification?.status ?? null,
          verificationNote: m.verification?.reviewNote ?? null,
        })),
      }))
    },
    [],
    "getMyTeams",
  )
}

// ─── Submissions ──────────────────────────────────────────────────────────────

export async function getMyProjects(
  userId: string,
): Promise<MyProjectSubmission[]> {
  return safe(
    async () => {
      const rows = await prisma.project.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      })

      return rows.map((row) => ({
        id: row.id,
        projectName: row.projectName,
        teamName: row.teamName,
        university: row.university,
        department: row.department,
        category: row.category,
        description: row.description,
        problemStatement: row.problemStatement,
        proposedSolution: row.proposedSolution,
        technologies: row.technologies,
        githubUrl: row.githubUrl,
        demoUrl: row.demoUrl,
        imageUrl: row.imageKey ? `/uploads/${row.imageKey}` : null,
        presentationUrl: row.presentationKey
          ? `/uploads/${row.presentationKey}`
          : null,
        status: row.status,
        reviewNote: row.reviewNote,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }))
    },
    [],
    "getMyProjects",
  )
}

export async function getMyPosters(
  userId: string,
): Promise<MyPosterSubmission[]> {
  return safe(
    async () => {
      const rows = await prisma.poster.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      })

      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        teamName: row.teamName,
        authors: row.authors,
        university: row.university,
        department: row.department,
        abstract: row.abstract,
        keywords: row.keywords,
        category: row.category,
        contactInfo: row.contactInfo,
        fileUrl: `/uploads/${row.fileKey}`,
        status: row.status,
        reviewNote: row.reviewNote,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }))
    },
    [],
    "getMyPosters",
  )
}

// ─── Workshops ────────────────────────────────────────────────────────────────

export async function getMyWorkshopRegistrations(
  userId: string,
): Promise<MyWorkshopRegistration[]> {
  return safe(
    async () => {
      const rows = await prisma.workshopRegistration.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          workshopId: true,
          createdAt: true,
          workshop: {
            select: {
              title: true,
              instructorName: true,
              instructorOrg: true,
              skillLevel: true,
              date: true,
              startTime: true,
              endTime: true,
              venue: true,
              requiredEquipment: true,
              prerequisites: true,
              status: true,
            },
          },
        },
      })

      return rows.map((row) => ({
        id: row.id,
        workshopId: row.workshopId,
        title: row.workshop.title,
        instructorName: row.workshop.instructorName,
        instructorOrg: row.workshop.instructorOrg,
        skillLevel: row.workshop.skillLevel,
        date: row.workshop.date.toISOString(),
        startTime: row.workshop.startTime,
        endTime: row.workshop.endTime,
        venue: row.workshop.venue,
        requiredEquipment: row.workshop.requiredEquipment,
        prerequisites: row.workshop.prerequisites,
        workshopStatus: row.workshop.status,
        registeredAt: row.createdAt.toISOString(),
      }))
    },
    [],
    "getMyWorkshopRegistrations",
  )
}

// ─── Verification documents ───────────────────────────────────────────────────

export async function getMyVerifications(
  userId: string,
): Promise<MyVerification[]> {
  return safe(
    async () => {
      const rows = await prisma.studentVerification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          status: true,
          reviewNote: true,
          createdAt: true,
          teamMember: {
            select: {
              profile: { select: { fullName: true } },
              team: {
                select: {
                  name: true,
                  event: { select: { name: true } },
                },
              },
            },
          },
        },
      })

      return rows.map((row) => ({
        id: row.id,
        fileName: row.fileName,
        status: row.status,
        reviewNote: row.reviewNote,
        uploadedAt: row.createdAt.toISOString(),
        eventName: row.teamMember?.team.event.name ?? null,
        teamName: row.teamMember?.team.name ?? null,
        contextLabel: row.teamMember
          ? `${row.teamMember.team.event.name} · Team "${row.teamMember.team.name}"`
          : "Individual registration",
      }))
    },
    [],
    "getMyVerifications",
  )
}

// ─── Universities (for profile + add-member forms) ────────────────────────────

export async function getActiveUniversities(): Promise<UniversityOption[]> {
  return safe(
    async () => {
      const rows = await prisma.university.findMany({
        where: { isActive: true },
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true, shortName: true },
      })
      return rows
    },
    [],
    "getActiveUniversities",
  )
}

// ─── Sponsor portal (applications are matched by contact email) ──────────────

export async function getSponsorApplicationsByEmail(
  email: string,
): Promise<SponsorApplicationView[]> {
  return safe(
    async () => {
      const rows = await prisma.sponsorApplication.findMany({
        where: { email: { equals: email.trim(), mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orgName: true,
          contactPerson: true,
          email: true,
          phone: true,
          website: true,
          tier: true,
          message: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return rows.map((row) => ({
        id: row.id,
        orgName: row.orgName,
        contactPerson: row.contactPerson,
        email: row.email,
        phone: row.phone,
        website: row.website,
        tier: row.tier,
        message: row.message,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }))
    },
    [],
    "getSponsorApplicationsByEmail",
  )
}
