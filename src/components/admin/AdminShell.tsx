"use client"

// =============================================================================
// AdminShell — admin console frame: identity header + permission-filtered
// grouped navigation (sidebar on desktop, scroll strip on mobile) + content.
//
// Navigation visibility is filtered by the permission list passed from the
// server layout — but this is UX only. Every API route re-checks permissions
// server-side with requirePermission(). Never trust the client.
// =============================================================================

import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileImage,
  FolderKanban,
  Handshake,
  HeartHandshake,
  HelpCircle,
  Images,
  Inbox,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessagesSquare,
  Mic,
  ScanLine,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  UsersRound,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"

import type { Permission } from "@/lib/rbac"
import { cn } from "@/lib/utils"

import { AdminRoleBadge } from "./status"

// ─── Navigation model ─────────────────────────────────────────────────────────

interface NavItem {
  href: Route
  label: string
  icon: LucideIcon
  /** Shown only when the admin has this permission (undefined = always). */
  permission?: Permission
  exact?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3, permission: "analytics:view" },
    ],
  },
  {
    label: "Registrations",
    items: [
      { href: "/admin/participants", label: "Participants", icon: Users, permission: "participants:view" },
      { href: "/admin/verifications", label: "Verifications", icon: ShieldCheck, permission: "verification:view" },
      { href: "/admin/teams", label: "Teams", icon: UsersRound, permission: "teams:view" },
      { href: "/admin/registrations", label: "Registrations", icon: ClipboardList, permission: "registrations:view" },
      { href: "/admin/check-in", label: "Check-in", icon: ScanLine, permission: "registrations:checkin" },
    ],
  },
  {
    label: "Submissions",
    items: [
      { href: "/admin/projects", label: "Projects", icon: FolderKanban, permission: "projects:view" },
      { href: "/admin/posters", label: "Posters", icon: FileImage, permission: "posters:view" },
    ],
  },
  {
    label: "Program",
    items: [
      { href: "/admin/workshops", label: "Workshops", icon: Wrench, permission: "workshops:view" },
      { href: "/admin/speakers", label: "Speakers", icon: Mic, permission: "speakers:view" },
      { href: "/admin/panels", label: "Panels", icon: MessagesSquare, permission: "panels:view" },
      { href: "/admin/schedule", label: "Schedule", icon: CalendarDays, permission: "schedule:view" },
    ],
  },
  {
    label: "Sponsorship",
    items: [
      { href: "/admin/sponsors", label: "Sponsors", icon: Handshake, permission: "sponsors:view" },
      { href: "/admin/sponsor-apps", label: "Applications", icon: Inbox, permission: "sponsor_apps:view" },
      { href: "/admin/partners", label: "Partners", icon: HeartHandshake, permission: "partners:view" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/announcements", label: "Announcements", icon: Megaphone, permission: "announcements:view" },
      { href: "/admin/gallery", label: "Gallery", icon: Images, permission: "gallery:view" },
      { href: "/admin/faq", label: "FAQ", icon: HelpCircle, permission: "faq:view" },
      { href: "/admin/contact-messages", label: "Messages", icon: Mail, permission: "contact_messages:view" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings:view" },
      { href: "/admin/roles", label: "Admin Roles", icon: UserCog, permission: "admin_roles:view" },
      { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText, permission: "audit_logs:view" },
    ],
  },
]

// ─── Shell ────────────────────────────────────────────────────────────────────

export interface AdminShellProps {
  userName: string
  userEmail: string
  adminRole: string | null
  /** Permissions for this admin (server-derived via getPermissionsForRole). */
  permissions: Permission[]
  children: React.ReactNode
}

export function AdminShell({
  userName,
  userEmail,
  adminRole,
  permissions,
  children,
}: AdminShellProps) {
  const pathname = usePathname()
  const permissionSet = React.useMemo(
    () => new Set<string>(permissions),
    [permissions],
  )

  const visibleGroups = React.useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => !item.permission || permissionSet.has(item.permission),
        ),
      })).filter((group) => group.items.length > 0),
    [permissionSet],
  )

  const isActive = React.useCallback(
    (item: NavItem) => {
      if (item.exact) {return pathname === item.href}
      // "/admin" would match everything — only match deeper paths
      return pathname === item.href || pathname.startsWith(`${item.href}/`)
    },
    [pathname],
  )

  return (
    <section className="section">
      <div className="section-inner">
        {/* ── Identity header ─────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-label">Admin Console</p>
            <h1 className="mt-1 flex flex-wrap items-center gap-3 font-display text-3xl font-bold tracking-tight text-text-primary">
              {userName}
              <AdminRoleBadge role={adminRole} />
            </h1>
            <p className="mt-1 font-mono text-xs text-text-faint">{userEmail}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="live-dot" aria-hidden="true" />
            <span className="font-mono text-xs uppercase tracking-widest text-text-muted">
              DIU CyberCon 2026
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[230px_1fr]">
          {/* ── Desktop sidebar ───────────────────────────────────────────── */}
          <nav aria-label="Admin" className="hidden lg:block">
            <div className="sticky top-[calc(var(--navbar-height)+var(--announcement-height)+1.5rem)] space-y-5">
              {visibleGroups.map((group) => (
                <div key={group.label}>
                  <p className="mb-1.5 px-3 font-mono text-micro uppercase tracking-wider text-text-faint">
                    {group.label}
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const active = isActive(item)
                      const Icon = item.icon
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex items-center gap-2.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                              active
                                ? "border-cyan/30 bg-cyan/10 text-cyan"
                                : "border-transparent text-text-muted hover:border-border hover:bg-bg-elevated hover:text-text-primary",
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" aria-hidden={true} />
                            {item.label}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>

          {/* ── Mobile scroll strip ───────────────────────────────────────── */}
          <nav
            aria-label="Admin"
            className="-mx-4 overflow-x-auto px-4 pb-2 lg:hidden"
          >
            <ul className="flex w-max gap-1.5">
              {visibleGroups
                .flatMap((group) => group.items)
                .map((item) => {
                  const active = isActive(item)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                          active
                            ? "border-cyan/30 bg-cyan/10 text-cyan"
                            : "border-border bg-bg-panel text-text-muted hover:text-text-primary",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
            </ul>
          </nav>

          {/* ── Content ───────────────────────────────────────────────────── */}
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </section>
  )
}
