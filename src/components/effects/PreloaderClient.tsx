"use client"

// =============================================================================
// PreloaderClient — client-only wrapper for Preloader.
// next/dynamic with ssr:false is only legal in Client Components (Next.js 15).
// The root layout (a Server Component) imports this shim instead of Preloader
// directly, keeping the dynamic import valid while still skipping SSR.
// =============================================================================

import dynamic from "next/dynamic"

const Preloader = dynamic(
  () => import("./Preloader").then((mod) => ({ default: mod.Preloader })),
  { ssr: false },
)

export { Preloader as PreloaderClient }
