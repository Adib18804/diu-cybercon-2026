// =============================================================================
// Dashboard — Profile
// Server component: loads profile + universities, renders the edit form.
// =============================================================================

import { UserCog } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { EmptyState, ProfileForm } from "@/components/dashboard"
import { Card, CardContent } from "@/components/ui"
import {
  getActiveUniversities,
  getDashboardProfile,
} from "@/lib/dashboard/queries"
import { getSessionUser } from "@/lib/rbac"

export const metadata: Metadata = {
  title: "Profile",
}

export const dynamic = "force-dynamic"

export default async function DashboardProfilePage() {
  const user = await getSessionUser()
  if (!user) {return null}

  const [profile, universities] = await Promise.all([
    getDashboardProfile(user.id),
    getActiveUniversities(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-text-primary">
          Profile
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Keep your details up to date — they appear on your registration,
          team, and event kit.
        </p>
      </div>

      <Card>
        <CardContent className="pt-0">
          {profile ? (
            <ProfileForm profile={profile} universities={universities} />
          ) : (
            <EmptyState
              icon={<UserCog className="h-6 w-6" />}
              title="No profile yet"
              description="Register for an event and your participant profile will be created automatically."
              action={
                <Link href="/register" className="btn-primary">
                  Register for an Event
                </Link>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
