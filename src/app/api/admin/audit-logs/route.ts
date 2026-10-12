// =============================================================================
// GET /api/admin/audit-logs
// Read-only, paginated audit trail for admins with "audit_logs:view".
//
// Filters (all optional — omitted from the query entirely when not provided):
// - action:     exact match, applied only when the value matches
//               /^[A-Z][A-Z_]*$/ and is at most 64 characters long. The
//               AuditAction union in src/lib/audit.ts is type-only, so it is
//               never imported here as a runtime value.
// - targetType: exact match, whitelisted against the target-type values the
//               app actually writes (plus the remaining Prisma models that
//               could plausibly be audited). Unknown values are ignored.
// - from / to:  createdAt range. A bare "YYYY-MM-DD" `to` is treated as
//               inclusive by extending to the start of the following day.
// - q:          target ID (contains, insensitive) OR actor name / email
//               (relation filter, contains, insensitive).
//
// Audit rows are append-only — this endpoint never mutates anything.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { adminErrorResponse } from "@/lib/admin/http"
import { parseAdminListParams, parseEnumFilter } from "@/lib/admin/query"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, paginationMeta, successResponse } from "@/lib/utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Every targetType value written by auditLog() calls in this codebase
// (User, ParticipantProfile, EventRegistration, Team, TeamMember,
// StudentVerification, Project, Poster, Workshop, Speaker, Panel,
// ScheduleItem, Sponsor, SponsorApplication, Partner, Announcement,
// GalleryImage, Upload, …) plus the remaining Prisma models that could
// plausibly be audited later — never narrower than what the app writes.
const TARGET_TYPE_FILTERS = [
  "User",
  "ParticipantProfile",
  "University",
  "Event",
  "EventRegistration",
  "Team",
  "TeamMember",
  "StudentVerification",
  "Project",
  "Poster",
  "Workshop",
  "WorkshopRegistration",
  "Speaker",
  "Panel",
  "Panelist",
  "ScheduleItem",
  "Sponsor",
  "SponsorApplication",
  "Partner",
  "Announcement",
  "GalleryImage",
  "FAQ",
  "ContactMessage",
  "SiteSetting",
  "AuditLog",
  "Upload",
] as const

const ACTION_PATTERN = /^[A-Z][A-Z_]*$/
const ACTION_MAX_LENGTH = 64
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000

type ParsedDateFilter = { date: Date; dateOnly: boolean }

/** Parse a date param — returns null when absent or not parseable. */
function parseDateFilter(raw: string | null): ParsedDateFilter | null {
  if (!raw) {return null}
  const trimmed = raw.trim()
  if (trimmed.length === 0) {return null}
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) {return null}
  return { date, dateOnly: DATE_ONLY_PATTERN.test(trimmed) }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("audit_logs:view")
    if (error) {return error}

    const { page, pageSize, skip, take, q } = parseAdminListParams(request)
    const params = request.nextUrl.searchParams

    // ── action: pattern-validated exact match ─────────────────────────────
    const rawAction = (params.get("action") ?? "").trim()
    const action =
      rawAction.length > 0 &&
      rawAction.length <= ACTION_MAX_LENGTH &&
      ACTION_PATTERN.test(rawAction)
        ? rawAction
        : undefined

    // ── targetType: whitelisted exact match ───────────────────────────────
    const targetType = parseEnumFilter(params, "targetType", TARGET_TYPE_FILTERS)

    // ── date range ─────────────────────────────────────────────────────────
    const from = parseDateFilter(params.get("from"))
    const to = parseDateFilter(params.get("to"))

    if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
      return NextResponse.json(
        errorResponse("Invalid pagination parameters.", "VALIDATION"),
        { status: 400 },
      )
    }

    const createdAt: { gte?: Date; lt?: Date; lte?: Date } = {}
    if (from) {createdAt.gte = from.date}
    if (to) {
      if (to.dateOnly) {
        // new Date("YYYY-MM-DD") is midnight UTC — treat `to` as inclusive
        // by querying strictly before the start of the following day.
        createdAt.lt = new Date(to.date.getTime() + DAY_MS)
      } else {
        createdAt.lte = to.date
      }
    }

    const where = {
      ...(action ? { action } : {}),
      ...(targetType ? { targetType } : {}),
      ...(from || to ? { createdAt } : {}),
      ...(q
        ? {
            OR: [
              { targetId: { contains: q, mode: "insensitive" as const } },
              {
                actor: {
                  OR: [
                    { name: { contains: q, mode: "insensitive" as const } },
                    { email: { contains: q, mode: "insensitive" as const } },
                  ],
                },
              },
            ],
          }
        : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json(
      successResponse({
        items,
        pagination: paginationMeta(total, page, pageSize),
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/audit-logs")
  }
}
