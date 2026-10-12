"use client"

import {
  FileCheck2,
  FolderKanban,
  LayoutDashboard,
  QrCode,
  Ticket,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// DashboardShell — responsive participant dashboard frame:
// identity header + section navigation (sidebar on desktop, tab strip on
// mobile) + content area.
// =============================================================================

interface NavItem {
  href: Route
  label: string
  icon: LucideIcon
  exact?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/events", label: "My Events", icon: Ticket },
  { href: "/dashboard/team", label: "My Team", icon: Users },
  { href: "/dashboard/submissions", label: "Submissions", icon: FolderKanban },
  { href: "/dashboard/workshops", label: "Workshops", icon: Wrench },
  { href: "/dashboard/documents", label: "Documents", icon: FileCheck2 },
  { href: "/dashboard/qr", label: "QR Pass", icon: QrCode },
  { href: "/dashboard/profile", label: "Profile", icon: UserCog },
]

export interface DashboardShellProps {
  userName: string
  userEmail: string
  children: React.ReactNode
}

export function DashboardShell({
  userName,
  userEmail,
  children,
}: DashboardShellProps) {
  const pathname = usePathname()

  const isActive = React.useCallback(
    (item: NavItem) =>
      item.exact ? pathname === item.href : pathname.startsWith(item.href),
    [pathname],
  )

  return (
    <section className="section">
      <div className="section-inner">
        {/* ── Identity header ─────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-label">Participant Dashboard</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-text-primary">
              {userName}
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

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
          {/* ── Navigation ────────────────────────────────────────────────── */}
          {/* Desktop sidebar */}
          <nav aria-label="Dashboard" className="hidden lg:block">
            <ul className="sticky top-[calc(var(--navbar-height)+var(--announcement-height)+1.5rem)] space-y-1">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item)
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
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
          </nav>

          {/* Mobile tab strip */}
          <nav
            aria-label="Dashboard"
            className="-mx-4 overflow-x-auto px-4 pb-2 lg:hidden"
          >
            <ul className="flex w-max gap-1.5">
              {NAV_ITEMS.map((item) => {
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
