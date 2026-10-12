// =============================================================================
// Dashboard — My Team
// Team rosters with member verification status and leader-only management.
// =============================================================================

import { Users } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { EmptyState, TeamPanel } from "@/components/dashboard"
import { getActiveUniversities, getMyTeams } from "@/lib/dashboard/queries"
import { getSessionUser } from "@/lib/rbac"

export const metadata: Metadata = {
  title: "My Team",
}

export const dynamic = "force-dynamic"

export default async function DashboardTeamPage() {
  const user = await getSessionUser()
  if (!user) {return null}

  const [teams, universities] = await Promise.all([
    getMyTeams(user.id),
    getActiveUniversities(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-text-primary">
          My Team
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Manage your team roster, add members, and track their student ID
          verification.
        </p>
      </div>

      {teams.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No teams yet"
          description="Register for a team event (CTF, Project Showcase, or Poster Presentation) and a team will be created for you automatically."
          action={
            <Link href="/register" className="btn-primary">
              Register for an Event
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {teams.map((team) => (
            <TeamPanel key={team.id} team={team} universities={universities} />
          ))}

          <p className="text-xs leading-relaxed text-text-faint">
            Need to update your own details (name, department, phone, t-shirt
            size, institution)? Edit them on your{" "}
            <Link
              href="/dashboard/profile"
              className="text-cyan underline-offset-2 hover:underline"
            >
              Profile page
            </Link>
            . Member details are edited by removing and re-adding the member.
          </p>
        </div>
      )}
    </div>
  )
}
