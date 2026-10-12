"use client"

import { motion } from "framer-motion"
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Shield,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Wifi,
  WifiOff,
} from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"
import type { VerificationStatus } from "@/types/index"

// =============================================================================
// Badge — base component + all semantic variants
// =============================================================================

export type BadgeVariant =
  | "cyan"
  | "neon"
  | "violet"
  | "pink"
  | "amber"
  | "muted"
  | "outline"

export type BadgeSize = "sm" | "md" | "lg"

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
  pulse?: boolean
  icon?: React.ReactNode
}

const variantClasses: Record<BadgeVariant, string> = {
  cyan:    "bg-cyan/10 text-cyan border-cyan/25",
  neon:    "bg-neon/10 text-neon border-neon/25",
  violet:  "bg-violet/10 text-violet border-violet/25",
  pink:    "bg-pink/10 text-pink border-pink/25",
  amber:   "bg-amber/10 text-amber border-amber/25",
  muted:   "bg-border/30 text-text-muted border-border",
  outline: "bg-transparent text-text-muted border-border hover:border-cyan/40 hover:text-text-primary",
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: "text-[0.6rem] px-1.5 py-0.5 gap-1",
  md: "text-[0.6875rem] px-2.5 py-0.5 gap-1.5",
  lg: "text-xs px-3 py-1 gap-1.5",
}

function Badge({
  variant = "cyan",
  size = "md",
  dot = false,
  pulse = false,
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono font-bold uppercase tracking-widest",
        "rounded-full border transition-all duration-250",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {/* Dot indicator */}
      {dot && (
        <span
          className={cn(
            "inline-block rounded-full shrink-0",
            size === "sm" ? "w-1 h-1" : "w-1.5 h-1.5",
            pulse && "animate-live-pulse",
            variant === "cyan"    && "bg-cyan",
            variant === "neon"    && "bg-neon",
            variant === "violet"  && "bg-violet",
            variant === "pink"    && "bg-pink",
            variant === "amber"   && "bg-amber",
            variant === "muted"   && "bg-text-muted",
            variant === "outline" && "bg-text-muted",
          )}
          aria-hidden="true"
        />
      )}

      {/* Icon */}
      {icon && (
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}

      {children}
    </span>
  )
}

// =============================================================================
// VerificationBadge — maps VerificationStatus → styled badge
// =============================================================================

const verificationConfig: Record<
  VerificationStatus,
  { label: string; variant: BadgeVariant; icon: React.ReactNode; description: string }
> = {
  PENDING: {
    label: "Pending",
    variant: "amber",
    icon: <Clock size={10} />,
    description: "Verification is pending review",
  },
  VERIFIED: {
    label: "Verified",
    variant: "neon",
    icon: <CheckCircle2 size={10} />,
    description: "Identity verified",
  },
  REJECTED: {
    label: "Rejected",
    variant: "pink",
    icon: <XCircle size={10} />,
    description: "Verification was rejected",
  },
  REVISION_REQUIRED: {
    label: "Revision Required",
    variant: "violet",
    icon: <AlertTriangle size={10} />,
    description: "Please re-upload your student ID",
  },
}

export interface VerificationBadgeProps {
  status: VerificationStatus
  size?: BadgeSize
  showIcon?: boolean
  className?: string
}

function VerificationBadge({
  status,
  size = "md",
  showIcon = true,
  className,
}: VerificationBadgeProps) {
  const config = verificationConfig[status]

  return (
    <Badge
      variant={config.variant}
      size={size}
      icon={showIcon ? config.icon : undefined}
      className={className}
      title={config.description}
      aria-label={`Verification status: ${config.description}`}
    >
      {config.label}
    </Badge>
  )
}

// =============================================================================
// SecurityBadge — for event/security context labels
// =============================================================================

export type SecurityLevel = "safe" | "warning" | "danger" | "info"

const securityConfig: Record<
  SecurityLevel,
  { label: string; variant: BadgeVariant; icon: React.ReactNode }
> = {
  safe:    { label: "Secure",  variant: "neon",   icon: <ShieldCheck size={10} /> },
  warning: { label: "Warning", variant: "amber",  icon: <ShieldAlert size={10} /> },
  danger:  { label: "Danger",  variant: "pink",   icon: <ShieldX size={10} /> },
  info:    { label: "Info",    variant: "cyan",   icon: <Shield size={10} /> },
}

function SecurityBadge({
  level,
  label,
  size = "md",
  className,
}: {
  level: SecurityLevel
  label?: string
  size?: BadgeSize
  className?: string
}) {
  const config = securityConfig[level]
  return (
    <Badge
      variant={config.variant}
      size={size}
      icon={config.icon}
      className={className}
    >
      {label ?? config.label}
    </Badge>
  )
}

// =============================================================================
// LiveBadge — pulsing green dot for "live" / "ongoing" states
// =============================================================================

function LiveBadge({
  label = "Live",
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <Badge
      variant="neon"
      size="md"
      dot
      pulse
      className={className}
      role="status"
      aria-label="This event is currently live"
    >
      {label}
    </Badge>
  )
}

// =============================================================================
// OnlineBadge — for online/offline event day label
// =============================================================================

function OnlineBadge({
  isOnline,
  className,
}: {
  isOnline: boolean
  className?: string
}) {
  return (
    <Badge
      variant={isOnline ? "cyan" : "muted"}
      size="sm"
      icon={isOnline ? <Wifi size={9} /> : <WifiOff size={9} />}
      className={className}
    >
      {isOnline ? "Online" : "On-site"}
    </Badge>
  )
}

// =============================================================================
// EventTypeBadge — solo / team / attendance labels
// =============================================================================

function EventTypeBadge({
  type,
  className,
}: {
  type: "team" | "solo" | "attendance" | "individual"
  className?: string
}) {
  const config = {
    team:       { label: "Team",       variant: "cyan"   as BadgeVariant },
    solo:       { label: "Solo",       variant: "neon"   as BadgeVariant },
    attendance: { label: "Attendance", variant: "violet" as BadgeVariant },
    individual: { label: "Individual", variant: "amber"  as BadgeVariant },
  }
  const c = config[type]
  return (
    <Badge variant={c.variant} size="sm" className={className}>
      {c.label}
    </Badge>
  )
}

// =============================================================================
// NewBadge — animated "NEW" label for announcements
// =============================================================================

function NewBadge({ className }: { className?: string }) {
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <Badge variant="pink" size="sm" pulse className={className}>
        New
      </Badge>
    </motion.span>
  )
}

export {
  Badge,
  VerificationBadge,
  SecurityBadge,
  LiveBadge,
  OnlineBadge,
  EventTypeBadge,
  NewBadge,
}
