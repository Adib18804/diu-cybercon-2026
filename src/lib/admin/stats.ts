// =============================================================================
// Admin dashboard stats — server-side aggregation with per-stat permission
// gating. A stat is only computed and returned when the requesting admin's
// role actually grants the underlying permission; otherwise the key is absent.
// =============================================================================

import type { AdminRole } from "@prisma/client"

import { prisma } from "@/lib/db"
import { hasPermission } from "@/lib/rbac"

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminStatKey =
  | "totalParticipants"
  | "verified"
  | "pendingVerification"
  | "totalTeams"
  | "ctfTeams"
  | "traceRouteParticipants"
  | "projectTeams"
  | "posterTeams"
  | "workshopRegistrations"
  | "sponsorApplications"
  | "totalAdmins"

export interface AdminActivityItem {
  id: string
  action: string
  targetType: string
  targetId: string | null
  actorName: string
  createdAt: string
}

export interface ChartPoint {
  label: string
  value: number
}

export interface AdminStatsPayload {
  generatedAt: string
  /** Only the keys this admin may see are present. */
  cards: Partial<Record<AdminStatKey, number>>
  recentActivity: AdminActivityItem[]
  /** Last 30 days of registrations, oldest → newest. */
  registrationsByDay: ChartPoint[]
  /** Top 10 universities by participant count. */
  universityDistribution: ChartPoint[]
  /** Authority-only aggregates; omitted for all non-Super Admin roles. */
  superAdminAnalytics?: SuperAdminAnalytics
}

export interface SuperAdminAnalytics {
  registrationsByEvent: ChartPoint[]
  verifiedRevenue: string
  pendingRevenue: string
  totalTeams: number
  totalMembers: number
  teamSizeBreakdown: ChartPoint[]
  pendingRegistrationCount: number
  pendingPaymentCount: number
  pendingRegistrations: Array<{
    registrationId: string
    eventName: string
    createdAt: string
  }>
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

const DAYS_OF_HISTORY = 30
const TOP_UNIVERSITIES = 10
const RECENT_ACTIVITY_LIMIT = 12

async function getSuperAdminAnalytics(): Promise<SuperAdminAnalytics> {
  const [events, registrationGroups, paymentGroups, teams, pendingRegistrations] =
    await Promise.all([
      prisma.event.findMany({
        orderBy: { displayOrder: "asc" },
        select: { id: true, name: true },
      }),
      prisma.eventRegistration.groupBy({
        by: ["eventId"],
        where: { status: { not: "CANCELLED" } },
        _count: { _all: true },
      }),
      prisma.payment.groupBy({
        by: ["status"],
        where: { method: "BKASH", status: { in: ["PENDING", "VERIFIED"] } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.team.findMany({
        where: { deletedAt: null },
        select: { _count: { select: { members: true } } },
      }),
      prisma.eventRegistration.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 8,
        select: {
          registrationId: true,
          createdAt: true,
          event: { select: { name: true } },
        },
      }),
    ])

  const registrationsById = new Map(
    registrationGroups.map((group) => [group.eventId, group._count._all]),
  )
  const revenueByStatus = new Map(
    paymentGroups.map((group) => [group.status, group._sum.amount?.toString() ?? "0"]),
  )
  const paymentCountByStatus = new Map(
    paymentGroups.map((group) => [group.status, group._count._all]),
  )
  const sizeBuckets = new Map<string, number>([
    ["1 member", 0],
    ["2 members", 0],
    ["3 members", 0],
    ["4 members", 0],
    ["5+ members", 0],
  ])
  let totalMembers = 0
  for (const team of teams) {
    const size = team._count.members
    totalMembers += size
    if (size > 0) {
      const label = size >= 5 ? "5+ members" : `${size} ${size === 1 ? "member" : "members"}`
      sizeBuckets.set(label, (sizeBuckets.get(label) ?? 0) + 1)
    }
  }

  return {
    registrationsByEvent: events.map((event) => ({
      label: event.name,
      value: registrationsById.get(event.id) ?? 0,
    })),
    verifiedRevenue: revenueByStatus.get("VERIFIED") ?? "0",
    pendingRevenue: revenueByStatus.get("PENDING") ?? "0",
    totalTeams: teams.length,
    totalMembers,
    teamSizeBreakdown: Array.from(sizeBuckets, ([label, value]) => ({ label, value })),
    pendingRegistrationCount: await prisma.eventRegistration.count({ where: { status: "PENDING" } }),
    pendingPaymentCount: paymentCountByStatus.get("PENDING") ?? 0,
    pendingRegistrations: pendingRegistrations.map((registration) => ({
      registrationId: registration.registrationId,
      eventName: registration.event.name,
      createdAt: registration.createdAt.toISOString(),
    })),
  }
}

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function buildRegistrationSeries(
  now: Date,
  rows: { createdAt: Date }[],
): ChartPoint[] {
  // Seed the last 30 days with zeroes so gaps render as flat lines.
  const buckets = new Map<string, number>()
  const labels = new Map<string, string>()
  for (let i = DAYS_OF_HISTORY - 1; i >= 0; i--) {
    const day = new Date(now)
    day.setUTCDate(day.getUTCDate() - i)
    const key = toDayKey(day)
    buckets.set(key, 0)
    labels.set(
      key,
      day.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
    )
  }

  for (const row of rows) {
    const key = toDayKey(row.createdAt)
    const current = buckets.get(key)
    if (current !== undefined) {buckets.set(key, current + 1)}
  }

  return Array.from(buckets.entries()).map(([key, value]) => ({
    label: labels.get(key) ?? key,
    value,
  }))
}

/**
 * Compute the admin dashboard payload for the given admin role.
 * Every query is skipped when the role lacks the related permission.
 */
export async function getAdminDashboardStats(
  adminRole: AdminRole | null | undefined,
): Promise<AdminStatsPayload> {
  const can = (permission: Parameters<typeof hasPermission>[1]) =>
    hasPermission(adminRole, permission)

  const canSeeParticipants = can("participants:view")
  const canSeeVerification = can("verification:view")
  const canSeeTeams = can("teams:view")
  const canSeeRegistrations = can("registrations:view")
  const canSeeWorkshops = can("workshops:view")
  const canSeeSponsorApps = can("sponsor_apps:view")
  const canSeeRoles = can("admin_roles:view")
  const canSeeAudit = can("audit_logs:view")
  const canSeeCharts = can("analytics:view") || canSeeRegistrations

  const now = new Date()
  const historyStart = new Date(now)
  historyStart.setUTCDate(historyStart.getUTCDate() - (DAYS_OF_HISTORY - 1))
  historyStart.setUTCHours(0, 0, 0, 0)

  const [
    totalParticipants,
    verified,
    pendingVerification,
    totalTeams,
    ctfTeams,
    traceRouteParticipants,
    projectTeams,
    posterTeams,
    workshopRegistrations,
    sponsorApplications,
    totalAdmins,
    activityRows,
    registrationRows,
    universityGroups,
  ] = await Promise.all([
    canSeeParticipants ? prisma.participantProfile.count() : null,
    canSeeVerification
      ? prisma.studentVerification.count({ where: { status: "VERIFIED" } })
      : null,
    canSeeVerification
      ? prisma.studentVerification.count({ where: { status: "PENDING" } })
      : null,
    canSeeTeams
      ? prisma.team.count({ where: { deletedAt: null } })
      : null,
    canSeeTeams
      ? prisma.team.count({
          where: { deletedAt: null, event: { type: "CTF" } },
        })
      : null,
    canSeeRegistrations
      ? prisma.eventRegistration.count({
          where: {
            event: { type: "TRACE_ROUTE" },
            status: { not: "CANCELLED" },
          },
        })
      : null,
    canSeeRegistrations
      ? prisma.eventRegistration.count({
          where: {
            event: { type: "PROJECT_SHOWCASE" },
            status: { not: "CANCELLED" },
          },
        })
      : null,
    canSeeRegistrations
      ? prisma.eventRegistration.count({
          where: {
            event: { type: "POSTER_PRESENTATION" },
            status: { not: "CANCELLED" },
          },
        })
      : null,
    canSeeWorkshops ? prisma.workshopRegistration.count() : null,
    canSeeSponsorApps ? prisma.sponsorApplication.count() : null,
    canSeeRoles
      ? prisma.user.count({ where: { role: { in: ["ADMIN", "STAFF"] } } })
      : null,
    canSeeAudit
      ? prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: RECENT_ACTIVITY_LIMIT,
          select: {
            id: true,
            action: true,
            targetType: true,
            targetId: true,
            createdAt: true,
            actor: { select: { name: true, email: true } },
          },
        })
      : null,
    canSeeCharts
      ? prisma.eventRegistration.findMany({
          where: { createdAt: { gte: historyStart } },
          select: { createdAt: true },
        })
      : null,
    canSeeCharts
      ? prisma.participantProfile.groupBy({
          by: ["universityId"],
          _count: { universityId: true },
          orderBy: { _count: { universityId: "desc" } },
          take: TOP_UNIVERSITIES,
        })
      : null,
  ])

