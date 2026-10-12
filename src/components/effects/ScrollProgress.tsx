"use client"

// =============================================================================
// ScrollProgress — top-edge reading progress bar
//   · scaleX driven by framer-motion useScroll + useSpring (expo-out feel)
//   · Fixed above everything (z-scan-line), pointer-events-none
// =============================================================================

import { motion, useScroll, useSpring } from "framer-motion"

export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 30,
    mass: 0.3,
  })

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="pointer-events-none fixed inset-x-0 top-0 z-scan-line h-0.5 origin-left bg-gradient-to-r from-cyan via-violet to-pink print:hidden"
    />
  )
}
