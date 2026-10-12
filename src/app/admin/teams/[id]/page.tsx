"use client"

// =============================================================================
// Admin — Team detail (/admin/teams/[id])
// Team overview (event, leader, member and registration counts), a rename
// card, the member roster with student-ID verification status, and the danger
// zone (soft delete — blocked while the team still has registrations).
// Every write is validated and audited server-side.
// =============================================================================

import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Clock,
  Loader2,
  Save,
  ShieldAlert,
  Trash2,
  User,
  Users,
  UsersRound,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import toast from "react-hot-toast"

import {
  AdminApiError,
  adminFetch,
  adminMutate,
  DataTable,
  StatusPill,
  toastApiError,
  type Column,
} from "@/components/admin"
import { Button, ConfirmModal, Input } from "@/components/ui"
import { cn, formatDate } from "@/lib/utils"

// ─── Types (mirror GET /api/admin/teams/[id]) ────────────────────────────────

type TeamMemberRow = {
  id: string
  teamId: string
  profileId: string
  isLeader: boolean
  joinedAt: string
  profile: {
    fullName: string
    studentId: string
    department: string
    phone: string
    university: { name: string; shortName: string | null }
  }
  verification: { status: string } | null
}

type TeamDetail = {
  team: {
    id: string
    name: string
    createdAt: string
    updatedAt: string
    event: { id: string; name: string; type: string }
    leader: { id: string; name: string | null; email: string } | null
  }
  members: TeamMemberRow[]
  registrationCount: number
}

type RenameResult = { id: string; name: string; updatedAt: string }

const EVENT_TYPE_LABELS: Record<string, string> = {
  CTF: "CTF",
  TRACE_ROUTE: "Trace & Route",
  PROJECT_SHOWCASE: "Project Showcase",
  POSTER_PRESENTATION: "Poster Presentation",
  PANEL_DISCUSSION: "Panel Discussion",
  HANDS_ON: "Hands-on Activities",
}

