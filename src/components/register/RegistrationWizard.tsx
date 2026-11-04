"use client"

import { motion } from "framer-motion"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Copy,
  LayoutDashboard,
  Lightbulb,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import toast from "react-hot-toast"

import { ParticipantFields } from "./ParticipantFields"
import { BkashPaymentForm } from "./BkashPaymentForm"
import {
  emptyParticipantForm,
  UNIVERSITY_OTHER,
  type MemberFormValues,
  type ParticipantFormValues,
  type RegisteredEntry,
  type RegistrationOutcome,
  type StagedUpload,
  type UniversityOption,
  type Viewer,
  type WizardEvent,
  type WizardWorkshop,
} from "./types"
import { UploadField } from "./UploadField"

import { eventBadgeType } from "@/components/events/helpers"
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  EventTypeBadge,
  Input,
  MiniStepBar,
  Select,
  StepIndicator,
  Textarea,
  type Step,
} from "@/components/ui"
import { FILE_UPLOAD } from "@/lib/constants"
import { formatBytes, titleCase } from "@/lib/utils"
import {
  participantProfileSchema,
  INNOVATION_SYMPOSIUM_DOMAINS,
  symposiumDomainSchema,
  symposiumIdeaSummarySchema,
  teamMemberSchema,
  teamNameSchema,
} from "@/lib/validations/registration"


// =============================================================================
// RegistrationWizard — the full event/workshop registration flow.
//
// Steps are shaped by the selection:
//   Solo:    event → participant → upload → review → terms
//   Team:    event → participant → upload → team → members → review → terms
//   Workshop: event → participant → upload → review → terms
// The API re-validates every rule server-side; this client flow only mirrors
// them for a good experience.
// =============================================================================

export interface RegistrationWizardProps {
  events: WizardEvent[]
  workshops: WizardWorkshop[]
  universities: UniversityOption[]
  viewer: Viewer
  bkashNumber: string
}

// ─── Steps ────────────────────────────────────────────────────────────────────

type StepId = "event" | "symposium" | "participant" | "upload" | "team" | "members" | "review" | "terms"

const STEP_META: Record<StepId, { label: string; description: string }> = {
  event:       { label: "Choose Event",  description: "Pick a module or hands-on activity" },
  symposium:   { label: "Symposium Idea", description: "Choose a domain and summarize your idea" },
  participant: { label: "Your Details",  description: "Tell us who is registering" },
  upload:      { label: "ID Upload",     description: "Verify your student identity" },
  team:        { label: "Team Setup",    description: "Name your team" },
  members:     { label: "Team Members",  description: "Add your teammates" },
  review:      { label: "Review",        description: "Double-check everything" },
  terms:       { label: "Submit",        description: "Accept the rules and confirm" },
}

type Mode = "event" | "workshop"

interface MemberDraft {
  key: string
  values: MemberFormValues
  upload: StagedUpload | null
}

function maxTeamSizeForEvent(event: WizardEvent): number {
  if (event.type === "INNOVATION_SYMPOSIUM") {return 3}
  if (event.type === "CTF") {return 4}
  return event.maxTeamSize
}

const CTF_GIVEAWAYS = ["Tote bag", "ID card", "T-shirt", "stickers", "pen", "pad", "key ring", "lunch"]
const SYMPOSIUM_WORKSHOP_GIVEAWAYS = ["T-shirt", "lunch", "Pad", "Pen", "ID"]

function eventRegistrationRule(event: WizardEvent): string {
  const venue = event.venue ?? "To be announced"
  const fee = Number(event.registrationFee).toLocaleString("en-US")
  switch (event.type) {
    case "CTF": return `CTF Final: ${fee} BDT per team (4 members). Venue: ${venue}. Preliminary is free.`
    case "INNOVATION_SYMPOSIUM": return `Innovation Symposium: ${fee} BDT per person (Max 3 members). Venue: ${venue}.`
    case "PANEL_DISCUSSION": return `Panel Discussion: Free entry. Venue: ${venue}.`
    case "HANDS_ON": return `Workshop: ${fee} BDT per person. Venue: ${venue}.`
    default: return event.rules ?? "See event details for fees and venue."
  }
}

function eventGiveaways(event: WizardEvent): string[] {
  if (event.type === "CTF") {return CTF_GIVEAWAYS}
  if (event.type === "INNOVATION_SYMPOSIUM") {return SYMPOSIUM_WORKSHOP_GIVEAWAYS}
  if (event.type === "HANDS_ON") {return SYMPOSIUM_WORKSHOP_GIVEAWAYS}
  return event.prizes?.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) ?? []
}

