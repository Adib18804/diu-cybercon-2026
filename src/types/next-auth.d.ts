// =============================================================================
// NextAuth.js Session Augmentation
// Extends the default Session and JWT types with our custom fields.
// =============================================================================

import type { AdminRole, UserRole } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string | null
      image: string | null
      role: UserRole
      adminRole: AdminRole | null
      isSuspended: boolean
      emailVerified: Date | null
    }
  }

  interface User {
    id: string
    role: UserRole
    adminRole: AdminRole | null
    isSuspended: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: UserRole
    adminRole: AdminRole | null
    isSuspended: boolean
    /** Epoch ms — Date objects do not survive JWT serialization */
    emailVerified: number | null
    /** Epoch ms of the last DB freshness check (throttled to ~1/minute) */
    lastChecked?: number
  }
}
