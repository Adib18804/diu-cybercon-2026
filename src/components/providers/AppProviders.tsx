"use client"

// =============================================================================
// DIU_CYBERCON 2026 — Client Providers
// Wraps the application in client-side context providers.
// Currently: NextAuth SessionProvider (auth state for nav, guards, dashboards).
// =============================================================================

import { SessionProvider } from "next-auth/react"
import * as React from "react"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      basePath="/api/auth"
      refetchOnWindowFocus
      refetchInterval={10 * 60}
    >
      {children}
    </SessionProvider>
  )
}
