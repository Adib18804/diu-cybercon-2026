"use client"

import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowRight,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Session } from "next-auth"
import { signOut, useSession } from "next-auth/react"
import * as React from "react"

import { accentDotClass } from "./accent-classes"

import { Drawer } from "@/components/ui"
import {
  APP_NAME,
  APP_TAGLINE,
  NAV_EVENT_LINKS,
  NAV_LINKS,
} from "@/lib/constants"
import { cn } from "@/lib/utils"


// =============================================================================
// Navbar — fixed top navigation
//   · transparent → glass on scroll
//   · Events dropdown with accent dots
//   · session-aware right side (skeletons while loading)
//   · mobile slide-in Drawer
// IMPORTANT: the Drawer renders OUTSIDE <header> — backdrop-filter on the
// header would otherwise become the containing block for fixed descendants.
// =============================================================================

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/"
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = React.useState(false)

  React.useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > threshold)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [threshold])

  return scrolled
}

function useClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T>,
  handler: () => void,
): void {
  const handlerRef = React.useRef(handler)
  React.useEffect(() => {
    handlerRef.current = handler
  })

  React.useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handlerRef.current()
      }
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [ref])
}

// ─── Brand mark ───────────────────────────────────────────────────────────────

const BRAND_TEXT = APP_NAME.replace(/\s*\d{4}\s*$/, "")
const BRAND_YEAR = String(APP_NAME.match(/\d{4}/)?.[0] ?? "")

function BrandLogo() {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-2.5"
      aria-label={`${APP_NAME} — Home`}
    >
      <span
        className="flex h-8 w-8 items-center justify-center rounded-md border border-cyan/40 bg-cyan/5 font-mono text-sm font-bold text-cyan shadow-glow-cyan-sm"
        aria-hidden="true"
      >
        &gt;_
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-sm font-bold uppercase tracking-tight text-text-primary">
          {BRAND_TEXT}
        </span>
        <span className="mt-0.5 font-mono text-[0.55rem] font-semibold tracking-[0.3em] text-cyan">
          {BRAND_YEAR}
        </span>
      </span>
    </Link>
  )
}

// ─── Events dropdown ──────────────────────────────────────────────────────────

function EventsDropdown() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  useClickOutside(containerRef, () => setOpen(false))

  React.useEffect(() => {
    if (!open) {
      return
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open])

  const active = pathname.startsWith("/events")

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex items-center gap-1 rounded-md px-3 py-2 font-body text-sm transition-colors duration-150",
          active || open
            ? "text-cyan"
            : "text-text-muted hover:text-text-primary",
        )}
      >
        Events
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-250",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Events"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="glass-strong absolute left-0 top-full mt-2 w-72 rounded-md p-2 shadow-lg"
          >
            {NAV_EVENT_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors duration-150",
                  pathname === item.href
                    ? "bg-bg-elevated text-cyan"
                    : "text-text-muted hover:bg-bg-elevated/60 hover:text-text-primary",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    accentDotClass(item.accent),
                  )}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            ))}

            <div className="divider-glow my-2" />

            <Link
              href="/events"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm text-cyan transition-colors duration-150 hover:bg-cyan/5"
            >
              All Events
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── User menu (desktop) ──────────────────────────────────────────────────────

function UserMenu({ session }: { session: Session }) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  useClickOutside(containerRef, () => setOpen(false))

  const user = session.user
  const isAdmin = user.role === "ADMIN" || user.role === "STAFF"
  const initial = (user.name?.trim().charAt(0) || user.email.charAt(0)).toUpperCase()

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-md p-1 transition-colors duration-150 hover:bg-bg-elevated/60"
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-md border border-cyan/30 bg-cyan/10 font-display text-sm font-bold text-cyan"
          aria-hidden="true"
        >
          {initial}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-text-faint transition-transform duration-250",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Account"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="glass-strong absolute right-0 top-full mt-2 w-64 rounded-md p-2 shadow-lg"
          >
            {/* Identity */}
            <div className="px-3 py-2">
              <p className="truncate font-display text-sm font-semibold text-text-primary">
                {user.name ?? "Participant"}
              </p>
              <p className="truncate text-xs text-text-faint">{user.email}</p>
            </div>

            <div className="divider-glow my-2" />

            <Link
              href="/dashboard"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-text-muted transition-colors duration-150 hover:bg-bg-elevated/60 hover:text-text-primary"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              Dashboard
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-text-muted transition-colors duration-150 hover:bg-bg-elevated/60 hover:text-text-primary"
              >
                <Shield className="h-4 w-4" aria-hidden="true" />
                Admin Panel
              </Link>
            )}

            <div className="divider-glow my-2" />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                void signOut({ callbackUrl: "/" })
              }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-pink transition-colors duration-150 hover:bg-pink/5"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign Out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Mobile drawer content ────────────────────────────────────────────────────

