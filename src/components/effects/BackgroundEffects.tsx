// =============================================================================
// DIU CyberCon 2026 — Ambient Background Effects
// Fixed, zero-interaction layer rendered once behind all content:
//   · circuit grid (60px, cyan 4.5% opacity)
//   · radial cyan glow (top center) + violet glow (bottom right)
//   · noise grain overlay
// Pure CSS — no runtime JS, no continuous heavy animation.
// =============================================================================

export function BackgroundEffects() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-effects overflow-hidden"
    >
      {/* Circuit grid */}
      <div className="absolute inset-0 bg-grid" />

      {/* Radial glow — top center (hero warmth) */}
      <div className="absolute -top-[30%] left-1/2 h-[70vh] w-[120vw] -translate-x-1/2 bg-gradient-radial-cyan" />

      {/* Radial glow — bottom right (depth) */}
      <div className="absolute -bottom-[20%] -right-[10%] h-[60vh] w-[80vw] bg-gradient-radial-violet" />

      {/* Noise grain */}
      <div className="absolute inset-0 bg-noise" />
    </div>
  )
}
