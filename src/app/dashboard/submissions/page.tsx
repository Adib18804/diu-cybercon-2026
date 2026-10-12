// =============================================================================
// Dashboard — My Submissions
// Project Showcasing + Poster Presentation submissions with the full review
// workflow: submit → under review → approved / revision required / rejected.
// =============================================================================

import { FolderKanban } from "lucide-react"
import type { Metadata } from "next"

import {
  PosterSubmissionPanel,
  ProjectSubmissionPanel,
} from "@/components/dashboard"
import { Alert } from "@/components/ui"
import {
  getDashboardProfile,
  getMyPosters,
  getMyProjects,
  getMyRegistrations,
} from "@/lib/dashboard/queries"
import { getSessionUser } from "@/lib/rbac"

export const metadata: Metadata = {
  title: "My Submissions",
}

export const dynamic = "force-dynamic"

/** Event slugs used by the submission services (must match the server). */
const PROJECT_EVENT_SLUG = "project-showcase"
const POSTER_EVENT_SLUG = "poster"

export default async function DashboardSubmissionsPage() {
  const user = await getSessionUser()
  if (!user) {return null}

  const [registrations, projects, posters, profile] = await Promise.all([
    getMyRegistrations(user.id),
    getMyProjects(user.id),
    getMyPosters(user.id),
    getDashboardProfile(user.id),
  ])

  const projectReg =
    registrations.find(
      (r) => r.eventSlug === PROJECT_EVENT_SLUG && r.status !== "CANCELLED",
    ) ?? null
  const posterReg =
    registrations.find(
      (r) => r.eventSlug === POSTER_EVENT_SLUG && r.status !== "CANCELLED",
    ) ?? null

  const project = projects[0] ?? null
  const poster = posters[0] ?? null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-text-primary">
          My Submissions
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Submit and track your Project Showcasing and Poster Presentation
          entries through the review workflow.
        </p>
      </div>

      <Alert variant="info" title="How review works">
        Submit → Under review → Approved / Revision required / Rejected →
        Published. Editing a submission after a review re-enters the workflow,
        so the review team always sees your latest version.
      </Alert>

      {/* ── Project Showcasing ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-cyan" aria-hidden="true" />
          <h3 className="font-display text-base font-semibold text-text-primary">
            Project Showcasing
          </h3>
        </div>
        <ProjectSubmissionPanel
          existing={project}
          eligible={projectReg !== null}
          defaults={{
            teamName: projectReg?.teamName ?? "",
            university: profile?.universityName ?? "",
            department: profile?.department ?? "",
          }}
        />
      </section>

      {/* ── Poster Presentation ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-violet" aria-hidden="true" />
          <h3 className="font-display text-base font-semibold text-text-primary">
            Poster Presentation
          </h3>
        </div>
        <PosterSubmissionPanel
          existing={poster}
          eligible={posterReg !== null}
          defaults={{
            teamName: posterReg?.teamName ?? "",
            university: profile?.universityName ?? "",
            department: profile?.department ?? "",
            contactName: profile?.fullName ?? user.name?.trim() ?? "",
            contactEmail: profile?.email ?? user.email,
          }}
        />
      </section>
    </div>
  )
}
