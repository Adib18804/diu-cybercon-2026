// =============================================================================
// Dashboard Layout — auth gate for all /dashboard/* routes.
// Unauthenticated visitors are redirected to the login page with a callback
// back to the dashboard; suspended accounts are sent to the notice page.
// Private area: never indexed (see also per-page robots metadata).
// =============================================================================

import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/dashboard"
import { getSessionUser } from "@/lib/rbac"

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s | Dashboard | DIU_CYBERCON 2026",
  },
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login?callbackUrl=/dashboard")
  }
  if (user.isSuspended) {
    redirect("/suspended")
  }

  const displayName = user.name?.trim() || user.email.split("@")[0] || "Participant"

  return (
    <DashboardShell userName={displayName} userEmail={user.email}>
      {children}
    </DashboardShell>
  )
}
