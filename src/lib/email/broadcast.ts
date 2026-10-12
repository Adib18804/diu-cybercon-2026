// =============================================================================
// Announcement broadcast — recipient preparation + paced background delivery
// -----------------------------------------------------------------------------
// Flow:
//   1. prepareBroadcast()      — validates the announcement, computes the
//      eligible audience, applies the rolling hourly cap and excludes
//      participants who already received this exact announcement (subject
//      match against EmailLog), so re-running a partially delivered broadcast
//      is always safe.
//   2. runBroadcastDelivery()  — fire-and-forget paced delivery loop started by
//      the admin route. Progress lives in EmailLog; the announcement is
//      stamped with broadcastAt once at least one email has been delivered.
//      Delivery never throws — failures are logged and stay retry-eligible.
//
// The dedupe key is the broadcast subject. Renaming an announcement after a
// partial send breaks the match (remaining recipients would be re-queued) —
// acceptable: the hourly cap still bounds any accidental resend.
// =============================================================================

import { prisma } from "@/lib/db"
import { broadcastSubject, sendBroadcastEmail } from "@/lib/email/resend"
import { buildUnsubscribeUrl } from "@/lib/email/unsubscribe"

// ─── Tuning ───────────────────────────────────────────────────────────────────

export const HOURLY_BROADCAST_BUDGET = 300
const MAX_QUEUE_PER_RUN = 300
const CONCURRENCY = 4
const TIME_BUDGET_MS = 120_000
const BATCH_PAUSE_MS = 350

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BroadcastRecipient {
  id: string
  email: string
  name: string | null
}

export interface PreparedBroadcast {
  announcementId: string
  title: string
  content: string
  recipients: BroadcastRecipient[]
  alreadyDelivered: number
  hourlyRemaining: number
}

export type PrepareBroadcastResult =
  | { ok: true; job: PreparedBroadcast }
  | {
      ok: false
      reason:
        | "NOT_FOUND"
        | "NOT_PUBLISHED"
        | "ALREADY_SENT"
        | "HOURLY_CAP"
        | "NO_RECIPIENTS"
      message: string
      alreadyDelivered?: number
      hourlyRemaining?: number
    }

// ─── Preparation (runs synchronously inside the admin request) ────────────────

export async function prepareBroadcast(
  announcementId: string,
): Promise<PrepareBroadcastResult> {
  const announcement = await prisma.announcement.findFirst({
    where: { id: announcementId, deletedAt: null },
    select: {
      id: true,
      title: true,
      content: true,
      isPublished: true,
      broadcastAt: true,
    },
  })

  if (!announcement) {
    return { ok: false, reason: "NOT_FOUND", message: "Announcement not found." }
  }
  if (!announcement.isPublished) {
    return {
      ok: false,
      reason: "NOT_PUBLISHED",
      message: "Publish the announcement before broadcasting it.",
    }
  }

  const subject = broadcastSubject(announcement.title)

  const [alreadySentRows, hourlyCount] = await Promise.all([
    prisma.emailLog.findMany({
      where: { category: "broadcast", subject, status: "SENT" },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.emailLog.count({
      where: {
        category: "broadcast",
        status: "SENT",
        createdAt: { gte: new Date(Date.now() - 3_600_000) },
      },
    }),
  ])

  const deliveredIds = alreadySentRows
    .map((row) => row.userId)
    .filter((id): id is string => id !== null)
  const deliveredIdSet = new Set(deliveredIds)

  const hourlyRemaining = Math.max(0, HOURLY_BROADCAST_BUDGET - hourlyCount)
  if (hourlyRemaining === 0) {
    return {
      ok: false,
      reason: "HOURLY_CAP",
      message: "Hourly send limit reached. Please try again later.",
      alreadyDelivered: deliveredIds.length,
      hourlyRemaining: 0,
    }
  }

  const recipients = await prisma.user.findMany({
    where: {
      role: "PARTICIPANT",
      isSuspended: false,
      deletedAt: null,
      emailOptOut: false,
      ...(deliveredIdSet.size > 0 ? { id: { notIn: [...deliveredIdSet] } } : {}),
    },
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "asc" },
    take: Math.min(hourlyRemaining, MAX_QUEUE_PER_RUN),
  })

  if (recipients.length === 0) {
    if (deliveredIdSet.size > 0) {
      return {
        ok: false,
        reason: "ALREADY_SENT",
        message:
          "Every eligible participant has already received this announcement.",
        alreadyDelivered: deliveredIdSet.size,
        hourlyRemaining,
      }
    }
    return {
      ok: false,
      reason: "NO_RECIPIENTS",
      message: "There are no eligible participants to email yet.",
      hourlyRemaining,
    }
  }

  return {
    ok: true,
    job: {
      announcementId: announcement.id,
      title: announcement.title,
      content: announcement.content,
      recipients,
      alreadyDelivered: deliveredIdSet.size,
      hourlyRemaining: hourlyRemaining - recipients.length,
    },
  }
}

// ─── Delivery (background, fire-and-forget) ───────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Paced background delivery. Never throws; never rejects. Each recipient gets
 * a personal unsubscribe URL and a List-Unsubscribe header. Stamps the
 * announcement with broadcastAt once at least one email was delivered so the
 * admin UI can show when the last broadcast went out.
 */
export async function runBroadcastDelivery(job: PreparedBroadcast): Promise<void> {
  const startedAt = Date.now()
  const deadline = startedAt + TIME_BUDGET_MS
  let sent = 0
  let failed = 0
  let processed = 0

  try {
    for (
      let offset = 0;
      offset < job.recipients.length;
      offset += CONCURRENCY
    ) {
      if (Date.now() >= deadline) {break}

      const batch = job.recipients.slice(offset, offset + CONCURRENCY)
      const results = await Promise.all(
        batch.map(async (recipient) => {
          try {
            const unsubscribeUrl = await buildUnsubscribeUrl(recipient.id)
            const result = await sendBroadcastEmail({
              to: recipient.email,
              name: (recipient.name && recipient.name.trim()) || "there",
              title: job.title,
              content: job.content,
              unsubscribeUrl,
              userId: recipient.id,
            })
            return result.success
          } catch (err) {
            console.error(
              "[Broadcast] Recipient send crashed:",
              err instanceof Error ? err.message : err,
            )
            return false
          }
        }),
      )

      for (const ok of results) {
        if (ok) {sent += 1} else {failed += 1}
      }
      processed += batch.length

      if (offset + CONCURRENCY < job.recipients.length && Date.now() < deadline) {
        await sleep(BATCH_PAUSE_MS)
      }
    }

    // Stamp once anything was delivered. Failed recipients stay retry-eligible
    // because dedupe only skips SENT rows.
    if (sent > 0) {
      await prisma.announcement.update({
        where: { id: job.announcementId },
        data: { broadcastAt: new Date() },
      })
    }
  } catch (err) {
    console.error(
      "[Broadcast] Delivery loop failed:",
      err instanceof Error ? err.message : err,
    )
  }

  // Successful sends are recorded per-recipient in EmailLog; only deliveries
  // with failures need an aggregate line in the server logs.
  if (failed > 0) {
    console.error(
      `[Broadcast] announcement=${job.announcementId} completed with failures: sent=${sent} failed=${failed} processed=${processed} remaining=${job.recipients.length - processed} elapsedMs=${Date.now() - startedAt}`,
    )
  }
}