function newMemberDraft(): MemberDraft {
  return {
    key: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `m-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    values: { ...emptyParticipantForm(), email: "" },
    upload: null,
  }
}

// ─── API envelope types ──────────────────────────────────────────────────────

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: string
  code?: string
  details?: Record<string, string[]>
  message?: string
}

interface EventSubmitData {
  eventId: string
  eventName: string
  eventType: string
  teamName: string | null
  emailSent: boolean
  registrations: RegisteredEntry[]
}

interface WorkshopSubmitData {
  workshopId: string
  workshopTitle: string
  seatsRemaining: number
  emailSent: boolean
}

interface ValidationResult {
  ok: boolean
  errors: Record<string, string>
  message?: string
}

const OK: ValidationResult = { ok: true, errors: {} }

// ─── Payload helpers ─────────────────────────────────────────────────────────

function profileCandidate(values: ParticipantFormValues) {
  const base = {
    fullName: values.fullName,
    studentId: values.studentId,
    department: values.department,
    phone: values.phone,
    tshirtSize: values.tshirtSize || undefined,
  }
  if (values.universityId === UNIVERSITY_OTHER) {
    return { ...base, universityName: values.universityName }
  }
  if (values.universityId) {
    return { ...base, universityId: values.universityId }
  }
  return base
}

/** Field errors for a nested prefix, stripped to bare field names. */
function bareErrors(
  errors: Record<string, string>,
  prefix: string,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(errors)) {
    if (key.startsWith(`${prefix}.`)) {
      const bare = key.slice(prefix.length + 1)
      if (!bare.includes(".") && !(bare in out)) {
        out[bare] = value
      }
    }
  }
  return out
}

/** Remove every error key that belongs to a step (before re-validating it). */
function clearStepErrorKeys(
  errors: Record<string, string>,
  stepId: StepId,
): Record<string, string> {
  const prefixes: Record<StepId, string[]> = {
    event: [],
    participant: ["participant."],
    upload: ["participant.verification"],
    team: ["team.name"],
    members: ["team.members."],
    symposium: ["domain", "ideaSummary"],
    review: [],
    terms: [],
  }
  const drop = prefixes[stepId]
  if (drop.length === 0) {
    return errors
  }
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(errors)) {
    if (!drop.some((prefix) => key.startsWith(prefix))) {
      out[key] = value
    }
  }
  return out
}

// ─── EventCard — module-level component (stable identity, no hydration mismatch) ──

interface EventCardProps {
  event: WizardEvent
  isSelected: boolean
  onSelect: (event: WizardEvent) => void
}

function EventCard({ event, isSelected, onSelect }: EventCardProps) {
  const isFull =
    event.participantLimit !== null && event.registeredCount >= event.participantLimit
  const disabled = !event.isOpen || event.alreadyRegistered || isFull
  const spotsLeft =
    event.participantLimit !== null
      ? Math.max(0, event.participantLimit - event.registeredCount)
      : null

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!disabled && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault()
      onSelect(event)
    }
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={isSelected}
      aria-disabled={disabled}
      onClick={disabled ? undefined : () => onSelect(event)}
      onKeyDown={handleKeyDown}
      className={[
        "group relative rounded-lg border p-5 text-left transition-all duration-250",
        "[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
        isSelected
          ? "border-cyan bg-cyan/5 shadow-glow-cyan-sm"
          : disabled
            ? "cursor-not-allowed border-border bg-bg-panel opacity-60"
            : "cursor-pointer border-border bg-bg-panel hover:-translate-y-0.5 hover:border-cyan/40 hover:shadow-glow-cyan-sm",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-text-primary">
          {event.name}
        </p>
        <EventTypeBadge
          type={eventBadgeType(event.type, event.isTeamEvent)}
        />
      </div>

      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-muted">
        {event.shortDescription}
      </p>

      <p className="mt-3 text-xs font-medium leading-relaxed text-text-primary">
        {eventRegistrationRule(event)}
      </p>
      {eventGiveaways(event).length > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-text-muted">
          Giveaways: {eventGiveaways(event).join(", ")}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[0.625rem] uppercase tracking-wider">
        {event.isTeamEvent && (
          <span className="text-text-faint">
            Team {event.minTeamSize}–{maxTeamSizeForEvent(event)}
          </span>
        )}
        {spotsLeft !== null && (
          <span className={spotsLeft <= 5 ? "text-amber" : "text-text-faint"}>
            {spotsLeft} spots left
          </span>
        )}
        {event.deadlineLabel && (
          <span className="text-text-faint">
            Deadline {event.deadlineLabel}
          </span>
        )}
      </div>

      {/* Status line */}
      <div className="mt-3">
        {event.alreadyRegistered ? (
          <Badge variant="neon" size="sm">
            Already Registered
          </Badge>
        ) : isFull ? (
          <Badge variant="pink" size="sm">
            Event Full
          </Badge>
        ) : event.isOpen ? (
          <Badge variant="cyan" size="sm" dot>
            Registration Open
          </Badge>
        ) : (
          <Badge variant="muted" size="sm">
            Registration Closed
          </Badge>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// RegistrationWizard
// =============================================================================

export function RegistrationWizard({
  events,
  workshops,
  universities,
  viewer,
  bkashNumber,
}: RegistrationWizardProps) {
  const router = useRouter()
  const wizardRef = React.useRef<HTMLDivElement>(null)

  // ── Selection ──────────────────────────────────────────────────────────────
  const [mode, setMode] = React.useState<Mode | null>(null)
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null)
  const [selectedWorkshopId, setSelectedWorkshopId] = React.useState<string | null>(null)

  // ── Form state ─────────────────────────────────────────────────────────────
  const [stepIndex, setStepIndex] = React.useState(0)
  const [participant, setParticipant] = React.useState<ParticipantFormValues>(() => {
    const base = emptyParticipantForm()
    if (viewer.profile) {
      return {
        ...base,
        fullName: viewer.profile.fullName,
        studentId: viewer.profile.studentId,
        department: viewer.profile.department,
        phone: viewer.profile.phone,
        tshirtSize: viewer.profile.tshirtSize,
        universityId: viewer.profile.universityId,
      }
    }
    return { ...base, fullName: viewer.name ?? "" }
  })
  const [participantUpload, setParticipantUpload] = React.useState<StagedUpload | null>(null)
  const [teamName, setTeamName] = React.useState("")
  const [symposiumDomain, setSymposiumDomain] = React.useState("")
  const [ideaSummary, setIdeaSummary] = React.useState("")
  const [members, setMembers] = React.useState<MemberDraft[]>([])
  const [acceptTerms, setAcceptTerms] = React.useState(false)

  // ── Feedback ───────────────────────────────────────────────────────────────
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  const [stepError, setStepError] = React.useState<string | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [outcome, setOutcome] = React.useState<RegistrationOutcome | null>(null)

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedEvent = React.useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  )
  const selectedWorkshop = React.useMemo(
    () => workshops.find((w) => w.id === selectedWorkshopId) ?? null,
    [workshops, selectedWorkshopId],
  )

  const stepIds: StepId[] = React.useMemo(() => {
    if (mode === "workshop") {
      return ["event", "participant", "upload", "review", "terms"]
    }
    if (mode === "event" && selectedEvent?.isTeamEvent) {
      return [
        "event",
        ...(selectedEvent.type === "INNOVATION_SYMPOSIUM" ? ["symposium" as const] : []),
        "participant",
        "upload",
        "team",
        "members",
        "review",
        "terms",
      ]
    }
    if (mode === "event") {
      return [
        "event",
        ...(selectedEvent?.type === "INNOVATION_SYMPOSIUM" ? ["symposium" as const] : []),
        "participant",
        "upload",
        "review",
        "terms",
      ]
    }
    return ["event"]
  }, [mode, selectedEvent])

  const currentStepId: StepId = stepIds[Math.min(stepIndex, stepIds.length - 1)] ?? "event"

  // Clamp the step index when the step list shrinks after a selection change.
  React.useEffect(() => {
    if (stepIndex > stepIds.length - 1) {
      setStepIndex(stepIds.length - 1)
    }
  }, [stepIds.length, stepIndex])

  // Scroll the wizard into view on every step change.
  React.useEffect(() => {
    wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [stepIndex])

  const indicatorSteps: Step[] = stepIds.map((id, index) => ({
    id,
    label: STEP_META[id].label,
    description: STEP_META[id].description,
    status:
      index === stepIndex && stepError
        ? "error"
        : index < stepIndex
          ? "complete"
          : index === stepIndex
            ? "current"
            : "upcoming",
  }))

  // ── Selection handlers ─────────────────────────────────────────────────────

  function handleSelectEvent(event: WizardEvent): void {
    if (!event.isOpen || event.alreadyRegistered) {
      return
    }
    if (event.participantLimit !== null && event.registeredCount >= event.participantLimit) {
      return
    }
    setMode("event")
    setSelectedEventId(event.id)
    setSelectedWorkshopId(null)
    if (event.isTeamEvent) {
      const slots = Math.max(0, event.minTeamSize - 1)
      setMembers(Array.from({ length: slots }, () => newMemberDraft()))
    } else {
      setMembers([])
    }
    setFieldErrors((prev) => clearStepErrorKeys(prev, "event"))
    setStepError(null)
    setFormError(null)
  }

  function handleSelectWorkshop(workshop: WizardWorkshop): void {
    if (workshop.alreadyRegistered || workshop.seatsLeft <= 0) {
      return
    }
    setMode("workshop")
    setSelectedWorkshopId(workshop.id)
    setSelectedEventId(null)
    setMembers([])
    setFieldErrors((prev) => clearStepErrorKeys(prev, "event"))
    setStepError(null)
    setFormError(null)
  }

  // ── Field handlers (clear field errors as the user types) ─────────────────

  function updateParticipant(patch: Partial<ParticipantFormValues>): void {
    setParticipant((prev) => ({ ...prev, ...patch }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(patch)) {
        delete next[`participant.${key}`]
      }
      return next
    })
  }

  function updateMember(index: number, patch: Partial<MemberFormValues>): void {
    setMembers((prev) =>
      prev.map((member, i) =>
        i === index ? { ...member, values: { ...member.values, ...patch } } : member,
      ),
    )
    setFieldErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(patch)) {
        delete next[`team.members.${index}.${key}`]
      }
      return next
    })
  }

  function updateMemberUpload(index: number, upload: StagedUpload | null): void {
    setMembers((prev) =>
      prev.map((member, i) => (i === index ? { ...member, upload } : member)),
    )
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[`team.members.${index}.verification`]
      return next
    })
  }

  function addMember(): void {
    if (!selectedEvent) {
      return
    }
    if (members.length >= maxTeamSizeForEvent(selectedEvent) - 1) {
      return
    }
    setMembers((prev) => [...prev, newMemberDraft()])
  }

  function removeMember(index: number): void {
    setMembers((prev) => prev.filter((_, i) => i !== index))
    setFieldErrors((prev) => {
      const out: Record<string, string> = {}
      for (const [key, value] of Object.entries(prev)) {
        const match = /^team\.members\.(\d+)\./.exec(key)
        if (!match) {
          out[key] = value
          continue
        }
        const memberIndex = Number(match[1])
        if (memberIndex < index) {
          out[key] = value
        } else if (memberIndex > index) {
          out[key.replace(/^team\.members\.\d+\./, `team.members.${memberIndex - 1}.`)] = value
        }
      }
      return out
    })
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  function validateStep(stepId: StepId): ValidationResult {
    const errors: Record<string, string> = {}

    if (stepId === "event") {
      if (mode === "event") {
        if (!selectedEvent) {
          return { ok: false, errors: {}, message: "Select an event to continue." }
        }
        if (!selectedEvent.isOpen) {
          return { ok: false, errors: {}, message: "Registration for this event is closed." }
        }
        if (selectedEvent.alreadyRegistered) {
          return { ok: false, errors: {}, message: "You are already registered for this event." }
        }
      } else if (mode === "workshop") {
        if (!selectedWorkshop) {
          return { ok: false, errors: {}, message: "Select a hands-on activity to continue." }
        }
      } else {
        return { ok: false, errors: {}, message: "Select an event to continue." }
      }
      return OK
    }

    if (stepId === "participant") {
      const parsed = participantProfileSchema.safeParse(profileCandidate(participant))
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const pathKey = issue.path[0] !== undefined ? String(issue.path[0]) : "form";
          const key = `participant.${pathKey}`;
          if (!(key in errors)) {
            errors[key] = issue.message
          }
        }
        return { ok: false, errors, message: "Please fix your details." }
      }
      return OK
    }

    if (stepId === "symposium") {
      const domain = symposiumDomainSchema.safeParse(symposiumDomain)
      if (!domain.success) {
        errors.domain = domain.error.issues[0]?.message ?? "Choose a symposium domain."
      }
      const summary = symposiumIdeaSummarySchema.safeParse(ideaSummary)
      if (!summary.success) {
        errors.ideaSummary = summary.error.issues[0]?.message ?? "Enter an idea summary."
      }
      return Object.keys(errors).length > 0
        ? { ok: false, errors, message: "Complete the Innovation Symposium details." }
        : OK
    }

    if (stepId === "upload") {
      if (!participantUpload) {
        return {
          ok: false,
          errors: { "participant.verification": "Upload your student ID to continue" },
          message: "Upload your student ID to continue.",
        }
      }
      return OK
    }

    if (stepId === "team") {
      const parsed = teamNameSchema.safeParse(teamName)
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "Enter a valid team name"
        return { ok: false, errors: { "team.name": message }, message }
      }
      return OK
    }

    if (stepId === "members") {
      if (!selectedEvent) {
        return { ok: false, errors: {}, message: "Select an event first." }
      }
      members.forEach((member, index) => {
        const parsed = teamMemberSchema.safeParse({
          ...profileCandidate(member.values),
          email: member.values.email,
          ...(member.upload
            ? { verification: { token: member.upload.token, fileName: member.upload.fileName } }
            : {}),
        })
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            const pathKey = issue.path[0] !== undefined ? String(issue.path[0]) : "form";
            const key = `team.members.${index}.${pathKey}`;
            if (!(key in errors)) {
              errors[key] = issue.message
            }
          }
        }
        if (!member.upload) {
          const key = `team.members.${index}.verification`
          if (!(key in errors)) {
            errors[key] = "Upload this member's student ID"
          }
        }
      })
      const total = 1 + members.length
      if (total < selectedEvent.minTeamSize) {
        return {
          ok: false,
          errors,
          message: `Teams need at least ${selectedEvent.minTeamSize} members including you.`,
        }
      }
      if (total > maxTeamSizeForEvent(selectedEvent)) {
        return {
          ok: false,
          errors,
          message: `Teams can have at most ${maxTeamSizeForEvent(selectedEvent)} members including you.`,
        }
      }
      if (Object.keys(errors).length > 0) {
        return { ok: false, errors, message: "Please fix the highlighted member details." }
      }
      return OK
    }

    if (stepId === "review") {
      return OK
    }

    // terms
    if (!acceptTerms) {
      return {
        ok: false,
        errors: {},
        message: "Accept the rules and terms to submit your registration.",
      }
    }
    return OK
  }

  /** Sweep every step and return the first failure (used on submit). */
  function findFirstInvalidStep(): { stepId: StepId; result: ValidationResult } | null {
    for (const stepId of stepIds) {
      const result = validateStep(stepId)
      if (!result.ok) {
        return { stepId, result }
      }
    }
    return null
  }

  function applyValidationFailure(stepId: StepId, result: ValidationResult): void {
    setFieldErrors((prev) => ({
      ...clearStepErrorKeys(prev, stepId),
      ...result.errors,
    }))
    setStepError(result.message ?? null)
    if (result.message) {
      toast.error(result.message)
    }
  }

  function goNext(): void {
    const result = validateStep(currentStepId)
    if (!result.ok) {
      applyValidationFailure(currentStepId, result)
      return
    }
    setFieldErrors((prev) => clearStepErrorKeys(prev, currentStepId))
    setStepError(null)
    setStepIndex((index) => Math.min(index + 1, stepIds.length - 1))
  }

  function goBack(): void {
    setStepError(null)
    setStepIndex((index) => Math.max(index - 1, 0))
  }

  /** Jump backwards to an earlier step (review "Edit" buttons). */
  function jumpTo(stepId: StepId): void {
    const index = stepIds.indexOf(stepId)
    if (index >= 0 && index <= stepIndex) {
      setStepError(null)
      setStepIndex(index)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  function buildEventPayload() {
    if (!selectedEvent || !participantUpload) {
      throw new Error("Incomplete registration state")
    }
    const verification = {
      token: participantUpload.token,
      fileName: participantUpload.fileName,
    }
    const payload: Record<string, unknown> = {
      eventId: selectedEvent.id,
      registrationPhase: "PRELIMINARY",
      participant: { ...profileCandidate(participant), verification },
      acceptTerms: true,
    }
    if (selectedEvent.type === "INNOVATION_SYMPOSIUM") {
      payload.domain = symposiumDomain
      payload.ideaSummary = ideaSummary
    }
    if (selectedEvent.isTeamEvent) {
      payload.team = {
        name: teamName.trim().replace(/\s+/g, " "),
        members: members.map((member) => {
          if (!member.upload) {
            throw new Error("Incomplete member upload state")
          }
          return {
            ...profileCandidate(member.values),
            email: member.values.email.toLowerCase().trim(),
            verification: {
              token: member.upload.token,
              fileName: member.upload.fileName,
            },
          }
        }),
      }
    }
    return payload
  }

  function buildWorkshopPayload() {
    if (!selectedWorkshop || !participantUpload) {
      throw new Error("Incomplete registration state")
    }
    return {
      workshopId: selectedWorkshop.id,
      participant: {
        ...profileCandidate(participant),
        verification: {
          token: participantUpload.token,
          fileName: participantUpload.fileName,
        },
      },
      acceptTerms: true,
    }
  }

  /** Handle UPLOAD_EXPIRED — clear exactly the uploads the server flagged. */
  function handleExpiredUploads(details: Record<string, string[]>): void {
    let participantCleared = false
    const memberIndexes = new Set<number>()

    for (const key of Object.keys(details)) {
      if (key.startsWith("participant")) {
        participantCleared = true
      }
      const match = /^team\.members\.(\d+)\./.exec(key)
      if (match?.[1] !== undefined) {
        memberIndexes.add(Number(match[1]))
      }
    }

    if (participantCleared) {
      setParticipantUpload(null)
    }
    if (memberIndexes.size > 0) {
      setMembers((prev) =>
        prev.map((member, index) =>
          memberIndexes.has(index) ? { ...member, upload: null } : member,
        ),
      )
      jumpTo("members")
    } else if (participantCleared) {
      jumpTo("upload")
    }
  }

  async function handleSubmit(): Promise<void> {
    if (submitting) {
      return
    }

    const invalid = findFirstInvalidStep()
    if (invalid) {
      jumpTo(invalid.stepId)
      // jumpTo only moves backwards; force the index for safety.
      const index = stepIds.indexOf(invalid.stepId)
      if (index >= 0) {
        setStepIndex(index)
      }
      applyValidationFailure(invalid.stepId, invalid.result)
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      const isWorkshop = mode === "workshop"
      const payload = isWorkshop ? buildWorkshopPayload() : buildEventPayload()
      const res = await fetch(
        isWorkshop ? "/api/registrations/workshop" : "/api/registrations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      )

      let json: ApiEnvelope<EventSubmitData & WorkshopSubmitData> | null = null
      try {
        json = (await res.json()) as ApiEnvelope<EventSubmitData & WorkshopSubmitData>
      } catch {
        json = null
      }

      if (!res.ok || !json?.success || !json.data) {
        const code = json?.code
        const message =
          json?.error ??
          (res.status === 429
            ? "Too many attempts. Please wait a moment and try again."
            : "Something went wrong. Please try again.")
        setFormError(message)

        if (code === "UPLOAD_EXPIRED") {
          handleExpiredUploads(json?.details ?? {})
          toast.error(message)
          return
        }
        toast.error(message)
        return
      }

      // ── Success ────────────────────────────────────────────────────────────
      if (isWorkshop) {
        setOutcome({
          mode: "workshop",
          title: json.data.workshopTitle,
          teamName: null,
          emailSent: json.data.emailSent,
          registrations: [],
          seatsRemaining: json.data.seatsRemaining,
        })
      } else {
        setOutcome({
          mode: "event",
          eventType: json.data.eventType,
          title: json.data.eventName,
          teamName: json.data.teamName,
          emailSent: json.data.emailSent,
          registrations: json.data.registrations ?? [],
          registrationFee: selectedEvent?.registrationFee ?? "0",
          bkashNumber,
          seatsRemaining: null,
        })
      }
      toast.success(isWorkshop ? "Workshop registration confirmed!" : "Registration submitted for review.")
      router.refresh()
    } catch {
      setFormError("Something went wrong while submitting. Please try again.")
      toast.error("Submission failed. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  function resetWizard(): void {
    setOutcome(null)
    setMode(null)
    setSelectedEventId(null)
    setSelectedWorkshopId(null)
    setStepIndex(0)
    setParticipantUpload(null)
    setTeamName("")
    setSymposiumDomain("")
    setIdeaSummary("")
    setMembers([])
    setAcceptTerms(false)
    setFieldErrors({})
    setStepError(null)
    setFormError(null)
    router.refresh()
  }

  async function copyRegistrationId(registrationId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(registrationId)
      toast.success("Registration ID copied.")
    } catch {
      toast.error("Could not copy — please copy it manually.")
    }
  }

  // ── Success screen ─────────────────────────────────────────────────────────

  if (outcome) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-6"
      >
        <Card className="overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="flex h-16 w-16 items-center justify-center rounded-full border border-neon/40 bg-neon/10 shadow-glow-neon-sm"
              >
                <CheckCircle2 size={32} className="text-neon" aria-hidden="true" />
              </motion.span>

              <h2 className="mt-5 font-display text-2xl font-bold text-text-primary">
                {outcome.mode === "event" ? "Registration Submitted" : "Registration Confirmed"}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-text-muted">
                {outcome.mode === "event"
                  ? Number(outcome.registrationFee ?? 0) > 0
                    ? `Your registration for ${outcome.title} is waiting for payment verification.`
                    : `Your registration for ${outcome.title} is pending admin review.`
                  : `You are registered for ${outcome.title}.`}
                {outcome.teamName ? ` Team: ${outcome.teamName}.` : ""}
              </p>
              <p className="mt-3 flex items-center gap-2 text-xs text-text-faint">
                <ShieldCheck size={14} className="text-neon" aria-hidden="true" />
                {outcome.mode === "event"
                  ? "We will email you when your registration is approved or rejected."
                  : outcome.emailSent
                    ? "A confirmation email is on its way to your inbox."
                    : "Your confirmation email could not be sent right now — details are always available on your dashboard."}
              </p>
              {outcome.mode === "workshop" && outcome.seatsRemaining !== null && (
                <p className="mt-2 font-mono text-xs uppercase tracking-wider text-cyan">
                  {outcome.seatsRemaining} seat{outcome.seatsRemaining === 1 ? "" : "s"} remaining
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* QR passes / registration IDs */}
        {outcome.registrations.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {outcome.registrations.map((reg) => (
              <Card key={reg.registrationId} variant="elevated">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {reg.participantName}
                      </p>
                      <div className="mt-1">
                        <Badge variant={reg.isLeader ? "cyan" : "muted"} size="sm">
                          {reg.isLeader ? "Team Leader" : "Team Member"}
                        </Badge>
                      </div>
                    </div>
                    {reg.qrDataUrl && (
                      <div className="shrink-0 rounded-md border border-border bg-white p-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={reg.qrDataUrl}
                          alt={`QR entry pass for ${reg.participantName}`}
                          width={96}
                          height={96}
                          className="h-24 w-24"
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-4 rounded-md border border-cyan/25 bg-cyan/5 p-3">
                    <p className="font-mono text-[0.625rem] uppercase tracking-widest text-text-muted">
                      Registration ID
                    </p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold tracking-wider text-cyan">
                        {reg.registrationId}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyRegistrationId(reg.registrationId)}
                        className="rounded-md p-1.5 text-text-faint transition-colors duration-150 hover:bg-cyan/10 hover:text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                        aria-label={`Copy registration ID ${reg.registrationId}`}
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {outcome.mode === "event" &&
          outcome.eventType !== "CTF" &&
          outcome.eventType !== "INNOVATION_SYMPOSIUM" &&
          Number(outcome.registrationFee ?? 0) > 0 && (
          <section className="mx-auto w-full max-w-2xl rounded-lg border border-border bg-bg-panel p-5">
            <h3 className="font-display text-base font-semibold text-text-primary">Complete your bKash payment</h3>
            <p className="mt-1 text-xs text-text-muted">Team participants submit payment separately from their own accounts.</p>
            {outcome.registrations.filter((registration) => registration.isLeader).map((registration) => (
              <BkashPaymentForm
                key={registration.registrationId}
                registrationId={registration.registrationId}
                amount={outcome.registrationFee!}
                bkashNumber={outcome.bkashNumber ?? ""}
              />
            ))}
          </section>
        )}

        <p className="text-center text-xs leading-relaxed text-text-faint">
          Approved registrations receive access to a QR pass. Your student ID
          stays private and is only reviewed by the verification team.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            variant="primary"
            size="lg"
            leftIcon={<LayoutDashboard size={16} />}
            onClick={() => router.push("/dashboard")}
          >
            Go to Dashboard
          </Button>
          <Button
            variant="secondary"
            size="lg"
            leftIcon={<Plus size={16} />}
            onClick={resetWizard}
          >
            Register for Another Event
          </Button>
        </div>
      </motion.div>
    )
  }

  // ── Step content renderer ──────────────────────────────────────────────────

  function renderStep() {
    // ── EVENT SELECTION ──────────────────────────────────────────────────────
    if (currentStepId === "event") {
      const hasAnyOption = events.length > 0 || workshops.length > 0
      if (!hasAnyOption) {
        return (
          <div className="rounded-lg border border-border bg-bg-panel p-8 text-center">
            <CalendarClock size={28} className="mx-auto text-text-faint" aria-hidden="true" />
            <p className="mt-4 text-sm font-medium text-text-primary">
              Registration is not open yet
            </p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-text-muted">
              Event modules and hands-on activities will appear here as soon as
              registration opens. Follow the announcements for the exact dates.
            </p>
            <Link
              href="/announcements"
              className="mt-4 inline-block font-mono text-xs uppercase tracking-wider text-cyan hover:text-cyan-400"
            >
              View announcements
            </Link>
          </div>
        )
      }

      const competitionEvents = events.filter((e) => e.type !== "HANDS_ON")
      const workshopEvents = events.filter((e) => e.type === "HANDS_ON")

      return (
        <div className="space-y-8">
          {events.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-mono text-xs uppercase tracking-widest text-text-muted">
                Competition Modules
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {[...competitionEvents, ...workshopEvents].map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isSelected={mode === "event" && event.id === selectedEventId}
                    onSelect={handleSelectEvent}
                  />
                ))}
              </div>
            </div>
          )}

          {workshops.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-mono text-xs uppercase tracking-widest text-text-muted">
                Workshops
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {workshops.map((workshop) => {
                  const isSelected = mode === "workshop" && workshop.id === selectedWorkshopId
                  const disabled = workshop.alreadyRegistered || workshop.seatsLeft <= 0
                  return (
                    <button
                      key={workshop.id}
                      type="button"
                      onClick={() => handleSelectWorkshop(workshop)}
                      disabled={disabled}
                      aria-pressed={isSelected}
                      className={[
                        "group relative rounded-lg border p-5 text-left transition-all duration-250",
                        "[transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
                        isSelected
                          ? "border-violet bg-violet/5"
                          : disabled
                            ? "cursor-not-allowed border-border bg-bg-panel opacity-60"
                            : "border-border bg-bg-panel hover:-translate-y-0.5 hover:border-violet/40",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-text-primary">
                          {workshop.title}
                        </p>
                        <Badge variant="violet" size="sm">
                          {titleCase(workshop.skillLevel)}
                        </Badge>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-text-muted">
                        <p className="flex items-center gap-2">
                          <CalendarClock size={13} className="shrink-0 text-text-faint" aria-hidden="true" />
                          {workshop.dateLabel} · {workshop.startTime}–{workshop.endTime}
                        </p>
                        <p className="flex items-center gap-2">
                          <MapPin size={13} className="shrink-0 text-text-faint" aria-hidden="true" />
                          {workshop.venue}
                        </p>
                      </div>

                      <p className="mt-3 text-xs font-medium leading-relaxed text-text-primary">Workshop: {workshop.registrationFee} BDT per person. Venue: {workshop.venue === "International Conference Hall (ICH)" ? "ICH" : workshop.venue}.</p>
                      <p className="mt-2 text-xs leading-relaxed text-text-muted">Giveaways: T-shirt, lunch, Pad, Pen, ID.</p>

                      <div className="mt-3">
                        {workshop.alreadyRegistered ? (
                          <Badge variant="neon" size="sm">
                            Already Registered
                          </Badge>
                        ) : workshop.seatsLeft <= 0 ? (
                          <Badge variant="pink" size="sm">
                            Fully Booked
                          </Badge>
                        ) : (
                          <span
                            className={[
                              "font-mono text-[0.625rem] uppercase tracking-wider",
                              workshop.seatsLeft <= 5 ? "text-amber" : "text-text-faint",
                            ].join(" ")}
                          >
                            {workshop.seatsLeft} seats left
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )
    }

    // ── INNOVATION SYMPOSIUM DETAILS ─────────────────────────────────────────
    if (currentStepId === "symposium") {
      return (
        <div className="space-y-5 rounded-lg border border-border bg-bg-panel p-5">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-cyan" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Innovation Symposium proposal</h3>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                Choose the closest domain and describe your preliminary idea. You may register a team of up to three people.
              </p>
            </div>
          </div>
          <Select
            label="Domain"
            placeholder="Select a domain"
            options={INNOVATION_SYMPOSIUM_DOMAINS.map((domain) => ({ value: domain, label: domain }))}
            value={symposiumDomain}
            onChange={(event) => {
              setSymposiumDomain(event.target.value)
              setFieldErrors((previous) => ({ ...previous, domain: "" }))
            }}
            error={fieldErrors.domain}
            disabled={submitting}
            required
          />
          <Textarea
            label="Idea Summary"
            placeholder="Describe the problem, your proposed approach, and its cybersecurity impact."
            value={ideaSummary}
            onChange={(event) => {
              setIdeaSummary(event.target.value)
              setFieldErrors((previous) => ({ ...previous, ideaSummary: "" }))
            }}
            error={fieldErrors.ideaSummary}
            helper="20–3000 characters"
            maxLength={3000}
            rows={6}
            disabled={submitting}
            required
          />
        </div>
      )
    }

    // ── PARTICIPANT DETAILS ──────────────────────────────────────────────────
    if (currentStepId === "participant") {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-bg-panel p-5">
            <ParticipantFields
              values={participant}
              onChange={updateParticipant}
              errors={bareErrors(fieldErrors, "participant")}
              universities={universities}
              disabled={submitting}
            />
          </div>
          <p className="text-xs leading-relaxed text-text-faint">
            Use the details exactly as they appear on your student ID — the
            verification team checks them against your uploaded document.
          </p>
        </div>
      )
    }

    // ── UPLOAD ───────────────────────────────────────────────────────────────
    if (currentStepId === "upload") {
      return (
        <div className="space-y-4">
          <UploadField
            label="Student ID Photo"
            value={participantUpload}
            onChange={(upload) => {
              setParticipantUpload(upload)
              setFieldErrors((prev) => {
                const next = { ...prev }
                delete next["participant.verification"]
                return next
              })
            }}
            error={fieldErrors["participant.verification"]}
            maxSizeBytes={FILE_UPLOAD.studentId.maxSizeBytes}
            disabled={submitting}
          />
          <div className="rounded-md border border-border bg-bg-panel p-4">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-text-muted">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-neon" aria-hidden="true" />
              Your file is stored in a private, access-controlled location. Only
              the verification team can open it — every view is logged, and it is
              never shown publicly.
            </p>
          </div>
        </div>
      )
    }

    // ── TEAM SETUP ───────────────────────────────────────────────────────────
    if (currentStepId === "team" && selectedEvent) {
      return (
        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-bg-panel p-5">
            <Input
              label="Team Name"
              placeholder="e.g. Null Pointer Exception"
              leftIcon={<Users size={16} />}
              value={teamName}
              onChange={(e) => {
                setTeamName(e.target.value)
                setFieldErrors((prev) => {
                  const next = { ...prev }
                  delete next["team.name"]
                  return next
                })
              }}
              error={fieldErrors["team.name"]}
              helper="Unique per event — your teammates will be added under this name"
              maxLength={60}
              disabled={submitting}
              required
            />
          </div>
          <div className="rounded-md border border-cyan/25 bg-cyan/5 p-4">
            <p className="font-mono text-[0.625rem] uppercase tracking-widest text-cyan">
              Team Size Rule
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
              {selectedEvent.name} teams must have between{" "}
              {selectedEvent.minTeamSize} and {maxTeamSizeForEvent(selectedEvent)} members
              including the team leader (you). You will add your teammates in the
              next step.
            </p>
          </div>
        </div>
      )
    }

    // ── TEAM MEMBERS ─────────────────────────────────────────────────────────
    if (currentStepId === "members" && selectedEvent) {
      const maxTeamSize = maxTeamSizeForEvent(selectedEvent)
      const canAddMore = members.length < maxTeamSize - 1
      const total = 1 + members.length
      const sizeOk =
        total >= selectedEvent.minTeamSize && total <= maxTeamSize

      return (
        <div className="space-y-5">
          {/* Size status */}
          <div
            className={[
              "flex items-center justify-between gap-3 rounded-md border p-4",
              sizeOk ? "border-neon/30 bg-neon/5" : "border-amber/30 bg-amber/5",
            ].join(" ")}
          >
            <p className="text-xs leading-relaxed text-text-muted">
              Current team size:{" "}
              <span className={sizeOk ? "font-bold text-neon" : "font-bold text-amber"}>
                {total}
              </span>{" "}
              of {selectedEvent.minTeamSize}–{maxTeamSize} required
              (including you)
            </p>
            {!sizeOk && (
              <AlertTriangle size={16} className="shrink-0 text-amber" aria-hidden="true" />
            )}
          </div>

          {/* Member cards */}
          <div className="space-y-5">
            {members.map((member, index) => (
              <div
                key={member.key}
                className="rounded-lg border border-border bg-bg-panel"
              >
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
                    Member {index + 2}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeMember(index)}
                    disabled={submitting}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[0.625rem] uppercase tracking-wider text-text-faint transition-colors duration-150 hover:bg-pink/10 hover:text-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Trash2 size={12} aria-hidden="true" />
                    Remove
                  </button>
                </div>

                <div className="space-y-5 p-5">
                  <ParticipantFields
                    values={member.values}
                    onChange={(patch) => updateMember(index, patch)}
                    errors={bareErrors(fieldErrors, `team.members.${index}`)}
                    universities={universities}
                    disabled={submitting}
                  />

                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="member@example.com"
                    value={member.values.email}
                    onChange={(e) => updateMember(index, { email: e.target.value })}
                    error={fieldErrors[`team.members.${index}.email`]}
                    helper="Approval updates will be sent to this address"
                    disabled={submitting}
                    required
                  />

                  <UploadField
                    label="Student ID Photo"
                    value={member.upload}
                    onChange={(upload) => updateMemberUpload(index, upload)}
                    error={fieldErrors[`team.members.${index}.verification`]}
                    maxSizeBytes={FILE_UPLOAD.studentId.maxSizeBytes}
                    disabled={submitting}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Add member */}
          <Button
            variant="secondary"
            onClick={addMember}
            disabled={!canAddMore || submitting}
            leftIcon={<Plus size={15} />}
            fullWidth
          >
            {canAddMore
              ? `Add Team Member (${members.length} of ${maxTeamSize - 1} added)`
              : "Maximum team size reached"}
          </Button>

          <p className="flex items-start gap-2 text-xs leading-relaxed text-text-faint">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-neon" aria-hidden="true" />
            Each member&apos;s student ID is uploaded now but only reviewed after
            you submit. Members cannot already be part of another team in this
            event.
          </p>
        </div>
      )
    }

    // ── REVIEW ───────────────────────────────────────────────────────────────
    if (currentStepId === "review") {
      const isTeam = mode === "event" && selectedEvent?.isTeamEvent

      return (
        <div className="space-y-5">
          {/* Selection summary */}
          <ReviewBlock
            title={mode === "workshop" ? "Hands-on Activity" : "Event"}
            onEdit={() => jumpTo("event")}
          >
            <p className="text-sm font-medium text-text-primary">
              {mode === "workshop" ? selectedWorkshop?.title : selectedEvent?.name}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {mode === "workshop"
                ? `${selectedWorkshop?.dateLabel} · ${selectedWorkshop?.startTime}–${selectedWorkshop?.endTime} · ${selectedWorkshop?.venue}`
                : selectedEvent?.shortDescription}
            </p>
          </ReviewBlock>

          {selectedEvent?.type === "INNOVATION_SYMPOSIUM" && (
            <ReviewBlock title="Innovation Symposium proposal" onEdit={() => jumpTo("symposium")}>
              <p className="text-sm font-medium text-text-primary">{symposiumDomain}</p>
              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-text-muted">{ideaSummary}</p>
            </ReviewBlock>
          )}

          {/* Participant summary */}
          <ReviewBlock title="Your Information" onEdit={() => jumpTo("participant")}>
            <ReviewParticipant values={participant} universities={universities} />
          </ReviewBlock>

          {/* Upload summary */}
          <ReviewBlock title="Student ID" onEdit={() => jumpTo("upload")}>
            <p className="text-xs text-text-muted">
              {participantUpload
                ? `${participantUpload.fileName} (${formatBytes(participantUpload.sizeBytes)}) — uploaded securely`
                : "Not uploaded"}
            </p>
          </ReviewBlock>

          {/* Team summary */}
          {isTeam && selectedEvent && (
            <ReviewBlock title="Team" onEdit={() => jumpTo("team")}>
              <p className="text-sm font-medium text-text-primary">{teamName}</p>
              <p className="mt-1 font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                {1 + members.length} member{members.length === 0 ? "" : "s"} including you
              </p>
            </ReviewBlock>
          )}

          {isTeam && members.length > 0 && (
            <ReviewBlock title="Team Members" onEdit={() => jumpTo("members")}>
              <ul className="space-y-3">
                {members.map((member, index) => (
                  <li key={member.key} className="border-b border-border/60 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-text-primary">
                        {member.values.fullName || `Member ${index + 2}`}
                      </p>
                      <span className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
                        {member.upload ? "ID ready" : "ID missing"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {member.values.email} · {member.values.studentId}
                    </p>
                  </li>
                ))}
              </ul>
            </ReviewBlock>
          )}

          <div className="rounded-md border border-cyan/25 bg-cyan/5 p-4">
            <p className="text-xs leading-relaxed text-text-muted">
              Submitting locks in these details. If you need to change a member
              later, you can manage your team from the dashboard.
            </p>
          </div>
        </div>
      )
    }

    // ── TERMS ────────────────────────────────────────────────────────────────
    if (currentStepId === "terms") {
      const rulesText =
        mode === "event" ? selectedEvent?.rules : null

      return (
        <div className="space-y-5">
          {formError && (
            <Alert variant="error">
              <div className="space-y-2">
                <p>{formError}</p>
                {(formError.toLowerCase().includes("full") ||
                  formError.toLowerCase().includes("closed") ||
                  formError.toLowerCase().includes("deadline")) && (
                  <button
                    type="button"
                    onClick={() => {
                      jumpTo("event")
                      setStepIndex(0)
                      router.refresh()
                    }}
                    className="font-mono text-xs uppercase tracking-wider text-cyan hover:text-cyan-400"
                  >
                    Choose another event
                  </button>
                )}
              </div>
            </Alert>
          )}

          {rulesText && (
            <>
              <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
                Event Rules
              </p>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-bg-panel p-4">
                <p className="whitespace-pre-line text-xs leading-relaxed text-text-muted">
                  {rulesText}
                </p>
              </div>
            </>
          )}

          <div className="rounded-lg border border-border bg-bg-panel p-5">
            <Checkbox
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked)
                setStepError(null)
              }}
              disabled={submitting}
              label="I accept the rules and terms of participation"
              description="I confirm the information provided is accurate, that each student ID uploaded belongs to the named participant, and that I accept the event rules and the organizers' decisions."
            />
          </div>
        </div>
      )
    }

    return null
  }

  // ── Wizard shell ───────────────────────────────────────────────────────────

  const isLastStep = currentStepId === "terms"

  return (
    <div ref={wizardRef} className="space-y-8">
      {/* Progress — full indicator on desktop, mini bar on mobile */}
      <div className="hidden sm:block">
        <StepIndicator steps={indicatorSteps} currentIndex={stepIndex} />
      </div>
      <div className="space-y-2 sm:hidden">
        <MiniStepBar total={stepIds.length} current={stepIndex + 1} />
        <p className="text-center font-mono text-xs uppercase tracking-widest text-text-muted">
          Step {stepIndex + 1} of {stepIds.length} — {STEP_META[currentStepId].label}
        </p>
      </div>

      {/* Step error banner */}
      {stepError && currentStepId !== "terms" && (
        <Alert variant="warning">{stepError}</Alert>
      )}

      {/* Step body */}
      <motion.div
        key={currentStepId}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        {renderStep()}
      </motion.div>

      {/* Navigation */}
      {currentStepId !== "event" || mode ? (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={stepIndex === 0 || submitting}
            leftIcon={<ArrowLeft size={15} />}
          >
            Back
          </Button>

          {isLastStep ? (
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              loading={submitting}
              loadingText="Submitting…"
              rightIcon={<ShieldCheck size={15} />}
            >
              Submit Registration
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={goNext}
              disabled={mode === null || submitting}
              rightIcon={<ArrowRight size={15} />}
            >
              Continue
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}

// ─── Review sub-components ───────────────────────────────────────────────────

function ReviewBlock({
  title,
  onEdit,
  children,
}: {
  title: string
  onEdit: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-panel p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-text-muted">
          {title}
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="font-mono text-[0.625rem] uppercase tracking-wider text-cyan transition-colors duration-150 hover:text-cyan-400"
        >
          Edit
        </button>
      </div>
      {children}
    </div>
  )
}

function ReviewParticipant({
  values,
  universities,
}: {
  values: ParticipantFormValues
  universities: UniversityOption[]
}) {
  const universityName =
    values.universityId === UNIVERSITY_OTHER
      ? `${values.universityName} (to be reviewed)`
      : (universities.find((u) => u.id === values.universityId)?.name ?? "—")

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
      <ReviewRow label="Full Name" value={values.fullName} />
      <ReviewRow label="Student ID" value={values.studentId} />
      <ReviewRow label="Department" value={values.department} />
      <ReviewRow label="Mobile" value={values.phone} />
      <ReviewRow label="T-Shirt" value={values.tshirtSize} />
      <ReviewRow label="Institution" value={universityName} />
    </dl>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[0.625rem] uppercase tracking-wider text-text-faint">
        {label}
      </dt>
      <dd className="text-text-primary">{value || "—"}</dd>
    </div>
  )
}
