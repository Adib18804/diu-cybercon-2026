// =============================================================================
// DIU_CYBERCON 2026 — Accent Color → Tailwind Class Map
// Data-driven accent colors (from constants) resolved to static Tailwind
// classes — keeps styling out of inline styles (Part 25 anti-patterns).
// =============================================================================

export const ACCENT_DOT_CLASS: Record<string, string> = {
  "#E11D48": "bg-cyan",
  "#FB7185": "bg-neon",
  "#BE123C": "bg-violet",
  "#F43F5E": "bg-pink",
  "#9F1239": "bg-amber",
  "#881337": "bg-violet",
  "#A3A3A3": "bg-text-muted",
}

/** Fallback class for unknown accent values */
export const ACCENT_DOT_FALLBACK = "bg-text-faint"

/** Resolve an accent hex from constants to its dot background class */
export function accentDotClass(accent: string): string {
  return ACCENT_DOT_CLASS[accent] ?? ACCENT_DOT_FALLBACK
}
