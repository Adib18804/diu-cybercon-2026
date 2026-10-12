"use client"

import { ArrowLeft } from "lucide-react"

import { cn } from "@/lib/utils"

// =============================================================================
// BackButton — client-side history back (usable from server components)
// =============================================================================

interface BackButtonProps {
  label?: string
  className?: string
}

export function BackButton({ label = "Go Back", className }: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      className={cn("btn-ghost flex items-center gap-2 justify-center", className)}
    >
      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
      {label}
    </button>
  )
}
