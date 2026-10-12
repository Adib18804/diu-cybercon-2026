// =============================================================================
// Registration Components — Barrel Export
// Import from "@/components/register" instead of individual files
// =============================================================================

export { RegisterAuthGate } from "./RegisterAuthGate"

export { RegistrationWizard } from "./RegistrationWizard"
export type { RegistrationWizardProps } from "./RegistrationWizard"

export { UploadField } from "./UploadField"
export type { UploadFieldProps } from "./UploadField"

export { ParticipantFields } from "./ParticipantFields"
export type { ParticipantFieldsProps } from "./ParticipantFields"

// ── Serializable boundary types (shared server ↔ client) ─────────────────────
export {
  UNIVERSITY_OTHER,
  TSHIRT_SIZES,
  emptyParticipantForm,
} from "./types"
export type {
  TShirtSizeValue,
  WizardEvent,
  WizardWorkshop,
  UniversityOption,
  ViewerProfile,
  Viewer,
  ParticipantFormValues,
  MemberFormValues,
  StagedUpload,
  RegisteredEntry,
  RegistrationOutcome,
} from "./types"
