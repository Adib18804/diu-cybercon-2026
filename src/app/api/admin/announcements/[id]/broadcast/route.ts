// =============================================================================
// POST /api/admin/announcements/[id]/broadcast — email a published
//       announcement to every eligible participant (announcements:edit)
//
// The audience is prepared synchronously (publish guard, dedupe against
// EmailLog, rolling hourly cap, opt-out filter) and delivery then runs in the
// background with pacing — progress and failures live in EmailLog. Re-running
// a partially delivered broadcast only queues the recipients who did not
// receive it yet, so the button is safe to press again.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { AdminError, adminErrorResponse } from "@/lib/admin/http"
import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prepareBroadcast, runBroadcastDelivery } from "@/lib/email/broadcast"
import { requirePermission } from "@/lib/rbac"
import { successResponse } from "@/lib/utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { session, error } = await requirePermission("announcements:edit")
    if (error) {return error}

    const { id } = await params

    const prepared = await prepareBroadcast(id)

    if (!prepared.ok) {
      // A fully delivered broadcast is informational, not an error.
      if (prepared.reason === "ALREADY_SENT") {
        return NextResponse.json(
          successResponse(
            {
              queued: 0,
              alreadyDelivered: prepared.alreadyDelivered ?? 0,
              hourlyRemaining: prepared.hourlyRemaining ?? 0,
            },
            prepared.message,
          ),
        )
      }

      if (prepared.reason === "NOT_FOUND") {
        throw new AdminError(prepared.message, "NOT_FOUND", 404)
      }
      if (prepared.reason === "HOURLY_CAP") {
        throw new AdminError(prepared.message, "RATE_LIMITED", 429)
      }
      // NOT_PUBLISHED / NO_RECIPIENTS — the request was valid, the state is not.
      throw new AdminError(prepared.message, "BROADCAST_REFUSED", 400)
    }

    const { job } = prepared

    await auditLog({
      actorId: session.user.id,
      action: "ANNOUNCEMENT_BROADCASTED",
      targetType: "Announcement",
      targetId: job.announcementId,
      after: {
        queued: job.recipients.length,
        alreadyDelivered: job.alreadyDelivered,
      },
      ipAddress: extractIpAddress(request),
      userAgent: extractUserAgent(request),
    })

    // Fire-and-forget: the paced runner keeps this Node process busy until the
    // queue drains, never throws, and logs every attempt to EmailLog.
    void runBroadcastDelivery(job)

    return NextResponse.json(
      successResponse(
        {
          queued: job.recipients.length,
          alreadyDelivered: job.alreadyDelivered,
          hourlyRemaining: job.hourlyRemaining,
        },
        `Broadcast queued for ${job.recipients.length} recipient${job.recipients.length === 1 ? "" : "s"}.`,
      ),
      { status: 202 },
    )
  } catch (err) {
    return adminErrorResponse(err, "POST /api/admin/announcements/[id]/broadcast")
  }
}
