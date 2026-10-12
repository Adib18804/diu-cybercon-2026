// =============================================================================
// Admin Layout — auth + RBAC gate for all /admin/* routes.
// Unauthenticated visitors → login with callback; non-admins → 403.
// Private area: never indexed. Permissions are derived server-side and passed
// to the shell for navigation filtering only — every API re-checks them.
// =============================================================================

import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AdminShell } from "@/components/admin"
import { getPermissionsForRole, getSessionUser, isAdminRole } from "@/lib/rbac"

export const metadata: Metadata = {
  title: {
    default: "Admin Console",
    template: "%s | Admin | DIU CyberCon 2026",
  },
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login?callbackUrl=/admin")
  }
  if (user.isSuspended) {
    redirect("/suspended")
  }
  if (!isAdminRole(user.role)) {
    redirect("/403")
  }

  const permissions = getPermissionsForRole(user.adminRole)
  const displayName = user.name?.trim() || user.email.split("@")[0] || "Admin"

  return (
    <AdminShell
      userName={displayName}
      userEmail={user.email}
      adminRole={user.adminRole}
      permissions={permissions}
    >
      {children}
    </AdminShell>
  )
}
