import bundleAnalyzer from "@next/bundle-analyzer"

// Next.js 14 does not support next.config.ts — keep this file as .mjs.
// (TypeScript config files are only supported from Next.js 15 onwards.)

const withBundleAnalyzer =
  process.env.ANALYZE === "true"
    ? bundleAnalyzer({ enabled: true })
    : (config) => config

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ─── Experimental features ──────────────────────────────────────
  experimental: {
    typedRoutes: true,
    serverComponentsExternalPackages: ["argon2", "sharp"],
  },

  // ─── Images ─────────────────────────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/**",
      },
    ],
    // Never serve user-uploaded student IDs via Next/Image
    // Those are served via signed URLs from the API
    dangerouslyAllowSVG: false,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // ─── Security headers ───────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
        ],
      },
      // ─── API routes — tighter CORS handled in middleware ────────
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
      // ─── Static assets — aggressive caching ─────────────────────
      {
        source: "/fonts/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ]
  },

  // ─── Redirects ──────────────────────────────────────────────────
  async redirects() {
    return [
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
      {
        source: "/events/hands-on",
        destination: "/events/workshops",
        permanent: true,
      },
    ]
  },

  // ─── Compiler options ───────────────────────────────────────────
  compiler: {
    // Remove console.log in production (keep warn + error)
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },

  // ─── Output ─────────────────────────────────────────────────────
  output: "standalone",

  // ─── Webpack ────────────────────────────────────────────────────
  webpack(config) {
    // Required for argon2 native bindings
    config.externals = [...(config.externals ?? []), "argon2"]
    return config
  },

  // ─── TypeScript ─────────────────────────────────────────────────
  typescript: {
    ignoreBuildErrors: false,
  },

  // ─── ESLint ─────────────────────────────────────────────────────
  eslint: {
    ignoreDuringBuilds: false,
  },

  poweredByHeader: false,
}

export default withBundleAnalyzer(nextConfig)
