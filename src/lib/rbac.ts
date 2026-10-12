// =============================================================================
// DIU CyberCon 2026 — RBAC (Role-Based Access Control)
// Server-side permission guards for API routes and Server Components.
// NEVER rely on frontend-only authorization.
// Every permission is checked server-side. Deny by default.
// =============================================================================

import type { AdminRole, UserRole } from "@prisma/client"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { errorResponse } from "@/lib/utils"

// =============================================================================
// Permission definitions
// =============================================================================

export type Permission =
  // ── Verification ──────────────────────────────────────────────────────────
  | "verification:view"
  | "verification:decide"
  // ── Participants ──────────────────────────────────────────────────────────
  | "participants:view"
  | "participants:edit"
  | "participants:delete"
  // ── Registrations ─────────────────────────────────────────────────────────
  | "registrations:view"
  | "registrations:edit"
  | "registrations:checkin"
  // ── Teams ─────────────────────────────────────────────────────────────────
  | "teams:view"
  | "teams:edit"
  // ── Events ────────────────────────────────────────────────────────────────
  | "events:view"
  | "events:edit"
  | "events:publish"
  // ── Workshops ─────────────────────────────────────────────────────────────
  | "workshops:view"
  | "workshops:edit"
  // ── Submissions ───────────────────────────────────────────────────────────
  | "projects:view"
  | "projects:review"
  | "posters:view"
  | "posters:review"
  // ── Speakers / Panels ─────────────────────────────────────────────────────
  | "speakers:view"
  | "speakers:edit"
  | "panels:view"
  | "panels:edit"
  // ── Schedule ──────────────────────────────────────────────────────────────
  | "schedule:view"
  | "schedule:edit"
  // ── Sponsors ──────────────────────────────────────────────────────────────
  | "sponsors:view"
  | "sponsors:edit"
  | "sponsor_apps:view"
  | "sponsor_apps:edit"
  | "partners:view"
  | "partners:edit"
  // ── Content ───────────────────────────────────────────────────────────────
  | "announcements:view"
  | "announcements:edit"
  | "gallery:view"
  | "gallery:edit"
  | "faq:view"
  | "faq:edit"
  | "contact_messages:view"
  // ── Settings ──────────────────────────────────────────────────────────────
  | "settings:view"
  | "settings:edit"
  // ── Admin Users ───────────────────────────────────────────────────────────
  | "admin_roles:view"
  | "admin_roles:edit"
  // ── Audit ─────────────────────────────────────────────────────────────────
  | "audit_logs:view"
  // ── Analytics ─────────────────────────────────────────────────────────────
  | "analytics:view"

// ─── Role → Permission mapping ────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  SUPER_ADMIN: [
    // All permissions
    "verification:view", "verification:decide",
    "participants:view", "participants:edit", "participants:delete",
    "registrations:view", "registrations:edit", "registrations:checkin",
    "teams:view", "teams:edit",
    "events:view", "events:edit", "events:publish",
    "workshops:view", "workshops:edit",
    "projects:view", "projects:review",
    "posters:view", "posters:review",
    "speakers:view", "speakers:edit",
    "panels:view", "panels:edit",
    "schedule:view", "schedule:edit",
    "sponsors:view", "sponsors:edit",
    "sponsor_apps:view", "sponsor_apps:edit",
    "partners:view", "partners:edit",
    "announcements:view", "announcements:edit",
    "gallery:view", "gallery:edit",
    "faq:view", "faq:edit",
    "contact_messages:view",
    "settings:view", "settings:edit",
    "admin_roles:view", "admin_roles:edit",
    "audit_logs:view",
    "analytics:view",
  ],

  EVENT_ADMIN: [
    "events:view", "events:edit", "events:publish",
    "workshops:view", "workshops:edit",
    "projects:view", "projects:review",
    "posters:view", "posters:review",
    "speakers:view", "speakers:edit",
    "panels:view", "panels:edit",
    "schedule:view", "schedule:edit",
    "analytics:view",
  ],

  REGISTRATION_ADMIN: [
    "participants:view", "participants:edit",
    "registrations:view", "registrations:edit", "registrations:checkin",
    "teams:view", "teams:edit",
    "analytics:view",
  ],

  CONTENT_ADMIN: [
    "announcements:view", "announcements:edit",
    "gallery:view", "gallery:edit",
    "faq:view", "faq:edit",
    "contact_messages:view",
  ],

  SPONSORSHIP_ADMIN: [
    "sponsors:view", "sponsors:edit",
    "sponsor_apps:view", "sponsor_apps:edit",
    "partners:view", "partners:edit",
  ],

  VERIFICATION_ADMIN: [
    "verification:view", "verification:decide",
    "participants:view",
  ],
}

// =============================================================================
// Permission check functions
// =============================================================================

/**
 * Check if a given adminRole has a permission.
 */
