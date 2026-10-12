"use client"

import { GraduationCap, Phone, Save, User } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import toast from "react-hot-toast"

import {
  UNIVERSITY_OTHER,
  type UniversityOption,
} from "@/components/register/types"
import { Button, Input, Select } from "@/components/ui"
import type { DashboardProfile } from "@/lib/dashboard/queries"
import {
  departmentSchema,
  fullNameSchema,
  phoneSchema,
  tshirtSizeSchema,
  universityNameSchema,
} from "@/lib/validations/registration"

// =============================================================================
// ProfileForm — edit own participant profile.
// Student ID and email are identity anchors — read-only, managed by the
// organizing team. Everything else is self-service.
// =============================================================================

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: string
  code?: string
  details?: Record<string, string[]>
}

const TSHIRT_OPTIONS = ["M", "L", "XL", "XXL", "XXXL"].map((size) => ({
  value: size,
  label: size,
}))

export interface ProfileFormProps {
  profile: DashboardProfile
  universities: UniversityOption[]
}

export function ProfileForm({ profile, universities }: ProfileFormProps) {
  const router = useRouter()

  const [fullName, setFullName] = React.useState(profile.fullName)
  const [department, setDepartment] = React.useState(profile.department)
  const [phone, setPhone] = React.useState(profile.phone)
  const [tshirtSize, setTshirtSize] = React.useState(profile.tshirtSize)
  const [universityId, setUniversityId] = React.useState(profile.universityId)
  const [universityName, setUniversityName] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)

  const isOtherUniversity = universityId === UNIVERSITY_OTHER

  const universityOptions = React.useMemo(
    () => [
      ...universities.map((u) => ({
        value: u.id,
        label: u.shortName ? `${u.name} (${u.shortName})` : u.name,
      })),
      { value: UNIVERSITY_OTHER, label: "Other — my institution is not listed" },
    ],
    [universities],
  )

  function validate(): boolean {
    const next: Record<string, string> = {}

    const nameResult = fullNameSchema.safeParse(fullName)
    if (!nameResult.success) {
      next.fullName = nameResult.error.issues[0]?.message ?? "Invalid name"
    }

    const deptResult = departmentSchema.safeParse(department)
    if (!deptResult.success) {
      next.department = deptResult.error.issues[0]?.message ?? "Invalid department"
    }

    const phoneResult = phoneSchema.safeParse(phone)
    if (!phoneResult.success) {
      next.phone = phoneResult.error.issues[0]?.message ?? "Invalid phone number"
    }

    const sizeResult = tshirtSizeSchema.safeParse(tshirtSize)
    if (!sizeResult.success) {
      next.tshirtSize = sizeResult.error.issues[0]?.message ?? "Select a size"
    }

    if (isOtherUniversity) {
      const uniResult = universityNameSchema.safeParse(universityName)
      if (!uniResult.success) {
        next.universityName =
          uniResult.error.issues[0]?.message ?? "Institution name is required"
      }
    } else if (!universityId) {
      next.universityId = "Select your institution"
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (saving) {return}
    if (!validate()) {return}

    setSaving(true)
    try {
      const payload: Record<string, string> = {
        fullName,
        department,
        phone,
        tshirtSize,
      }
      if (isOtherUniversity) {
        payload.universityName = universityName
      } else {
        payload.universityId = universityId
      }

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      let json: ApiEnvelope<Record<string, string>> | null = null
      try {
        json = (await res.json()) as ApiEnvelope<Record<string, string>>
      } catch {
        json = null
      }

      if (!res.ok || !json?.success) {
        const message =
          json?.error ??
          (res.status === 429
            ? "Too many attempts. Please wait a moment and try again."
            : "Could not save your profile. Please try again.")
        if (json?.details) {
          const flat: Record<string, string> = {}
          for (const [key, messages] of Object.entries(json.details)) {
            if (messages[0]) {flat[key] = messages[0]}
          }
          setErrors(flat)
        }
        toast.error(message)
        return
      }

      toast.success("Profile updated.")
      router.refresh()
    } catch {
      toast.error("Could not save your profile. Check your connection.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-6">
      {/* ── Read-only identity ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-bg-elevated/50 p-4 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-text-faint">
            Student ID
          </p>
          <p className="mt-1 font-mono text-sm text-text-primary">
            {profile.studentId}
          </p>
        </div>
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-text-faint">
            Email
          </p>
          <p className="mt-1 truncate text-sm text-text-primary">{profile.email}</p>
        </div>
        <p className="text-xs text-text-faint sm:col-span-2">
          Your student ID and email are locked to your verified identity.
          Contact the organizers if either needs to change.
        </p>
      </div>

      {/* ── Editable fields ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Full Name"
          autoComplete="name"
          leftIcon={<User size={16} />}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.fullName}
          required
          className="sm:col-span-2"
        />

        <Input
          label="Department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          error={errors.department}
          required
        />

        <Input
          label="Mobile Number"
          type="tel"
          autoComplete="tel"
          leftIcon={<Phone size={16} />}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
          helper="Bangladeshi number — used for event-day updates"
          required
        />

        <Select
          label="T-Shirt Size"
          placeholder="Select size"
          options={TSHIRT_OPTIONS}
          value={tshirtSize}
          onChange={(e) => setTshirtSize(e.target.value)}
          error={errors.tshirtSize}
          required
        />

        <Select
          label="Institution"
          placeholder="Select your institution"
          options={universityOptions}
          value={universityId}
          onChange={(e) => setUniversityId(e.target.value)}
          error={errors.universityId}
          required
        />

        {isOtherUniversity && (
          <Input
            label="Institution Name"
            leftIcon={<GraduationCap size={16} />}
            value={universityName}
            onChange={(e) => setUniversityName(e.target.value)}
            error={errors.universityName}
            helper="We will add it for review by the organizing team"
            required
            className="sm:col-span-2"
          />
        )}
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          loading={saving}
          loadingText="Saving…"
          leftIcon={<Save size={16} />}
        >
          Save Changes
        </Button>
      </div>
    </form>
  )
}
