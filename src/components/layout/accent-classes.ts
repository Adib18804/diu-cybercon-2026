// =============================================================================
// DIU CyberCon 2026 — Accent Color → Tailwind Class Map
// Data-driven accent colors (from constants) resolved to static Tailwind
// classes — keeps styling out of inline styles (Part 25 anti-patterns).
// =============================================================================

export const ACCENT_DOT_CLASS: Record<string, string> = {
  "#00e5ff": "bg-cyan",
  "#39ff14": "bg-neon",
  "#7c3aed": "bg-violet",
  "#ff2e88": "bg-pink",
  "#ffb020": "bg-amber",
  "#8b949e": "bg-text-muted",
}

/** Fallback class for unknown accent values */
export const ACCENT_DOT_FALLBACK = "bg-text-faint"

/** Resolve an accent hex from constants to its dot background class */
export function accentDotClass(accent: string): string {
  return ACCENT_DOT_CLASS[accent] ?? ACCENT_DOT_FALLBACK
}
