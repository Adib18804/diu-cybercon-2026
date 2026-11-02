// =============================================================================
// DIU_CYBERCON 2026 — Audit Log Helper
// Every sensitive action writes an immutable audit record.
// Never update or delete audit logs — append only.
// =============================================================================

import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"

export type AuditAction =
  // Auth
  | "USER_LOGIN"
  | "USER_LOGOUT"
  | "USER_REGISTER"
  | "USER_SUSPENDED"
  | "USER_UNSUSPENDED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "EMAIL_VERIFIED"
  // Verification
  | "STUDENT_ID_UPLOADED"
  | "STUDENT_ID_VIEWED"
  | "STUDENT_ID_VERIFIED"
  | "STUDENT_ID_REJECTED"
  | "STUDENT_ID_REVISION_REQUESTED"
  // Registration
  | "REGISTRATION_CREATED"
  | "REGISTRATION_CANCELLED"
  | "REGISTRATION_STATUS_CHANGED"
  | "PAYMENT_SUBMITTED"
  | "PAYMENT_VERIFIED"
  | "PAYMENT_REJECTED"
  // Team
  | "TEAM_CREATED"
  | "TEAM_RENAMED"
  | "TEAM_UPDATED"
  | "TEAM_DELETED"
  | "TEAM_MEMBER_ADDED"
  | "TEAM_MEMBER_UPDATED"
  | "TEAM_MEMBER_REMOVED"
  // Profile
  | "PROFILE_UPDATED"
  // Submissions
  | "PROJECT_SUBMITTED"
  | "PROJECT_UPDATED"
  | "PROJECT_DELETED"
  | "PROJECT_STATUS_CHANGED"
  | "POSTER_SUBMITTED"
  | "POSTER_UPDATED"
  | "POSTER_DELETED"
  | "POSTER_STATUS_CHANGED"
  | "SUBMISSION_FILE_UPLOADED"
  // Documents
  | "REGISTRATION_CONFIRMATION_DOWNLOADED"
  // Workshop
  | "WORKSHOP_REGISTERED"
  | "WORKSHOP_UNREGISTERED"
  | "WORKSHOP_CREATED"
  | "WORKSHOP_UPDATED"
  | "WORKSHOP_DELETED"
  // Check-in
  | "PARTICIPANT_CHECKED_IN"
  | "PARTICIPANT_CHECKED_OUT"
  // Sponsor
  | "SPONSOR_APPLICATION_SUBMITTED"
  | "SPONSOR_APPLICATION_STATUS_CHANGED"
  | "SPONSOR_CREATED"
  | "SPONSOR_UPDATED"
  | "SPONSOR_DELETED"
  // Admin
  | "ADMIN_ROLE_ASSIGNED"
  | "ADMIN_ROLE_REMOVED"
  | "SETTINGS_UPDATED"
  | "EVENT_UPDATED"
  | "ADMIN_FILE_UPLOADED"
  // Content
  | "ANNOUNCEMENT_CREATED"
  | "ANNOUNCEMENT_PUBLISHED"
  | "ANNOUNCEMENT_UPDATED"
  | "ANNOUNCEMENT_DELETED"
  | "ANNOUNCEMENT_BROADCASTED"
  // Email
  | "EMAIL_UNSUBSCRIBED"
  | "GALLERY_IMAGE_ADDED"
  | "GALLERY_IMAGE_UPDATED"
  | "GALLERY_IMAGE_DELETED"
  | "FAQ_CREATED"
  | "FAQ_UPDATED"
  | "FAQ_DELETED"
  | "CONTACT_MESSAGE_READ"
  // Program
  | "SPEAKER_CREATED"
  | "SPEAKER_UPDATED"
  | "SPEAKER_DELETED"
  | "PANEL_CREATED"
  | "PANEL_UPDATED"
  | "PANEL_DELETED"
  | "SCHEDULE_ITEM_CREATED"
  | "SCHEDULE_ITEM_UPDATED"
  | "SCHEDULE_ITEM_DELETED"
  // Partners
  | "PARTNER_CREATED"
  | "PARTNER_UPDATED"
  | "PARTNER_DELETED"

export type AuditContext = {
  actorId: string
  action: AuditAction
  targetType: string
  targetId?: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

/**
 * Write an audit log entry.
 * Fire-and-forget safe — errors are swallowed so they never break the
 * primary operation, but they are logged server-side.
 */
export async function auditLog(ctx: AuditContext): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: ctx.actorId,
        action: ctx.action,
        targetType: ctx.targetType,
        targetId: ctx.targetId ?? null,
        before:
          ctx.before === undefined
            ? Prisma.DbNull
            : (ctx.before as Prisma.InputJsonValue),
        after:
          ctx.after === undefined
            ? Prisma.DbNull
            : (ctx.after as Prisma.InputJsonValue),
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
        metadata:
          ctx.metadata === undefined
            ? Prisma.DbNull
            : (ctx.metadata as Prisma.InputJsonValue),
      },
    })
  } catch (error) {
    // Log to server but never propagate — audit failures must not block ops
    console.error("[AuditLog] Failed to write audit entry:", {
      action: ctx.action,
      actorId: ctx.actorId,
      error,
    })
  }
}

/**
 * Extract IP address from a Next.js request.
 * Handles Vercel / Cloudflare / standard forwarding headers.
 */
export function extractIpAddress(request: Request): string {
  const headers = new Headers(request.headers)

  // Vercel
  const vercelForwardedFor = headers.get("x-vercel-forwarded-for")
  if (vercelForwardedFor) {return vercelForwardedFor.split(",")[0]?.trim() ?? "unknown"}

  // Cloudflare
  const cfConnectingIp = headers.get("cf-connecting-ip")
  if (cfConnectingIp) {return cfConnectingIp.trim()}

  // Standard forwarding
  const forwardedFor = headers.get("x-forwarded-for")
  if (forwardedFor) {return forwardedFor.split(",")[0]?.trim() ?? "unknown"}

  // Real IP header (nginx)
  const realIp = headers.get("x-real-ip")
  if (realIp) {return realIp.trim()}

  return "unknown"
}

/**
 * Extract User-Agent from a request.
 */
export function extractUserAgent(request: Request): string {
  return new Headers(request.headers).get("user-agent") ?? "unknown"
}