function MobileAuthSection({
  session,
  onNavigate,
}: {
  session: Session | null
  onNavigate: () => void
}) {
  if (!session?.user) {
    return (
      <div className="flex flex-col gap-3">
        <Link
          href="/register"
          onClick={onNavigate}
          className="btn-primary w-full justify-center"
        >
          Register Now
        </Link>
        <Link
          href="/login"
          onClick={onNavigate}
          className="btn-secondary w-full justify-center"
        >
          Sign In
        </Link>
      </div>
    )
  }

  const isAdmin = session.user.role === "ADMIN" || session.user.role === "STAFF"

  return (
    <div className="flex flex-col gap-1">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-text-muted transition-colors duration-150 hover:bg-bg-elevated/60 hover:text-text-primary"
      >
        <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
        Dashboard
      </Link>

      {isAdmin && (
        <Link
          href="/admin"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-text-muted transition-colors duration-150 hover:bg-bg-elevated/60 hover:text-text-primary"
        >
          <Shield className="h-4 w-4" aria-hidden="true" />
          Admin Panel
        </Link>
      )}

      <button
        type="button"
        onClick={() => {
          onNavigate()
          void signOut({ callbackUrl: "/" })
        }}
        className="flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-pink transition-colors duration-150 hover:bg-pink/5"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Sign Out
      </button>
    </div>
  )
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

export function Navbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const scrolled = useScrolled()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  // Close the mobile drawer whenever the route changes
  React.useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const desktopLinks = NAV_LINKS.filter((link) => link.href !== "/events")

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-[var(--announcement-height)] z-navbar h-[var(--navbar-height)] border-b transition-colors duration-400",
          scrolled || mobileOpen
            ? "border-border bg-bg-deep/85 backdrop-blur-lg"
            : "border-transparent bg-transparent",
        )}
      >
        <nav
          aria-label="Main navigation"
          className="container flex h-full items-center justify-between gap-4"
        >
          <BrandLogo />

          {/* Desktop navigation */}
          <div className="hidden items-center gap-0.5 lg:flex">
            <EventsDropdown />
            {desktopLinks.map((link) => {
              const active = isActivePath(pathname, link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2 font-body text-sm transition-colors duration-150",
                    active
                      ? "text-cyan"
                      : "text-text-muted hover:text-text-primary",
                  )}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 lg:flex">
              {status === "loading" ? (
                <div
                  className="h-9 w-24 animate-pulse rounded-md bg-bg-elevated"
                  aria-hidden="true"
                />
              ) : session?.user ? (
                <UserMenu session={session} />
              ) : (
                <>
                  <Link href="/login" className="btn-ghost">
                    Sign In
                  </Link>
                  <Link href="/register" className="btn-primary">
                    Register
                  </Link>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
              className="flex h-10 w-10 items-center justify-center rounded-md text-text-muted transition-colors duration-150 hover:bg-bg-elevated/60 hover:text-text-primary lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile drawer — rendered OUTSIDE the blurred header */}
      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        side="right"
        title={APP_NAME}
        description={APP_TAGLINE}
      >
        <div className="space-y-6">
          {/* Navigation */}
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-text-faint">
              Navigation
            </p>
            <div className="flex flex-col gap-0.5">
              {NAV_LINKS.map((link) => {
                const active = isActivePath(pathname, link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-md px-3 py-2.5 text-sm transition-colors duration-150",
                      active
                        ? "bg-bg-elevated text-cyan"
                        : "text-text-muted hover:bg-bg-elevated/60 hover:text-text-primary",
                    )}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Events */}
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-text-faint">
              Events
            </p>
            <div className="flex flex-col gap-0.5">
              {NAV_EVENT_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors duration-150",
                    pathname === item.href
                      ? "bg-bg-elevated text-cyan"
                      : "text-text-muted hover:bg-bg-elevated/60 hover:text-text-primary",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      accentDotClass(item.accent),
                    )}
                    aria-hidden="true"
                  />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="divider-glow" />

          {/* Auth */}
          <MobileAuthSection
            session={session}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>
      </Drawer>
    </>
  )
}
