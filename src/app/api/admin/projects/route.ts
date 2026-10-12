// =============================================================================
// GET /api/admin/projects
// Paginated project-submission review queue for admins with "projects:view".
//
// Filters:
// - status: whitelisted SubmissionStatus (SUBMITTED, UNDER_REVIEW, …)
// - q:      project name / team name / university
//
// Project.userId is a plain string with NO Prisma relation, so submitters are
// resolved with a second batched user lookup and merged into each row as
// `user`. Rows carry every submission field the review modal needs, so the
// console can review straight from list data.
// =============================================================================

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { adminErrorResponse } from "@/lib/admin/http"
import {
  buildSearchOr,
  parseAdminListParams,
  parseEnumFilter,
} from "@/lib/admin/query"
import { prisma } from "@/lib/db"
import { requirePermission } from "@/lib/rbac"
import { errorResponse, paginationMeta, successResponse } from "@/lib/utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STATUS_FILTERS = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "REVISION_REQUIRED",
  "PUBLISHED",
] as const

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { error } = await requirePermission("projects:view")
    if (error) {return error}

    const { page, pageSize, skip, take, q } = parseAdminListParams(request)
    const status = parseEnumFilter(
      request.nextUrl.searchParams,
      "status",
      STATUS_FILTERS,
    )

    if (!Number.isFinite(page) || !Number.isFinite(pageSize)) {
      return NextResponse.json(
        errorResponse("Invalid pagination parameters.", "VALIDATION"),
        { status: 400 },
      )
    }

    const where = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(q
        ? { OR: buildSearchOr(q, ["projectName", "teamName", "university"]) }
        : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.project.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          teamName: true,
          projectName: true,
          university: true,
          department: true,
          category: true,
          description: true,
          problemStatement: true,
          proposedSolution: true,
          technologies: true,
          githubUrl: true,
          demoUrl: true,
          imageKey: true,
          presentationKey: true,
          status: true,
          reviewNote: true,
          reviewedBy: true,
          reviewedAt: true,
          isFeatured: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.project.count({ where }),
    ])

    // Project.userId has no Prisma relation — resolve submitters manually.
    const userIds = Array.from(new Set(items.map((item) => item.userId)))
    const submitters =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : []
    const submitterById = new Map(submitters.map((user) => [user.id, user]))

    const rows = items.map((item) => ({
      ...item,
      user: submitterById.get(item.userId) ?? null,
    }))

    return NextResponse.json(
      successResponse({
        items: rows,
        pagination: paginationMeta(total, page, pageSize),
      }),
    )
  } catch (err) {
    return adminErrorResponse(err, "GET /api/admin/projects")
  }
}
