"use client"

import { motion } from "framer-motion"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"

// =============================================================================
// Global Error Boundary (Next.js App Router)
// Catches unhandled errors in the React tree.
// Never exposes internal details to the user.
// =============================================================================

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to error tracking (Sentry will auto-capture via instrumentation)
    // We explicitly log here for server-side awareness
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[GlobalError]", error)
    }
  }, [error])

  return (
    <html lang="en">
      <body className="bg-bg-deep text-text-primary font-body antialiased">
        <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
          {/* Background grid */}
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(0,229,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.045) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />

          {/* Glow blob */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-pink/5 blur-[80px] pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 max-w-lg w-full text-center"
          >
            {/* Error icon */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-pink/10 border border-pink/20 flex items-center justify-center">
                  <AlertTriangle className="w-10 h-10 text-pink" />
                </div>
                {/* Pulse ring */}
                <div className="absolute inset-0 rounded-2xl border border-pink/20 animate-ping opacity-30" />
              </div>
            </div>

            {/* Error code */}
            <p className="font-mono text-xs uppercase tracking-widest text-pink/60 mb-3">
              System Error · 500
            </p>

            {/* Heading */}
            <h1 className="font-display font-bold text-3xl text-text-primary mb-4 tracking-tight">
              Something went wrong
            </h1>

            {/* Description */}
            <p className="text-text-muted text-sm leading-relaxed mb-2 max-w-sm mx-auto">
              An unexpected error occurred. Our team has been notified and is
              working to resolve it.
            </p>

            {/* Error digest — safe to show, contains no internals */}
            {error.digest && (
              <p className="font-mono text-xs text-text-faint mb-8">
                Reference:{" "}
                <span className="text-text-muted">{error.digest}</span>
              </p>
            )}

            {!error.digest && <div className="mb-8" />}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={reset}
                className="btn-primary flex items-center gap-2 justify-center"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>

              <Link href="/" className="btn-secondary flex items-center gap-2 justify-center">
                <Home className="w-4 h-4" />
                Back to Home
              </Link>
            </div>

            {/* Terminal decorative block */}
            <div className="mt-12 text-left rounded-md border border-border bg-bg-panel p-4 font-mono text-xs text-text-faint">
              <span className="text-cyan">$</span>{" "}
              <span className="text-text-muted">diucybercon --status</span>
              <br />
              <span className="text-pink">✗</span> Unexpected exception caught
              <br />
              <span className="text-amber">!</span> Engineers notified
              <br />
              <span className="text-neon">→</span> Try refreshing or return home
            </div>
          </motion.div>
        </div>
      </body>
    </html>
  )
}