  // ── Cards (only permitted keys) ──────────────────────────────────────────
  const cards: Partial<Record<AdminStatKey, number>> = {}
  if (totalParticipants !== null) {cards.totalParticipants = totalParticipants}
  if (verified !== null) {cards.verified = verified}
  if (pendingVerification !== null) {cards.pendingVerification = pendingVerification}
  if (totalTeams !== null) {cards.totalTeams = totalTeams}
  if (ctfTeams !== null) {cards.ctfTeams = ctfTeams}
  if (traceRouteParticipants !== null) {cards.traceRouteParticipants = traceRouteParticipants}
  if (projectTeams !== null) {cards.projectTeams = projectTeams}
  if (posterTeams !== null) {cards.posterTeams = posterTeams}
  if (workshopRegistrations !== null) {cards.workshopRegistrations = workshopRegistrations}
  if (sponsorApplications !== null) {cards.sponsorApplications = sponsorApplications}
  if (totalAdmins !== null) {cards.totalAdmins = totalAdmins}

  // ── Recent activity ──────────────────────────────────────────────────────
  const recentActivity: AdminActivityItem[] = (activityRows ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    actorName: row.actor.name?.trim() || row.actor.email,
    createdAt: row.createdAt.toISOString(),
  }))

  // ── Charts ───────────────────────────────────────────────────────────────
  const registrationsByDay = registrationRows
    ? buildRegistrationSeries(now, registrationRows)
    : []

  let universityDistribution: ChartPoint[] = []
  if (universityGroups && universityGroups.length > 0) {
    const universities = await prisma.university.findMany({
      where: { id: { in: universityGroups.map((g) => g.universityId) } },
      select: { id: true, name: true, shortName: true },
    })
    const nameById = new Map(
      universities.map((u) => [u.id, u.shortName?.trim() || u.name]),
    )
    universityDistribution = universityGroups.map((group) => ({
      label: nameById.get(group.universityId) ?? "Unknown",
      value: group._count.universityId,
    }))
  }

  const superAdminAnalytics =
    adminRole === "SUPER_ADMIN" ? await getSuperAdminAnalytics() : undefined

  return {
    generatedAt: now.toISOString(),
    cards,
    recentActivity,
    registrationsByDay,
    universityDistribution,
    ...(superAdminAnalytics ? { superAdminAnalytics } : {}),
  }
}
