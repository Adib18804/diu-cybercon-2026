// =============================================================================
// GET /api/files/verification/[id]
// Serves a stored student ID to authorized admins ONLY.
//
// SECURITY CHAIN:
// 1. Admin session required + "verification:view" permission
// 2. HMAC-signed, ≤ 5-minute expiring URL (exp + sig query params)
// 3. Every successful view is logged (VerificationAccessLog + audit trail)
// 4. Response is private/no-store and noindex — never cached, never indexed
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auditLog, extractIpAddress, extractUserAgent } from "@/lib/audit"
import { ERROR_MESSAGES } from "@/lib/constants"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { readPrivateFile, verifyViewSignature } from "@/lib/storage"
import { errorResponse } from "@/lib/utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  if (!id) {
    return NextResponse.json(
      errorResponse(ERROR_MESSAGES.NOT_FOUND, "NOT_FOUND"),
      { status: 400 },
    )
  }

  // ── 1. Admin permission gate ─────────────────────────────────────────────
  const { session, error } = await requirePermission("verification:view")
  if (error) {return error}

  // ── 2. Signed URL verification (expiry + HMAC, constant-time) ────────────
  const searchParams = request.nextUrl.searchParams
  const exp = Number(searchParams.get("exp"))
  const sig = searchParams.get("sig") ?? ""

  if (!Number.isFinite(exp) || !sig) {
    return NextResponse.json(
      errorResponse("A signed URL is required to view this document.", "FORBIDDEN"),
      { status: 403 },
    )
  }

  if (!verifyViewSignature(id, exp, sig)) {
    return NextResponse.json(
      errorResponse(ERROR_MESSAGES.INVALID_TOKEN, "INVALID_TOKEN"),
      { status: 403 },
    )
  }

  // ── 3. Load the verification record ──────────────────────────────────────
  let verification: {
    id: string
    fileKey: string
    fileName: string
    fileMimeType: string
  } | null = null

  try {
    verification = await prisma.studentVerification.findUnique({
      where: { id },
      select: {
        id:           true,
        fileKey:      true,
        fileName:     true,
        fileMimeType: true,
      },
    })
  } catch (err) {
    console.error(`[GET /api/files/verification/${id}] DB error:`, err)
    return NextResponse.json(
      errorResponse(ERROR_MESSAGES.INTERNAL, "INTERNAL"),
      { status: 500 },
    )
  }

  if (!verification) {
    return NextResponse.json(
      errorResponse(ERROR_MESSAGES.NOT_FOUND, "NOT_FOUND"),
      { status: 404 },
    )
  }

  // ── 4. Read from PRIVATE storage ─────────────────────────────────────────
  const buffer = await readPrivateFile(verification.fileKey)

  if (!buffer) {
    return NextResponse.json(
      errorResponse("Document file is unavailable.", "NOT_FOUND"),
      { status: 404 },
    )
  }

  // ── 5. Log every access — immutable trail ────────────────────────────────
  const ipAddress = extractIpAddress(request)
  const userAgent = extractUserAgent(request)

  try {
    await prisma.verificationAccessLog.create({
      data: {
        verificationId: verification.id,
        adminId:        session.user.id,
        ipAddress,
        userAgent,
      },
    })
  } catch (err) {
    console.error("[verification access log] failed:", err)
  }

  await auditLog({
    actorId: session.user.id,
    action: "STUDENT_ID_VIEWED",
    targetType: "StudentVerification",
    targetId: verification.id,
    ipAddress,
    userAgent,
  })

  // ── 6. Stream with hardened headers ──────────────────────────────────────
  const safeInlineName = verification.fileName.replace(/[^\w.\- ]/g, "_")

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": verification.fileMimeType || "application/octet-stream",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `inline; filename="${safeInlineName}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
