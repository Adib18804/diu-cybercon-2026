"use client"

// =============================================================================
// AnnouncementBar — fixed top ticker above the Navbar
//   · Pulls the latest published announcements from /api/announcements
//   · Falls back to factual event strings when the feed is empty/unreachable
//   · Height is exposed as --announcement-height (layout offsets depend on it)
// =============================================================================

import * as React from "react"

import { Marquee } from "@/components/ui"

const FALLBACK_ITEMS = [
  "DIU_CYBERCON 2026 — LEARN · SECURE · DEFEND",
  "CTF Preliminary Round — 24 October 2026 · Online",
  "On-site event — 12 December 2026 · Daffodil Smart City, Savar",
  "Hosted by the Cyber Security Club, Department of CSE, Daffodil International University",
] as const

const MAX_ITEMS = 6

interface AnnouncementsPayload {
  success?: boolean
  data?: Array<{ id?: unknown; title?: unknown }>
}

export function AnnouncementBar() {
  const [items, setItems] = React.useState<readonly string[]>(FALLBACK_ITEMS)

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch(`/api/announcements?limit=${MAX_ITEMS}`)
        if (!response.ok) {
          return
        }
        const payload = (await response.json()) as AnnouncementsPayload
        const titles = Array.isArray(payload.data)
          ? payload.data
              .map((item) => (typeof item?.title === "string" ? item.title : ""))
              .filter((title) => title.length > 0)
          : []

        if (!cancelled && titles.length > 0) {
          setItems(titles.slice(0, MAX_ITEMS))
        }
      } catch {
        // Network failure — keep the factual fallback ticker.
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="fixed inset-x-0 top-0 z-navbar h-[var(--announcement-height)] border-b border-border-subtle bg-bg-panel/90 backdrop-blur-sm print:hidden">
      <div className="container flex h-full items-center gap-3 overflow-hidden">
        <span className="shrink-0 font-mono text-micro font-bold uppercase tracking-widest text-cyan/90">
          {"//"} Updates
        </span>

        <span
          className="hidden h-3.5 w-px shrink-0 bg-border sm:block"
          aria-hidden="true"
        />

        <Marquee
          speed="fast"
          pauseOnHover
          fadeEdges
          ariaLabel={items.join(" · ")}
          className="min-w-0 flex-1"
        >
          {items.map((title) => (
            <span
              key={title}
              className="mx-5 inline-flex items-center gap-2 whitespace-nowrap font-mono text-[0.65rem] uppercase tracking-wider text-text-muted"
            >
              <span className="text-cyan/50" aria-hidden="true">
                ◆
              </span>
              {title}
            </span>
          ))}
        </Marquee>
      </div>
    </div>
  )
}