export function hasPermission(
  adminRole: AdminRole | null | undefined,
  permission: Permission,
): boolean {
  if (!adminRole) {return false}
  const perms = ROLE_PERMISSIONS[adminRole]
  return perms?.includes(permission) ?? false
}

/**
 * Get the full permission list for a role (for client-side nav filtering
 * and admin UI gating — the server ALWAYS re-checks independently).
 */
export function getPermissionsForRole(
  adminRole: AdminRole | null | undefined,
): Permission[] {
  if (!adminRole) {return []}
  return [...(ROLE_PERMISSIONS[adminRole] ?? [])]
}

/**
 * Check if user is an admin (any admin role).
 */
export function isAdminRole(role: string | undefined): boolean {
  return role === "ADMIN" || role === "STAFF"
}

// =============================================================================
// Server-side session helpers
// =============================================================================

export type AuthSession = {
  user: {
    id: string
    email: string
    name: string | null
    role: UserRole
    adminRole: AdminRole | null
    isSuspended: boolean
  }
}

/**
 * Get current session in a Server Component or Route Handler.
 * Returns null if not authenticated.
 */
export async function getServerSession(): Promise<AuthSession | null> {
  const session = await auth()
  if (!session?.user?.id) {return null}
  return session
}

// =============================================================================
// Route Handler guards (for API routes)
// Usage:
//   const { session, error } = await requireAuth(request)
//   if (error) return error
// =============================================================================

type GuardResult<T> =
  | { session: T; error: null }
  | { session: null; error: NextResponse }

/**
 * Require any authenticated user.
 */
export async function requireAuth(): Promise<GuardResult<AuthSession>> {
  const session = await getServerSession()

  if (!session) {
    return {
      session: null,
      error: NextResponse.json(
        errorResponse("Authentication required", "UNAUTHORIZED"),
        { status: 401 },
      ),
    }
  }

  if (session.user.isSuspended) {
    return {
      session: null,
      error: NextResponse.json(
        errorResponse("Your account has been suspended. Contact support.", "SUSPENDED"),
        { status: 403 },
      ),
    }
  }

  return { session, error: null }
}

/**
 * Require an admin role (any ADMIN or STAFF user).
 */
export async function requireAdmin(): Promise<GuardResult<AuthSession>> {
  const { session, error } = await requireAuth()
  if (error) {return { session: null, error }}

  if (!isAdminRole(session.user.role)) {
    return {
      session: null,
      error: NextResponse.json(
        errorResponse("You do not have permission to perform this action.", "FORBIDDEN"),
        { status: 403 },
      ),
    }
  }

  return { session, error: null }
}

/**
 * Require a specific admin role permission.
 * Usage: await requirePermission("verification:decide")
 */
export async function requirePermission(
  permission: Permission,
): Promise<GuardResult<AuthSession>> {
  const { session, error } = await requireAdmin()
  if (error) {return { session: null, error }}

  if (!hasPermission(session.user.adminRole, permission)) {
    return {
      session: null,
      error: NextResponse.json(
        errorResponse(
          "You do not have permission to perform this action.",
          "FORBIDDEN",
        ),
        { status: 403 },
      ),
    }
  }

  return { session, error: null }
}

/**
 * Require SUPER_ADMIN role.
 */
export async function requireSuperAdmin(): Promise<GuardResult<AuthSession>> {
  const { session, error } = await requireAdmin()
  if (error) {return { session: null, error }}

  if (session.user.adminRole !== "SUPER_ADMIN") {
    return {
      session: null,
      error: NextResponse.json(
        errorResponse("Super admin access required.", "FORBIDDEN"),
        { status: 403 },
      ),
    }
  }

  return { session, error: null }
}

/**
 * Require the request is from the resource owner OR an admin.
 * Usage: await requireOwnerOrAdmin(session, resourceOwnerId)
 */
export function requireOwnerOrAdmin(
  session: AuthSession,
  ownerId: string,
): NextResponse | null {
  const isOwner = session.user.id === ownerId
  const isAdmin = isAdminRole(session.user.role)

  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      errorResponse("You do not have permission to access this resource.", "FORBIDDEN"),
      { status: 403 },
    )
  }

  return null // null = allowed
}

// =============================================================================
// Server Component helpers
// =============================================================================

/**
 * Use in Server Components to get session without throwing.
 * Returns null if not authenticated.
 */
export async function getSessionUser() {
  const session = await getServerSession()
  return session?.user ?? null
}

/**
 * Use in Server Components — redirects are handled by the component.
 * Returns true if user has the permission, false otherwise.
 */
export async function checkPermission(permission: Permission): Promise<boolean> {
  const session = await getServerSession()
  if (!session) {return false}
  if (!isAdminRole(session.user.role)) {return false}
  return hasPermission(session.user.adminRole, permission)
}
