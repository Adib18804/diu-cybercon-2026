"use client"

import * as React from "react"

import {
  getPasswordStrength,
  type PasswordStrength,
} from "@/lib/validations/auth"

// =============================================================================
// PasswordStrengthMeter — 4-segment strength bar (shared by signup + reset)
// =============================================================================

const STRENGTH_META: Record<
  PasswordStrength,
  { bars: number; barClass: string; textClass: string; label: string }
> = {
  weak:   { bars: 1, barClass: "bg-pink",  textClass: "text-pink",  label: "Weak" },
  fair:   { bars: 2, barClass: "bg-amber", textClass: "text-amber", label: "Fair" },
  good:   { bars: 3, barClass: "bg-cyan",  textClass: "text-cyan",  label: "Good" },
  strong: { bars: 4, barClass: "bg-neon",  textClass: "text-neon",  label: "Strong" },
}

export interface PasswordStrengthMeterProps {
  password: string
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const strength = React.useMemo(
    () => getPasswordStrength(password),
    [password],
  )

  if (!password) {
    return null
  }

  const meta = STRENGTH_META[strength.strength]
  const showFeedback =
    strength.feedback.length > 0 && strength.strength !== "strong"

  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((segment) => (
            <div
              key={segment}
              className={`h-1 flex-1 rounded-full transition-colors duration-250 ${
                segment <= meta.bars ? meta.barClass : "bg-bg-elevated"
              }`}
            />
          ))}
        </div>
        <span
          className={`font-mono text-[0.625rem] font-bold uppercase tracking-widest ${meta.textClass}`}
        >
          {meta.label}
        </span>
      </div>

      {showFeedback && (
        <p className="text-xs text-text-faint">
          {strength.feedback.slice(0, 3).join(" · ")}
        </p>
      )}
    </div>
  )
}
