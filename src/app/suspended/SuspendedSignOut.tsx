"use client"

import { LogOut } from "lucide-react"
import { signOut } from "next-auth/react"

import { Button } from "@/components/ui"

// =============================================================================
// SuspendedSignOut — clears the session so the user can switch accounts
// =============================================================================

export function SuspendedSignOut() {
  return (
    <Button
      type="button"
      variant="danger"
      leftIcon={<LogOut size={16} />}
      onClick={() => void signOut({ callbackUrl: "/" })}
    >
      Sign Out
    </Button>
  )
}
