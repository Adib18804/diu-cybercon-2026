"use client"

import { GraduationCap, Phone, Shirt, User } from "lucide-react"
import * as React from "react"

import { UNIVERSITY_OTHER, type ParticipantFormValues, type UniversityOption } from "./types"

import { Input, Select } from "@/components/ui"


// =============================================================================
// ParticipantFields — the shared identity fieldset used for the leader (self)
// and for every team member card.
// =============================================================================

export interface ParticipantFieldsProps {
  values: ParticipantFormValues
  onChange: (patch: Partial<ParticipantFormValues>) => void
  /** Errors keyed by bare field name: fullName, studentId, … */
  errors: Record<string, string>
  universities: UniversityOption[]
  disabled?: boolean
}

const TSHIRT_OPTIONS = ["M", "L", "XL", "XXL", "XXXL"].map((size) => ({
  value: size,
  label: size,
}))

export function ParticipantFields({
  values,
  onChange,
  errors,
  universities,
  disabled = false,
}: ParticipantFieldsProps) {
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

  const isOtherUniversity = values.universityId === UNIVERSITY_OTHER

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Input
        label="Full Name"
        placeholder="e.g. Ayesha Rahman"
        autoComplete="name"
        leftIcon={<User size={16} />}
        value={values.fullName}
        onChange={(e) => onChange({ fullName: e.target.value })}
        error={errors.fullName}
        disabled={disabled}
        required
        className="sm:col-span-2"
      />

      <Input
        label="Student ID"
        placeholder="e.g. 221-15-4789"
        value={values.studentId}
        onChange={(e) => onChange({ studentId: e.target.value })}
        error={errors.studentId}
        helper="As printed on your student ID card"
        disabled={disabled}
        required
      />

      <Input
        label="Department"
        placeholder="e.g. Computer Science & Engineering"
        value={values.department}
        onChange={(e) => onChange({ department: e.target.value })}
        error={errors.department}
        disabled={disabled}
        required
      />

      <Input
        label="Mobile Number"
        type="tel"
        placeholder="01XXXXXXXXX"
        autoComplete="tel"
        leftIcon={<Phone size={16} />}
        value={values.phone}
        onChange={(e) => onChange({ phone: e.target.value })}
        error={errors.phone}
        helper="Bangladeshi number — used for event-day updates"
        disabled={disabled}
        required
      />

      <Select
        label="T-Shirt Size"
        placeholder="Select size"
        options={TSHIRT_OPTIONS}
        value={values.tshirtSize}
        onChange={(e) => onChange({ tshirtSize: e.target.value })}
        error={errors.tshirtSize}
        disabled={disabled}
        required
      />

      <Select
        label="Institution"
        placeholder="Select your institution"
        options={universityOptions}
        value={values.universityId}
        onChange={(e) => onChange({ universityId: e.target.value })}
        error={errors.universityId}
        disabled={disabled}
        required
      />

      {isOtherUniversity && (
        <Input
          label="Institution Name"
          placeholder="Write your institution's full name"
          leftIcon={<GraduationCap size={16} />}
          value={values.universityName}
          onChange={(e) => onChange({ universityName: e.target.value })}
          error={errors.universityName}
          helper="We will add it for review by the organizing team"
          disabled={disabled}
          required
          className="sm:col-span-2"
        />
      )}

      {/* Shirt icon hint keeps the required size visible near the grid edge */}
      <p className="flex items-center gap-1.5 text-xs text-text-faint sm:col-span-2">
        <Shirt size={12} aria-hidden="true" />
        T-shirt sizes are final — used for the official event kit.
      </p>
    </div>
  )
}
