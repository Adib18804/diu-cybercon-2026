// =============================================================================
// GET /api/admin/stats
// Dashboard metrics for the admin console. Every stat is permission-gated:
// only the keys the requesting role may see are computed and returned.
// =============================================================================

import { NextResponse } from "next/server"

import { adminErrorResponse } from "@/lib/admin/http"
import { getAdminDashboardStats } from "@/lib/admin/stats"
import { requireAdmin } from "@/lib/rbac"
import { successResponse } from "@/lib/utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(): Promise<NextResponse> {
  try {
    const { session, error } = await requireAdmin()
    if (error) {return error}

    const stats = await getAdminDashboardStats(session.user.adminRole)
    return NextResponse.json(successResponse(stats))
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/stats")
  }
}
