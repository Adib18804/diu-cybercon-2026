"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X,
} from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// Alert — info / success / warning / error, dismissible, animated
// =============================================================================

export type AlertVariant = "info" | "success" | "warning" | "error"

export interface AlertProps {
  variant?: AlertVariant
  title?: string
  children: React.ReactNode
  dismissible?: boolean
  onDismiss?: () => void
  className?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
}

const alertConfig: Record<
  AlertVariant,
  {
    border: string
    bg: string
    iconColor: string
    titleColor: string
    textColor: string
    icon: React.ReactNode
    role: string
  }
> = {
  info: {
    border:     "border-cyan/30",
    bg:         "bg-cyan/5",
    iconColor:  "text-cyan",
    titleColor: "text-cyan",
    textColor:  "text-text-muted",
    icon:       <Info size={16} />,
    role:       "note",
  },
  success: {
    border:     "border-neon/30",
    bg:         "bg-neon/5",
    iconColor:  "text-neon",
    titleColor: "text-neon",
    textColor:  "text-text-muted",
    icon:       <CheckCircle2 size={16} />,
    role:       "status",
  },
  warning: {
    border:     "border-amber/30",
    bg:         "bg-amber/5",
    iconColor:  "text-amber",
    titleColor: "text-amber",
    textColor:  "text-text-muted",
    icon:       <AlertTriangle size={16} />,
    role:       "alert",
  },
  error: {
    border:     "border-pink/30",
    bg:         "bg-pink/5",
    iconColor:  "text-pink",
    titleColor: "text-pink",
    textColor:  "text-text-muted",
    icon:       <XCircle size={16} />,
    role:       "alert",
  },
}

function Alert({
  variant = "info",
  title,
  children,
  dismissible = false,
  onDismiss,
  className,
  icon,
  actions,
}: AlertProps) {
  const [visible, setVisible] = React.useState(true)
  const config = alertConfig[variant]

  function handleDismiss() {
    setVisible(false)
    onDismiss?.()
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          role={config.role}
          aria-live={variant === "error" || variant === "warning" ? "assertive" : "polite"}
          className={cn(
            "relative flex gap-3 rounded-lg border p-4",
            config.border,
            config.bg,
            className,
          )}
        >
          {/* Icon */}
          <span
            className={cn("shrink-0 mt-0.5", config.iconColor)}
            aria-hidden="true"
          >
            {icon ?? config.icon}
          </span>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            {title && (
              <p
                className={cn(
                  "text-sm font-semibold font-body",
                  config.titleColor,
                )}
              >
                {title}
              </p>
            )}
            <div className={cn("text-sm font-body leading-relaxed", config.textColor)}>
              {children}
            </div>
            {actions && <div className="mt-3">{actions}</div>}
          </div>

          {/* Dismiss button */}
          {dismissible && (
            <button
              type="button"
              onClick={handleDismiss}
              className={cn(
                "shrink-0 p-1 rounded transition-colors duration-150",
                "text-text-faint hover:text-text-primary",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
              )}
              aria-label="Dismiss alert"
            >
              <X size={14} />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// =============================================================================
// InlineAlert — compact single-line version for form contexts
// =============================================================================

function InlineAlert({
  variant = "error",
  children,
  className,
}: {
  variant?: AlertVariant
  children: React.ReactNode
  className?: string
}) {
  const config = alertConfig[variant]

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      role={config.role}
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2",
        config.border,
        config.bg,
        className,
      )}
    >
      <span className={cn("shrink-0", config.iconColor)} aria-hidden="true">
        {config.icon}
      </span>
      <p className={cn("text-xs font-body", config.textColor)}>{children}</p>
    </motion.div>
  )
}

// =============================================================================
// RegistrationClosedAlert — specific branded alert for closed registrations
// =============================================================================

function RegistrationClosedAlert({
  eventName,
  className,
}: {
  eventName?: string
  className?: string
}) {
  return (
    <Alert
      variant="warning"
      title="Registration Closed"
      className={className}
    >
      {eventName
        ? `Registration for ${eventName} is currently closed.`
        : "Registration for this event is currently closed."}{" "}
      Check the announcements page for updates.
    </Alert>
  )
}

export { Alert, InlineAlert, RegistrationClosedAlert }
