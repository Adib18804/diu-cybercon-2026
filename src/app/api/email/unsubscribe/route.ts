// =============================================================================
// GET  /api/email/unsubscribe?token=...  — confirmation page (no state change)
// POST /api/email/unsubscribe            — perform the opt-out
//
// GET never mutates state, so mail-scanner link prefetching cannot
// unsubscribe anyone. The confirmation page posts back to this same URL; the
// POST handler also accepts the RFC 8058 "List-Unsubscribe=One-Click" body
// sent by mailbox providers (token arrives in the query string in that case).
// Tokens are signed JWTs that carry only the user id — no PII in the URL.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe"
import { checkRateLimit } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ─── HTML rendering ───────────────────────────────────────────────────────────

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
} as const

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function renderPage({
  title,
  message,
  formToken,
}: {
  title: string
  message: string
  formToken?: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(title)} — DIU CyberCon 2026</title>
</head>
<body style="margin:0;padding:0;background-color:#05070d;font-family:'Inter',Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:64px 24px;">
  <div style="text-align:center;padding-bottom:28px;border-bottom:1px solid #1f2937;margin-bottom:32px;">
    <div style="font-family:'Courier New',monospace;font-size:18px;font-weight:700;color:#00e5ff;letter-spacing:0.1em;">DIU CYBERCON 2026</div>
    <div style="font-size:11px;color:#8b949e;letter-spacing:0.15em;text-transform:uppercase;margin-top:4px;">LEARN · SECURE · DEFEND</div>
  </div>
  <h1 style="font-size:22px;font-weight:700;color:#e6edf3;margin:0 0 12px;line-height:1.3;">${escapeHtml(title)}</h1>
  <p style="font-size:15px;color:#8b949e;line-height:1.7;margin:0 0 24px;">${escapeHtml(message)}</p>
  ${
    formToken
      ? `<form method="POST" action="/api/email/unsubscribe" style="margin:28px 0 0;">
    <input type="hidden" name="token" value="${escapeHtml(formToken)}">
    <button type="submit" style="display:inline-block;padding:14px 32px;background-color:#00e5ff;color:#05070d;font-size:13px;font-weight:700;border:none;border-radius:8px;letter-spacing:0.08em;text-transform:uppercase;font-family:'Courier New',monospace;cursor:pointer;">Unsubscribe me</button>
  </form>`
      : ""
  }
  <div style="text-align:center;padding-top:32px;border-top:1px solid #1f2937;margin-top:40px;">
    <p style="font-size:12px;color:#4d5966;line-height:1.6;margin:0;">
      Cyber Security Club, Department of CSE<br>
      Daffodil International University, Bangladesh
    </p>
  </div>
</div>
</body>
</html>`
}

function htmlResponse(body: string, status: number, extraHeaders?: Record<string, string>) {
  return new NextResponse(body, {
    status,
    headers: { ...HTML_HEADERS, ...extraHeaders },
  })
}

// ─── GET — confirmation page (safe to prefetch: no state change) ─────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token") ?? ""
  const userId = token ? await verifyUnsubscribeToken(token) : null

  if (!userId) {
    return htmlResponse(
      renderPage({
        title: "Link invalid or expired",
        message:
          "This unsubscribe link is not valid any more. If you keep receiving announcement emails, please contact us and we will remove you manually.",
      }),
      400,
    )
  }

  return htmlResponse(
    renderPage({
      title: "Unsubscribe from announcement emails?",
      message:
        "You will stop receiving broadcast announcements from DIU CyberCon 2026. Important transactional emails (registration, verification, submissions) are not affected.",
      formToken: token,
    }),
    200,
  )
}

// ─── POST — perform the opt-out (form submit or RFC 8058 one-click) ──────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = extractIpAddress(request)

  const limit = await checkRateLimit("unsubscribe", ip)
  if (!limit.success) {
    return htmlResponse(
      renderPage({
        title: "Too many requests",
        message: "Please wait a moment and try again.",
      }),
      429,
      { "Retry-After": String(limit.retryAfter) },
    )
  }

  // The token arrives as a form field from the confirmation page, or in the
  // query string for RFC 8058 one-click POSTs (the List-Unsubscribe URL
  // already embeds it). A bodyless POST parses as an empty form — fine.
  let token = request.nextUrl.searchParams.get("token") ?? ""
  try {
    const form = await request.formData()
    const formToken = form.get("token")
    if (typeof formToken === "string" && formToken) {
      token = formToken
    }
  } catch {
    // Not a form body — keep the query-string token.
  }

  const userId = token ? await verifyUnsubscribeToken(token) : null
  if (!userId) {
    return htmlResponse(
      renderPage({
        title: "Link invalid or expired",
        message:
          "This unsubscribe link is not valid any more. If you keep receiving announcement emails, please contact us and we will remove you manually.",
      }),
      400,
    )
  }

  // updateMany keeps this idempotent: repeat clicks, one-click retries and
  // deleted accounts all end with a success page and no error.
  await prisma.user.updateMany({
    where: { id: userId, emailOptOut: false },
    data: { emailOptOut: true },
  })

  void auditLog({
    actorId: userId,
    action: "EMAIL_UNSUBSCRIBED",
    targetType: "User",
    targetId: userId,
    ipAddress: ip,
    userAgent: extractUserAgent(request),
  })

  return htmlResponse(
    renderPage({
      title: "You're unsubscribed",
      message:
        "You will no longer receive announcement emails from DIU CyberCon 2026. If this was a mistake, contact us and we will add you back.",
    }),
    200,
  )
}
