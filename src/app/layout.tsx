import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import nextDynamic from "next/dynamic"
import { headers } from "next/headers"
import { Toaster } from "react-hot-toast"

import { BackgroundEffects, Cursor, MatrixBg, ScanLine, ScrollProgress } from "@/components/effects"
import { AnnouncementBar, Footer, Navbar } from "@/components/layout"
import { AppProviders } from "@/components/providers"

import "@/app/globals.css"

// Preloader is a purely client-side visual effect (reads sessionStorage,
// runs animations). Skipping SSR means React never tries to reconcile a
// server-rendered overlay against the client's initial state, permanently
// eliminating the AnimatePresence / motion hydration mismatch.
const Preloader = nextDynamic(
  () => import("@/components/effects/Preloader").then((mod) => ({ default: mod.Preloader })),
  { ssr: false },
)

// The middleware issues a fresh CSP nonce for every request and Next.js can
// only stamp it onto dynamically rendered HTML — static/ISR output would
// carry a stale nonce and get its scripts blocked. Force per-request
// rendering for the whole app (see src/middleware.ts).
export const dynamic = "force-dynamic"

// =============================================================================
// Font Definitions
// =============================================================================

const inter = localFont({
  src: [
    { path: "../../public/fonts/inter/inter-300.woff2", weight: "300", style: "normal" },
    { path: "../../public/fonts/inter/inter-400.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/inter/inter-500.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/inter/inter-600.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/inter/inter-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
})

const spaceGrotesk = localFont({
  src: [
    { path: "../../public/fonts/space-grotesk/space-grotesk-400.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/space-grotesk/space-grotesk-500.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/space-grotesk/space-grotesk-600.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/space-grotesk/space-grotesk-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-space-grotesk",
  display: "swap",
})

const jetbrainsMono = localFont({
  src: [
    { path: "../../public/fonts/jetbrains-mono/jetbrains-mono-400.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/jetbrains-mono/jetbrains-mono-500.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/jetbrains-mono/jetbrains-mono-600.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/jetbrains-mono/jetbrains-mono-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-jetbrains-mono",
  display: "swap",
})

// =============================================================================
// Metadata
// =============================================================================

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://diucybercon.com"
const APP_NAME = "DIU_CYBERCON 2026"
const APP_DESCRIPTION =
  "Bangladesh's flagship national cybersecurity conference, competition, and talent platform. CTF, Innovation Symposium, workshops, and Panel Discussion on 12 December 2026. Hosted by the Cyber Security Club, DIU."

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: `${APP_NAME} — Bangladesh's National Cybersecurity Conference`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: [
    "DIU_CYBERCON 2026",
    "Cybersecurity Event Bangladesh",
    "National CTF Bangladesh",
    "Cybersecurity Conference Bangladesh",
    "Cybersecurity Competition Bangladesh",
    "DIU Cyber Security Club",
    "CTF Bangladesh",
    "Daffodil International University",
    "Capture The Flag Bangladesh",
    "Ethical Hacking Bangladesh",
    "Cybersecurity Workshop Bangladesh",
  ],
  authors: [{ name: "Cyber Security Club, DIU", url: "https://diu.edu.bd" }],
  creator: "Cyber Security Club, Department of CSE, Daffodil International University",
  publisher: "Daffodil International University",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: APP_NAME,
    title: `${APP_NAME} — Bangladesh's National Cybersecurity Conference`,
    description: APP_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DIU_CYBERCON 2026 — LEARN · SECURE · DEFEND",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — Bangladesh's National Cybersecurity Conference`,
    description: APP_DESCRIPTION,
    images: ["/og-image.png"],
    creator: "@diucybercon",
    site: "@diucybercon",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    other: [{ rel: "mask-icon", url: "/icons/safari-pinned-tab.svg", color: "#E11D48" }],
  },
  manifest: "/site.webmanifest",
  alternates: {
    canonical: APP_URL,
  },
  verification: {
    // Add Google Search Console verification token here when available
    google: "",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
    { media: "(prefers-color-scheme: light)", color: "#0A0A0A" },
  ],
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

// =============================================================================
// JSON-LD Structured Data
// =============================================================================

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${APP_URL}/#organization`,
      name: "Cyber Security Club, Daffodil International University",
      url: APP_URL,
      logo: {
        "@type": "ImageObject",
        url: `${APP_URL}/icons/logo.png`,
      },
      sameAs: [
        "https://diu.edu.bd",
      ],
    },
    {
      "@type": "Event",
      "@id": `${APP_URL}/#event`,
      name: "DIU_CYBERCON 2026",
      description: APP_DESCRIPTION,
      startDate: "2026-10-24",
      endDate: "2026-11-15",
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/MixedEventAttendanceMode",
      location: [
        {
          "@type": "VirtualLocation",
          name: "Online (CTF Preliminary Round)",
          url: APP_URL,
        },
        {
          "@type": "Place",
          name: "Daffodil Smart City",
          address: {
            "@type": "PostalAddress",
            streetAddress: "Birulia, Savar",
            addressLocality: "Dhaka",
            postalCode: "1216",
            addressCountry: "BD",
          },
        },
      ],
      organizer: {
        "@type": "Organization",
        "@id": `${APP_URL}/#organization`,
        name: "Cyber Security Club, Daffodil International University",
      },
      url: APP_URL,
      image: `${APP_URL}/og-image.png`,
    },
  ],
}

// =============================================================================
// Root Layout
// =============================================================================

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request CSP nonce, generated in src/middleware.ts and forwarded via
  // the request headers. Next.js itself stamps the nonce onto framework and
  // page scripts; hand-written inline scripts below must opt in explicitly.
  const nonce = headers().get("x-nonce") ?? undefined

  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Preconnect for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://res.cloudinary.com" />

        {/*
          Preloader pre-hydration gate — runs before first paint.
          Adds `dc-preloaded` to <html> when the boot sequence should be
          skipped (repeat visit this session, or reduced motion). Paired with
          the `html.dc-preloaded #dc-preloader` rule in globals.css so the
          SSR-rendered overlay never flashes for returning visitors.

          suppressHydrationWarning: browsers clear the `nonce` content
          attribute after parsing (anti-exfiltration), so React's hydration
          diff would otherwise report a false mismatch for it.
        */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              'try{if(sessionStorage.getItem("dc26-preloaded")==="1"||window.matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.classList.add("dc-preloaded")}}catch(e){}',
          }}
        />

        {/* JSON-LD Structured Data — data block, never executed */}
        <script
          type="application/ld+json"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex min-h-screen flex-col bg-bg-deep text-text-primary font-body antialiased selection:bg-cyan/20 selection:text-cyan">
        <AppProviders>
          {/* Boot sequence — once per session, skipped under reduced motion */}
          <Preloader />

          {/* Ambient background effects — fixed, non-interactive */}
          <BackgroundEffects />
          <MatrixBg />

          {/* Topmost ambient layers */}
          <ScanLine />
          <ScrollProgress />
          <Cursor />

          {/* Skip to content — accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:bg-cyan focus:px-4 focus:py-2 focus:text-bg-deep focus:font-mono focus:font-bold focus:text-sm focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-offset-2 focus:ring-offset-bg-deep"
          >
            Skip to main content
          </a>

          <AnnouncementBar />
          <Navbar />

          {/* Main content — id for skip link */}
          <main
            id="main-content"
            className="relative z-content flex-1 pt-[calc(var(--navbar-height)+var(--announcement-height))]"
          >
            {children}
          </main>

          <Footer />

          {/* Toast notifications — styled to match design system */}
          <Toaster
            position="top-right"
            reverseOrder={false}
            gutter={8}
            containerStyle={{ top: 80 }}
            toastOptions={{
              duration: 4000,
              style: {
                background: "#121212",
                color: "#FFFFFF",
                border: "1px solid #262626",
                borderRadius: "8px",
                fontFamily: "var(--font-inter)",
                fontSize: "0.875rem",
                maxWidth: "420px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
              },
              success: {
                iconTheme: { primary: "#FB7185", secondary: "#121212" },
                style: {
                  border: "1px solid rgba(251, 113, 133,0.3)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.6), 0 0 12px rgba(251, 113, 133,0.1)",
                },
              },
              error: {
                iconTheme: { primary: "#E11D48", secondary: "#121212" },
                style: {
                  border: "1px solid rgba(225, 29, 72,0.3)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.6), 0 0 12px rgba(225, 29, 72,0.1)",
                },
              },
              loading: {
                iconTheme: { primary: "#E11D48", secondary: "#121212" },
                style: {
                  border: "1px solid rgba(225, 29, 72,0.3)",
                },
              },
            }}
          />
        </AppProviders>
      </body>
    </html>
  )
}