// ─── Local building blocks ────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-bg-panel p-5", className)}>
      <div className="mb-4">
        <h2 className="font-mono text-micro uppercase tracking-wider text-text-muted">
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-faint" />
      <div className="min-w-0">
        <p className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
          {label}
        </p>
        <p className="mt-0.5 break-words text-sm text-text-primary">{value}</p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminTeamDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const router = useRouter()

  const [data, setData] = React.useState<TeamDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [notFound, setNotFound] = React.useState(false)

  // ── Rename state ───────────────────────────────────────────────────────────
  const [nameInput, setNameInput] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  // ── Delete state ───────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const payload = await adminFetch<TeamDetail>(`/api/admin/teams/${id}`)
      setData(payload)
      setNameInput(payload.team.name)
      setLoadError(null)
      setNotFound(false)
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 404) {
        setNotFound(true)
      } else {
        setLoadError(
          err instanceof Error ? err.message : "Failed to load this team.",
        )
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    void load()
  }, [load])

  const dirty = data !== null && nameInput.trim() !== data.team.name

  // ── Rename ─────────────────────────────────────────────────────────────────
  const handleRename = React.useCallback(async () => {
    if (!data) {return}
    const name = nameInput.trim()
    if (name.length < 3 || name.length > 60) {
      toast.error("Team name must be between 3 and 60 characters.")
      return
    }
    if (name === data.team.name) {return}

    setSaving(true)
    try {
      const updated = await adminMutate<RenameResult>(
        `/api/admin/teams/${id}`,
        "PATCH",
        { name },
      )
      setData((prev) =>
        prev
          ? {
              ...prev,
              team: {
                ...prev.team,
                name: updated.name,
                updatedAt: updated.updatedAt,
              },
            }
          : prev,
      )
      setNameInput(updated.name)
      toast.success("Team renamed.")
    } catch (err) {
      toastApiError(err, "Could not rename this team.")
    } finally {
      setSaving(false)
    }
  }, [data, nameInput, id])

  // ── Delete (soft) ──────────────────────────────────────────────────────────
  const handleDelete = React.useCallback(async () => {
    setDeleting(true)
    try {
      await adminMutate(`/api/admin/teams/${id}`, "DELETE", undefined, {
        successMessage: "Team deleted.",
      })
      router.push("/admin/teams")
    } catch (err) {
      toastApiError(err, "Could not delete this team.")
      setDeleting(false)
    }
  }, [id, router])

  // ── Loading / error / not-found states ─────────────────────────────────────
  if (notFound) {
    return (
      <div className="rounded-lg border border-border bg-bg-panel px-6 py-14 text-center">
        <UsersRound className="mx-auto mb-3 h-6 w-6 text-text-faint" aria-hidden="true" />
        <p className="text-sm font-medium text-text-primary">Team not found</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-text-muted">
          This team may have been deleted, or the link is no longer valid.
        </p>
        <Link
          href="/admin/teams"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to teams
        </Link>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-panel px-6 py-16 text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span className="text-sm">Loading team…</span>
      </div>
    )
  }

  if (loadError && !data) {
    return (
      <div className="rounded-lg border border-pink/30 bg-pink/5 px-6 py-14 text-center">
        <ShieldAlert className="mx-auto mb-3 h-6 w-6 text-pink" aria-hidden="true" />
        <p className="text-sm font-medium text-text-primary">
          Could not load this team
        </p>
        <p className="mx-auto mt-1 max-w-sm text-xs text-text-muted">{loadError}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-md border border-border bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:text-cyan"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!data) {return null}

  const { team, members, registrationCount } = data

  const memberColumns: Column<TeamMemberRow>[] = [
    {
      key: "member",
      header: "Member",
      render: (member) => (
        <p className="flex flex-wrap items-center gap-2 font-medium text-text-primary">
          <span className="truncate">{member.profile.fullName}</span>
          {member.isLeader && (
            <span className="shrink-0 rounded-full border border-cyan/30 bg-cyan/10 px-1.5 py-0.5 font-mono text-[0.5625rem] font-bold uppercase tracking-wider text-cyan">
              Leader
            </span>
          )}
        </p>
      ),
    },
    {
      key: "studentId",
      header: "Student ID",
      render: (member) => (
        <span className="font-mono text-xs text-text-primary">
          {member.profile.studentId}
        </span>
      ),
    },
    {
      key: "department",
      header: "Department",
      desktopOnly: true,
      render: (member) => (
        <span className="text-sm text-text-muted">{member.profile.department}</span>
      ),
    },
    {
      key: "university",
      header: "University",
      desktopOnly: true,
      render: (member) => (
        <span className="text-sm text-text-muted">
          {member.profile.university.shortName ?? member.profile.university.name}
        </span>
      ),
    },
    {
      key: "verification",
      header: "Verification",
      render: (member) => (
        <StatusPill status={member.verification?.status ?? "PENDING"} />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <Link
          href="/admin/teams"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted transition-colors hover:text-cyan"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to teams
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
            {team.name}
          </h1>
        </div>
        <p className="mt-1 text-sm text-text-muted">{team.event.name}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left column: rename + members ──────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Rename */}
          <SectionCard title="Rename team">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Input
                  id="team-name"
                  label="Team name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  maxLength={60}
                />
              </div>
              <Button
                variant="primary"
                size="md"
                loading={saving}
                disabled={!dirty || saving}
                leftIcon={<Save className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={() => void handleRename()}
                className="shrink-0"
              >
                Save
              </Button>
            </div>
            <p className="mt-2 text-[0.6875rem] leading-relaxed text-text-faint">
              3–60 characters, unique within the event. Renames are recorded in
              the audit log.
            </p>
          </SectionCard>

          {/* Members */}
          <SectionCard title={`Members (${members.length})`}>
            <DataTable
              columns={memberColumns}
              items={members}
              rowKey={(member) => member.id}
              emptyTitle="No members"
              emptyDescription="Members appear here once the team leader adds them."
            />
          </SectionCard>
        </div>

        {/* ── Right column: details + danger zone ────────────────────────── */}
        <div className="space-y-6">
          {/* Details */}
          <SectionCard title="Details">
            <div className="space-y-4">
              <InfoRow
                icon={CalendarDays}
                label="Event"
                value={
                  <>
                    {team.event.name}
                    <span className="ml-2 font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                      {EVENT_TYPE_LABELS[team.event.type] ?? team.event.type}
                    </span>
                  </>
                }
              />
              <InfoRow icon={Clock} label="Created" value={formatDate(team.createdAt)} />
              <InfoRow
                icon={User}
                label="Leader"
                value={
                  team.leader ? (
                    <>
                      {team.leader.name ?? "Unnamed"}
                      <span className="mt-0.5 block text-xs text-text-muted">
                        {team.leader.email}
                      </span>
                    </>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow
                icon={Users}
                label="Members"
                value={`${members.length} member${members.length === 1 ? "" : "s"}`}
              />
              <InfoRow
                icon={ClipboardList}
                label="Registrations"
                value={`${registrationCount} registration${
                  registrationCount === 1 ? "" : "s"
                }`}
              />
            </div>
          </SectionCard>

          {/* Danger zone */}
          <section className="rounded-lg border border-pink/30 bg-pink/5 p-5">
            <h2 className="mb-4 font-mono text-micro uppercase tracking-wider text-text-muted">
              Danger zone
            </h2>
            <p className="text-xs leading-relaxed text-text-muted">
              Deleting a team removes it from every team list. Teams with
              registrations cannot be deleted.
            </p>
            <div className="mt-4">
              <Button
                variant="danger"
                size="md"
                disabled={registrationCount > 0 || deleting}
                leftIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                onClick={() => setConfirmDelete(true)}
              >
                Delete team
              </Button>
            </div>
            {registrationCount > 0 && (
              <p className="mt-2 text-[0.6875rem] leading-relaxed text-amber">
                This team has registrations and cannot be deleted.
              </p>
            )}
            <p className="mt-3 text-[0.6875rem] leading-relaxed text-text-faint">
              Deletion is recorded in the audit log with your identity and IP.
            </p>
          </section>
        </div>
      </div>

      {/* ── Delete confirmation ────────────────────────────────────────────── */}
      <ConfirmModal
        open={confirmDelete}
        onClose={() => {
          if (!deleting) {setConfirmDelete(false)}
        }}
        onConfirm={() => void handleDelete()}
        title="Delete this team?"
        description={`"${team.name}" will be removed from every team list. This action is recorded in the audit log.`}
        confirmLabel="Delete team"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
