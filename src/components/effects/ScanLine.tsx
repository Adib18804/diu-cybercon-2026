// =============================================================================
// ScanLine — ambient CRT sweep
//   · 1px cyan line travelling top → bottom of the viewport (6s loop)
//   · Fixed, pointer-events-none, topmost overlay layer (z-scan-line)
//   · Hidden entirely under prefers-reduced-motion
// =============================================================================

export function ScanLine() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-scan-line overflow-hidden motion-reduce:hidden"
    >
      <div className="animate-scan-line absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/15 to-transparent" />
    </div>
  )
}
