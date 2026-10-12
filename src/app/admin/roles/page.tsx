"use client"

// =============================================================================
// Admin — Admin roles (/admin/roles)
// The admin access desk: every user with role ADMIN or STAFF. Grant admin
// access to a user by email, change an existing admin's role, or revoke
// access entirely. Every mutation is recorded in the audit log, and the
// server also blocks self-changes.
// =============================================================================

import { RefreshCw, ShieldCheck, UserPlus } from "lucide-react"
import * as React from "react"

import {
  AdminApiError,
  AdminFilterSelect,
  AdminRoleBadge,
  AdminSearchInput,
  DataTable,
  StatusPill,
  adminMutate,
  toastApiError,
  useAdminList,
  type Column,
} from "@/components/admin"
import { Button, ConfirmModal, Input, Modal, Select } from "@/components/ui"
import { cn, relativeTime } from "@/lib/utils"

type AdminUserRow = {
  id: string
  name: string | null
  email: string
  role: string
  adminRole: string | null
  isSuspended: boolean
  createdAt: string
}

const ADMIN_ROLE_OPTIONS = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "EVENT_ADMIN", label: "Event Admin" },
  { value: "REGISTRATION_ADMIN", label: "Registration Admin" },
  { value: "CONTENT_ADMIN", label: "Content Admin" },
  { value: "SPONSORSHIP_ADMIN", label: "Sponsorship Admin" },
  { value: "VERIFICATION_ADMIN", label: "Verification Admin" },
]

function displayName(user: AdminUserRow): string {
  return user.name ?? user.email
}

