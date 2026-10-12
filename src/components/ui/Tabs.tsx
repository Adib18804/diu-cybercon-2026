"use client"

import { motion } from "framer-motion"
import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// Tabs — animated sliding underline indicator, keyboard navigation, accessible
// =============================================================================

export interface TabItem {
  value: string
  label: React.ReactNode
  icon?: React.ReactNode
  badge?: string | number
  disabled?: boolean
}

export type TabsVariant = "underline" | "pill" | "boxed"

export interface TabsProps {
  tabs: TabItem[]
  value: string
  onChange: (value: string) => void
  variant?: TabsVariant
  /** Render content below the tab bar */
  children?: React.ReactNode
  className?: string
  tabsClassName?: string
  /** Full-width tabs (equal columns) */
  fullWidth?: boolean
  /** Unique layoutId for Framer Motion — needed when multiple Tabs on same page */
  layoutId?: string
}

function Tabs({
  tabs,
  value,
  onChange,
  variant = "underline",
  children,
  className,
  tabsClassName,
  fullWidth = false,
  layoutId,
}: TabsProps) {
  const id = React.useId()
  const resolvedLayoutId = layoutId ?? `tabs-indicator-${id}`

  // Keyboard navigation: arrow keys move between tabs
  function handleKeyDown(e: React.KeyboardEvent, currentIndex: number) {
    const enabledTabs = tabs.filter((t) => !t.disabled)
    const enabledIndex = enabledTabs.findIndex((t) => t.value === tabs[currentIndex]?.value)

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault()
      const next = enabledTabs[(enabledIndex + 1) % enabledTabs.length]
      if (next) {onChange(next.value)}
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault()
      const prev = enabledTabs[(enabledIndex - 1 + enabledTabs.length) % enabledTabs.length]
      if (prev) {onChange(prev.value)}
    } else if (e.key === "Home") {
      e.preventDefault()
      const first = enabledTabs[0]
      if (first) {onChange(first.value)}
    } else if (e.key === "End") {
      e.preventDefault()
      const last = enabledTabs[enabledTabs.length - 1]
      if (last) {onChange(last.value)}
    }
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Tab list */}
      <div
        role="tablist"
        aria-orientation="horizontal"
        className={cn(
          variant === "underline" && "border-b border-border",
          variant === "pill"     && "bg-bg-elevated rounded-lg p-1",
          variant === "boxed"    && "border border-border rounded-lg p-1 bg-bg-panel",
          tabsClassName,
        )}
      >
        <div
          className={cn(
            "relative flex",
            variant === "underline" && "gap-0",
            (variant === "pill" || variant === "boxed") && "gap-1",
            fullWidth && "w-full",
          )}
        >
          {tabs.map((tab, index) => {
            const isActive = tab.value === value

            return (
              <button
                key={tab.value}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={`tabpanel-${id}-${tab.value}`}
                id={`tab-${id}-${tab.value}`}
                tabIndex={isActive ? 0 : -1}
                disabled={tab.disabled}
                onClick={() => !tab.disabled && onChange(tab.value)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className={cn(
                  "relative flex items-center gap-2 font-mono font-bold uppercase tracking-wider",
                  "transition-colors duration-250 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-inset",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  fullWidth && "flex-1 justify-center",

                  // Underline variant
                  variant === "underline" && [
                    "px-4 pb-3 pt-1 text-[0.6875rem]",
                    isActive ? "text-cyan" : "text-text-muted hover:text-text-primary",
                  ],

                  // Pill variant
                  variant === "pill" && [
                    "px-4 py-2 text-[0.6875rem] rounded-md z-10",
                    isActive
                      ? "text-bg-deep"
                      : "text-text-muted hover:text-text-primary",
                  ],

                  // Boxed variant
                  variant === "boxed" && [
                    "px-4 py-2 text-[0.6875rem] rounded-md z-10",
                    isActive
                      ? "text-cyan"
                      : "text-text-muted hover:text-text-primary",
                  ],
                )}
              >
                {/* Sliding background for pill/boxed */}
                {isActive && (variant === "pill" || variant === "boxed") && (
                  <motion.span
                    layoutId={resolvedLayoutId}
                    className={cn(
                      "absolute inset-0 rounded-md",
                      variant === "pill"  && "bg-cyan",
                      variant === "boxed" && "bg-cyan/10 border border-cyan/30",
                    )}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    aria-hidden="true"
                  />
                )}

                {/* Icon */}
                {tab.icon && (
                  <span className="shrink-0 relative z-10" aria-hidden="true">
                    {tab.icon}
                  </span>
                )}

                {/* Label */}
                <span className="relative z-10">{tab.label}</span>

                {/* Badge */}
                {tab.badge !== undefined && (
                  <span
                    className={cn(
                      "relative z-10 inline-flex items-center justify-center",
                      "min-w-[1.25rem] h-5 px-1.5 rounded-full",
                      "font-mono text-[0.625rem] font-bold",
                      isActive
                        ? variant === "pill"
                          ? "bg-bg-deep/20 text-bg-deep"
                          : "bg-cyan text-bg-deep"
                        : "bg-border text-text-muted",
                    )}
                  >
                    {tab.badge}
                  </span>
                )}

                {/* Underline indicator */}
                {isActive && variant === "underline" && (
                  <motion.span
                    layoutId={resolvedLayoutId}
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan shadow-glow-cyan-sm rounded-full"
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    aria-hidden="true"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab panels */}
      {children && (
        <div className="mt-4">
          {React.Children.map(children, (child) => {
            if (!React.isValidElement(child)) {return null}
            const tabValue = (child.props as { value?: string }).value
            if (!tabValue) {return child}
            return (
              <div
                role="tabpanel"
                id={`tabpanel-${id}-${tabValue}`}
                aria-labelledby={`tab-${id}-${tabValue}`}
                hidden={tabValue !== value}
                tabIndex={0}
                className={cn(
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan",
                  tabValue !== value && "hidden",
                )}
              >
                {tabValue === value && child}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── TabPanel — child wrapper for controlled tab content ──────────────────────

function TabPanel({
  value: _value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  return <div className={className}>{children}</div>
}

export { Tabs, TabPanel }
