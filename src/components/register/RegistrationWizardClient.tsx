"use client"

// =============================================================================
// RegistrationWizardClient — client-only wrapper for RegistrationWizard.
// next/dynamic with ssr:false is only legal in Client Components (Next.js 15).
// The register page (a Server Component) imports this shim instead of
// RegistrationWizard directly, keeping the dynamic import valid while still
// skipping SSR for the wizard.
// =============================================================================

import dynamic from "next/dynamic"

const RegistrationWizard = dynamic(
  () =>
    import("./RegistrationWizard").then((mod) => ({
      default: mod.RegistrationWizard,
    })),
  { ssr: false },
)

export { RegistrationWizard as RegistrationWizardClient }
