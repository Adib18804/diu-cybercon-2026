"use client"

import {
  Check,
  Pencil,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import toast from "react-hot-toast"

import { StatusBadge } from "./StatusBadge"

import {
  ParticipantFields,
  UploadField,
  emptyParticipantForm,
  type ParticipantFormValues,
  type StagedUpload,
  type UniversityOption,
} from "@/components/register"
import {
  Button,
  ConfirmModal,
  Input,
  Modal,
} from "@/components/ui"
import { FILE_UPLOAD } from "@/lib/constants"
import type { MyTeam, MyTeamMember } from "@/lib/dashboard/queries"
import { teamMemberSchema, teamNameSchema } from "@/lib/validations/registration"

// =============================================================================
// TeamPanel — one team card: roster, verification status, and the
// leader-only management actions (rename, add member, remove member).
// =============================================================================

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: string
  code?: string
  details?: Record<string, string[]>
  message?: string
}

export interface TeamPanelProps {
  team: MyTeam
  universities: UniversityOption[]
}

export function TeamPanel({ team, universities }: TeamPanelProps) {
  const router = useRouter()

  // ── Rename state ────────────────────────────────────────────────────────────
  const [renaming, setRenaming] = React.useState(false)
  const [nameDraft, setNameDraft] = React.useState(team.name)
  const [renameError, setRenameError] = React.useState<string | null>(null)
  const [renamingBusy, setRenamingBusy] = React.useState(false)

  // ── Add member state ────────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = React.useState(false)
  const [memberValues, setMemberValues] = React.useState<ParticipantFormValues>(
    emptyParticipantForm(),
  )
  const [memberEmail, setMemberEmail] = React.useState("")
  const [memberUpload, setMemberUpload] = React.useState<StagedUpload | null>(null)
  const [memberErrors, setMemberErrors] = React.useState<Record<string, string>>({})
  const [addingBusy, setAddingBusy] = React.useState(false)

  // ── Remove state ────────────────────────────────────────────────────────────
  const [removeTarget, setRemoveTarget] = React.useState<MyTeamMember | null>(null)
  const [removingBusy, setRemovingBusy] = React.useState(false)

  const atCapacity =
    team.maxTeamSize !== null && team.memberCount >= team.maxTeamSize
  const belowMinimum =
    team.minTeamSize !== null && team.memberCount < team.minTeamSize

  // ── Rename ──────────────────────────────────────────────────────────────────
  async function handleRename(): Promise<void> {
    if (renamingBusy) {return}

    const parsed = teamNameSchema.safeParse(nameDraft)
    if (!parsed.success) {
      setRenameError(parsed.error.issues[0]?.message ?? "Invalid team name")
      return
    }
    setRenameError(null)

    if (parsed.data === team.name) {
      setRenaming(false)
      return
    }

    setRenamingBusy(true)
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: parsed.data }),
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<{
        id: string
        name: string
      }> | null

      if (!res.ok || !json?.success) {
        const message =
          json?.error ??
          (res.status === 429
            ? "Too many attempts. Please wait a moment."
            : "Could not rename the team. Please try again.")
        if (json?.details?.name?.[0]) {
          setRenameError(json.details.name[0])
        }
        toast.error(message)
        return
      }

      toast.success("Team renamed.")
      setRenaming(false)
      router.refresh()
    } catch {
      toast.error("Could not rename the team. Check your connection.")
    } finally {
      setRenamingBusy(false)
    }
  }

  // ── Add member ──────────────────────────────────────────────────────────────
  function resetAddMember(): void {
    setMemberValues(emptyParticipantForm())
    setMemberEmail("")
    setMemberUpload(null)
    setMemberErrors({})
  }

  async function handleAddMember(): Promise<void> {
    if (addingBusy) {return}

    const payload = {
      ...memberValues,
      email: memberEmail,
      verification: {
        token: memberUpload?.token ?? "",
        fileName: memberUpload?.fileName ?? "",
      },
    }

    const parsed = teamMemberSchema.safeParse(payload)
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (typeof key === "string" && !next[key]) {
          next[key] = issue.message
        }
      }
      setMemberErrors(next)
      toast.error("Please fix the highlighted fields.")
      return
    }
    setMemberErrors({})

    setAddingBusy(true)
    try {
      const res = await fetch(`/api/teams/${team.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<{
        participantName: string
        teamSize: number
        emailSent: boolean
      }> | null

      if (!res.ok || !json?.success) {
        const message =
          json?.error ??
          (res.status === 429
            ? "Too many attempts. Please wait a moment."
            : "Could not add the member. Please try again.")

        if (json?.details) {
          const flat: Record<string, string> = {}
          for (const [key, messages] of Object.entries(json.details)) {
            if (messages[0]) {flat[key] = messages[0]}
          }
          setMemberErrors(flat)
          if (json.code === "UPLOAD_EXPIRED") {
            setMemberUpload(null)
          }
        }
        toast.error(message)
        return
      }

      toast.success(
        json.data
          ? `${json.data.participantName} added — team of ${json.data.teamSize}.`
          : "Team member added.",
      )
      setAddOpen(false)
      resetAddMember()
      router.refresh()
    } catch {
      toast.error("Could not add the member. Check your connection.")
    } finally {
      setAddingBusy(false)
    }
  }

  // ── Remove member ───────────────────────────────────────────────────────────
  async function handleRemoveMember(): Promise<void> {
    if (!removeTarget || removingBusy) {return}
    setRemovingBusy(true)
    try {
      const res = await fetch(
        `/api/teams/${team.id}/members/${removeTarget.id}`,
        { method: "DELETE" },
      )
      const json = (await res.json().catch(() => null)) as ApiEnvelope<unknown> | null

      if (!res.ok || !json?.success) {
        toast.error(
          json?.error ??
            (res.status === 429
              ? "Too many attempts. Please wait a moment."
              : "Could not remove the member. Please try again."),
        )
        return
      }

      toast.success(`${removeTarget.fullName} removed from the team.`)
      setRemoveTarget(null)
      router.refresh()
    } catch {
      toast.error("Could not remove the member. Check your connection.")
    } finally {
      setRemovingBusy(false)
    }
  }

  return (
    <div className="gradient-border overflow-hidden rounded-lg border border-border bg-bg-panel">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-bg-elevated/50 px-5 py-4">
        <p className="font-mono text-[0.6rem] uppercase tracking-widest text-text-faint">
          {team.eventName}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          {renaming ? (
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                error={renameError ?? undefined}
                inputSize="sm"
                aria-label="Team name"
                className="max-w-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="primary"
                loading={renamingBusy}
                onClick={() => { void handleRename() }}
                aria-label="Save team name"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRenaming(false)
                  setNameDraft(team.name)
                  setRenameError(null)
                }}
                aria-label="Cancel rename"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg font-bold text-text-primary">
                {team.name}
              </h3>
              {team.isLeader ? (
                <button
                  type="button"
                  onClick={() => {
                    setRenaming(true)
                    setNameDraft(team.name)
                  }}
                  className="rounded-md p-1.5 text-text-faint transition-colors hover:bg-cyan/10 hover:text-cyan"
                  aria-label="Rename team"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <span className="badge-cyan">
                {team.isLeader ? "You lead this team" : "You are a member"}
              </span>
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {team.memberCount}
            {team.maxTeamSize !== null ? ` / ${team.maxTeamSize}` : ""} members
          </span>
          {belowMinimum ? (
            <span className="text-amber">
              Need at least {team.minTeamSize} to compete
            </span>
          ) : null}
          {atCapacity ? <span className="text-text-faint">Team is full</span> : null}
        </div>
      </div>

      {/* ── Roster ─────────────────────────────────────────────────────────── */}
      <ul className="divide-y divide-border">
        {team.members.map((member) => (
          <li
            key={member.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-bg-elevated font-display text-sm font-semibold text-cyan">
              {member.fullName.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-text-primary">
                  {member.fullName}
                </p>
                {member.isLeader ? (
                  <span className="badge-violet">Leader</span>
                ) : null}
                {member.isSelf ? <span className="badge-muted">You</span> : null}
              </div>
              <p className="truncate text-xs text-text-faint">
                {member.email} · {member.department} · {member.universityName}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5" title="Student ID verification">
                <ShieldCheck className="h-3.5 w-3.5 text-text-faint" aria-hidden="true" />
                <StatusBadge status={member.verificationStatus} size="sm" />
              </span>

              {team.isLeader && !member.isLeader && !member.isSelf ? (
                <button
                  type="button"
                  onClick={() => setRemoveTarget(member)}
                  className="rounded-md p-1.5 text-text-faint transition-colors hover:bg-pink/10 hover:text-pink"
                  aria-label={`Remove ${member.fullName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {member.verificationStatus === "REVISION_REQUIRED" &&
            member.verificationNote ? (
              <p className="w-full rounded-md border border-violet/25 bg-violet/5 px-3 py-2 text-xs text-text-muted sm:ml-13">
                Verification note: {member.verificationNote}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {/* ── Leader actions ─────────────────────────────────────────────────── */}
      {team.isLeader ? (
        <div className="flex items-center justify-between border-t border-border bg-bg-elevated/30 px-5 py-3.5">
          <p className="text-xs text-text-faint">
            Member details can be updated from your Profile page after sign-in.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            leftIcon={<UserPlus className="h-4 w-4" />}
            disabled={atCapacity}
            onClick={() => setAddOpen(true)}
          >
            {atCapacity ? "Team Full" : "Add Member"}
          </Button>
        </div>
      ) : null}

      {/* ── Add member modal ───────────────────────────────────────────────── */}
      <Modal
        open={addOpen}
        onClose={() => {
          if (!addingBusy) {
            setAddOpen(false)
          }
        }}
        title={`Add member to "${team.name}"`}
        description="Their student ID is uploaded to private storage — only the verification team can view it."
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAddOpen(false)}
              disabled={addingBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={addingBusy}
              loadingText="Adding…"
              onClick={() => { void handleAddMember() }}
            >
              Add Member
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <ParticipantFields
            values={memberValues}
            onChange={(patch) =>
              setMemberValues((prev) => ({ ...prev, ...patch }))
            }
            errors={memberErrors}
            universities={universities}
            disabled={addingBusy}
          />

          <Input
            label="Email"
            type="email"
            placeholder="member@example.com"
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            error={memberErrors.email}
            helper="Their confirmation email and QR pass are sent here"
            disabled={addingBusy}
            required
          />

          <UploadField
            label="Student ID"
            value={memberUpload}
            onChange={setMemberUpload}
            error={memberErrors.verification}
            maxSizeBytes={FILE_UPLOAD.studentId.maxSizeBytes}
            disabled={addingBusy}
          />
        </div>
      </Modal>

      {/* ── Remove confirmation ────────────────────────────────────────────── */}
      <ConfirmModal
        open={removeTarget !== null}
        onClose={() => {
          if (!removingBusy) {
            setRemoveTarget(null)
          }
        }}
        onConfirm={() => { void handleRemoveMember() }}
        title="Remove team member?"
        description={
          removeTarget
            ? `${removeTarget.fullName} will be removed from "${team.name}". Their registration for this event is cancelled and their student ID upload is deleted. This cannot be undone.`
            : undefined
        }
        confirmLabel="Remove Member"
        variant="danger"
        loading={removingBusy}
      />
    </div>
  )
}
