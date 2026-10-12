// =============================================================================
// /api/admin/settings
// GET — every SiteSetting row, ordered by group then key. Requires
//       "settings:view" (super admin only).
// PUT — batch-update setting values. Requires "settings:edit".
//
// Update semantics:
// - Duplicate keys in one payload are de-duplicated, last value wins.
// - Only keys whose value actually differs from the stored value are written,
//   so an unchanged save is a no-op that still returns the current settings.
// - Writes run in one transaction; the audit entry carries only the changed
//   keys (before/after per key) plus the changed key list in metadata.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, successResponse } from "@/lib/utils"
import { settingsUpdateSchema } from "@/lib/validations/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Every setting, ordered the way the settings page renders them. */
async function listSettings() {
  return prisma.siteSetting.findMany({
    orderBy: [{ group: "asc" }, { key: "asc" }],
  })
}

export async function GET(): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("settings:view")
    if (error) {return error}

    const settings = await listSettings()

    return NextResponse.json(successResponse(settings))
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/settings")
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("settings:edit")
    if (error) {return error}

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        errorResponse("Invalid JSON body.", "INVALID_JSON"),
        { status: 400 },
      )
    }

    const parsed = settingsUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(
          "Please fix the highlighted fields and try again.",
          "VALIDATION",
          parsed.error.flatten().fieldErrors as Record<string, string[]>,
        ),
        { status: 422 },
      )
    }

    // De-duplicate payload keys — the last value for a key wins.
    const requested = new Map<string, string>()
    for (const update of parsed.data.updates) {
      requested.set(update.key, update.value)
    }

    const existing = await prisma.siteSetting.findMany({
      where: { key: { in: [...requested.keys()] } },
      select: { key: true, value: true },
    })
    const previous = new Map(existing.map((row) => [row.key, row.value]))

    const changed = [...requested.entries()]
      .filter(([key, value]) => previous.get(key) !== value)
      .map(([key, value]) => ({ key, value }))

    // Nothing actually differs from what is stored — return the current
    // settings untouched, without writing or auditing.
    if (changed.length === 0) {
      const settings = await listSettings()
      return NextResponse.json(
        successResponse(settings, "No changes to save."),
      )
    }

    await prisma.$transaction(
      changed.map((update) =>
        prisma.siteSetting.upsert({
          where: { key: update.key },
          create: {
            key: update.key,
            value: update.value,
            updatedBy: session.user.id,
          },
          update: {
            value: update.value,
            updatedBy: session.user.id,
          },
        }),
      ),
    )

    const before: Record<string, string | null> = {}
    const after: Record<string, string> = {}
    for (const update of changed) {
      before[update.key] = previous.get(update.key) ?? null
      after[update.key] = update.value
    }

    await auditLog({
      actorId: session.user.id,
      action: "SETTINGS_UPDATED",
      targetType: "SiteSetting",
      before,
      after,
      metadata: { changedKeys: changed.map((update) => update.key) },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    const settings = await listSettings()

    return NextResponse.json(successResponse(settings, "Settings updated."))
  } catch (err) {
    return adminErrorResponse(err, "PUT /api/admin/settings")
  }
}