export default function AdminRolesPage() {
  const list = useAdminList<AdminUserRow>("/api/admin/roles", {
    initialFilters: { adminRole: "" },
  })

  // ── Current session user (self marker + client-side self-guard hint) ──────
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const controller = new AbortController()
    fetch("/api/auth/session", { signal: controller.signal, cache: "no-store" })
      .then((res) =>
        res.ok ? (res.json() as Promise<{ user?: { id?: string } }>) : null,
      )
      .then((data) => {
        const id = data?.user?.id
        if (typeof id === "string" && id.length > 0) {
          setCurrentUserId(id)
        }
      })
      .catch(() => {
        // Best effort only — the server also blocks self-mutations.
      })
    return () => controller.abort()
  }, [])

  // ── Grant modal state ──────────────────────────────────────────────────────
  const [grantOpen, setGrantOpen] = React.useState(false)
  const [grantEmail, setGrantEmail] = React.useState("")
  const [grantRole, setGrantRole] = React.useState("")
  const [granting, setGranting] = React.useState(false)
  const [grantErrors, setGrantErrors] = React.useState<Record<string, string[]>>({})

  const openGrant = () => {
    setGrantEmail("")
    setGrantRole("")
    setGrantErrors({})
    setGrantOpen(true)
  }

  const grantAccess = async () => {
    const email = grantEmail.trim()
    if (!email || !grantRole) {
      setGrantErrors({
        ...(email ? {} : { email: ["Enter the user's email address."] }),
        ...(grantRole ? {} : { adminRole: ["Choose an admin role."] }),
      })
      return
    }
    setGranting(true)
    try {
      await adminMutate<AdminUserRow>(
        "/api/admin/roles",
        "POST",
        { email, adminRole: grantRole },
        { successMessage: "Admin role assigned." },
      )
      setGrantOpen(false)
      list.refresh()
    } catch (err) {
      setGrantErrors(
        err instanceof AdminApiError && err.details ? err.details : {},
      )
      toastApiError(err, "Could not grant the admin role.")
    } finally {
      setGranting(false)
    }
  }

  // ── Manage modal state ─────────────────────────────────────────────────────
  const [selected, setSelected] = React.useState<AdminUserRow | null>(null)
  const [manageRole, setManageRole] = React.useState("")
  const [updating, setUpdating] = React.useState(false)
  const [confirmRevoke, setConfirmRevoke] = React.useState(false)
  const [revoking, setRevoking] = React.useState(false)

  const openManage = (item: AdminUserRow) => {
    setSelected(item)
    setManageRole(item.adminRole ?? "")
  }

  const closeManage = () => {
    if (updating || revoking) {return}
    setSelected(null)
    setConfirmRevoke(false)
  }

  const saveRole = async () => {
    if (!selected || !manageRole || manageRole === selected.adminRole) {return}
    setUpdating(true)
    try {
      const updated = await adminMutate<AdminUserRow>(
        `/api/admin/roles/${selected.id}`,
        "PATCH",
        { adminRole: manageRole },
        { successMessage: "Admin role updated." },
      )
      setSelected(updated)
      list.refresh()
    } catch (err) {
      toastApiError(err, "Could not update the admin role.")
    } finally {
      setUpdating(false)
    }
  }

  const revokeAccess = async () => {
    if (!selected) {return}
    setRevoking(true)
    try {
      await adminMutate<AdminUserRow>(
        `/api/admin/roles/${selected.id}`,
        "DELETE",
        undefined,
        { successMessage: "Admin access revoked." },
      )
      setConfirmRevoke(false)
      setSelected(null)
      list.refresh()
    } catch (err) {
      toastApiError(err, "Could not revoke admin access.")
    } finally {
      setRevoking(false)
    }
  }

  const columns: Column<AdminUserRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (item) => (
        <p className="truncate font-medium text-text-primary">
          {displayName(item)}
          {item.id === currentUserId && (
            <span className="text-cyan"> (you)</span>
          )}
        </p>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (item) => (
        <span className="truncate font-mono text-xs text-text-muted">
          {item.email}
        </span>
      ),
    },
    {
      key: "adminRole",
      header: "Admin role",
      render: (item) =>
        item.adminRole ? (
          <AdminRoleBadge role={item.adminRole} />
        ) : (
          <span className="text-xs text-text-faint">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      desktopOnly: true,
      render: (item) => (
        <StatusPill status={item.isSuspended ? "SUSPENDED" : "ACTIVE"} />
      ),
    },
    {
      key: "since",
      header: "Since",
      desktopOnly: true,
      render: (item) => (
        <span className="whitespace-nowrap text-xs text-text-muted">
          {relativeTime(item.createdAt)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet/30 bg-violet/5 text-violet">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
              Admin roles
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Grant admin access to staff accounts by email, adjust an admin's
            role, or revoke access. Every change is recorded in the audit log.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={list.refresh}
            disabled={list.loading}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-bg-elevated px-3 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", list.loading && "animate-spin")}
              aria-hidden="true"
            />
            Refresh
          </button>
          <Button
            size="sm"
            className="h-9"
            onClick={openGrant}
            leftIcon={<UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Grant admin access
          </Button>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        items={list.items}
        rowKey={(item) => item.id}
        loading={list.loading}
        error={list.error}
        onRetry={list.refresh}
        emptyTitle="No admin users found"
        emptyDescription="Grant admin access to a user by email to add them here, or adjust the filters."
        pagination={list.pagination}
        onPageChange={list.setPage}
        onRowClick={openManage}
        toolbar={
          <>
            <AdminSearchInput
              value={list.query}
              onChange={list.setQuery}
              placeholder="Search by name or email…"
            />
            <AdminFilterSelect
              value={list.filters.adminRole ?? ""}
              onChange={(value) => list.setFilter("adminRole", value)}
              options={ADMIN_ROLE_OPTIONS}
              allLabel="All admin roles"
              ariaLabel="Filter by admin role"
            />
          </>
        }
      />

      {/* ── Grant admin access ─────────────────────────────────────────────── */}
      <Modal
        open={grantOpen}
        onClose={() => {
          if (!granting) {setGrantOpen(false)}
        }}
        title="Grant admin access"
        description="Assign an admin role to an existing user by email."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setGrantOpen(false)}
              disabled={granting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void grantAccess()}
              loading={granting}
              loadingText="Granting…"
              leftIcon={<UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Grant access
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Email address"
            type="email"
            placeholder="name@diu.edu.bd"
            value={grantEmail}
            onChange={(event) => setGrantEmail(event.target.value)}
            error={grantErrors.email?.[0]}
            helper="The user must already have a CyberCon account."
          />
          <Select
            label="Admin role"
            value={grantRole}
            onChange={(event) => setGrantRole(event.target.value)}
            placeholder="Choose an admin role"
            options={ADMIN_ROLE_OPTIONS}
            error={grantErrors.adminRole?.[0]}
          />
        </div>
      </Modal>

      {/* ── Manage admin access ────────────────────────────────────────────── */}
      <Modal
        open={selected !== null}
        onClose={closeManage}
        title="Manage admin access"
        description="Role changes are recorded in the audit log."
        size="md"
      >
        {selected && (
          <div className="space-y-5">
            {/* Identity */}
            <div className="rounded-md border border-border bg-bg-elevated/50 px-4 py-3">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-primary">
                {displayName(selected)}
                {selected.id === currentUserId && (
                  <span className="text-cyan">(you)</span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">{selected.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {selected.adminRole ? (
                  <AdminRoleBadge role={selected.adminRole} />
                ) : (
                  <span className="text-xs text-text-faint">No admin role</span>
                )}
                <StatusPill
                  status={selected.isSuspended ? "SUSPENDED" : "ACTIVE"}
                />
                <span className="text-xs text-text-muted">
                  Added {relativeTime(selected.createdAt)}
                </span>
              </div>
            </div>

            {selected.id === currentUserId && (
              <p className="rounded-md border border-amber/30 bg-amber/5 px-4 py-3 text-xs leading-relaxed text-amber">
                This is your own account. Ask another super admin to change or
                revoke your admin role.
              </p>
            )}

            {/* Change role */}
            <div className="space-y-3">
              <Select
                label="Admin role"
                value={manageRole}
                onChange={(event) => setManageRole(event.target.value)}
                placeholder="Choose an admin role"
                options={ADMIN_ROLE_OPTIONS}
                disabled={selected.id === currentUserId}
              />
              <Button
                size="sm"
                onClick={() => void saveRole()}
                loading={updating}
                loadingText="Saving…"
                disabled={
                  !manageRole ||
                  manageRole === selected.adminRole ||
                  selected.id === currentUserId ||
                  updating
                }
              >
                Save role
              </Button>
            </div>

            {/* Danger zone */}
            <div className="rounded-md border border-pink/30 bg-pink/5 px-4 py-3">
              <p className="text-sm font-medium text-text-primary">
                Revoke admin access
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                The user loses admin access immediately. Their participant
                account is not affected.
              </p>
              <Button
                variant="danger"
                size="sm"
                className="mt-3"
                onClick={() => setConfirmRevoke(true)}
                disabled={selected.id === currentUserId}
              >
                Revoke admin access
              </Button>
              {selected.id === currentUserId && (
                <p className="mt-2 text-[0.6875rem] text-text-faint">
                  You cannot revoke your own admin access.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Revoke confirmation ────────────────────────────────────────────── */}
      <ConfirmModal
        open={confirmRevoke}
        onClose={() => {
          if (!revoking) {setConfirmRevoke(false)}
        }}
        onConfirm={() => void revokeAccess()}
        title="Revoke admin access?"
        description={
          selected
            ? `${displayName(selected)} will lose admin access immediately. Their participant account is not affected.`
            : undefined
        }
        confirmLabel="Revoke access"
        cancelLabel="Go back"
        variant="danger"
        loading={revoking}
      />
    </div>
  )
}
