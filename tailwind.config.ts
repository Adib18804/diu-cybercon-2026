import type { Config } from "tailwindcss"
import type { PluginAPI } from "tailwindcss/types/config"
import { fontFamily } from "tailwindcss/defaultTheme"
import animatePlugin from "tailwindcss-animate"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],

  theme: {
    // ─── Override default container ─────────────────────────────────
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
        xl: "2.5rem",
        "2xl": "3rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1440px",
      },
    },

    extend: {
      // ─── COLOR PALETTE ─────────────────────────────────────────────
      colors: {
        // ── Canvas & surfaces ──────────────────────────────────────
        "bg-deep": "#0A0A0A",
        "bg-surface": "#0D0D0D",
        "bg-panel": "#121212",
        "bg-elevated": "#1A1A1A",

        // ── Borders & dividers ─────────────────────────────────────
        border: "#262626",
        "border-subtle": "#1A1A1A",
        "border-bright": "#404040",

        // ── Accent — Crimson (primary) ─────────────────────────────
        cyan: {
          DEFAULT: "#E11D48",
          50: "#fff1f2",
          100: "#ffe4e6",
          200: "#fecdd3",
          300: "#fda4af",
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c",
          800: "#9f1239",
          900: "#881337",
          950: "#4c0519",
        },

        // ── Accent — Light crimson ─────────────────────────────────
        neon: {
          DEFAULT: "#BE123C",
          50: "#fff1f2",
          100: "#ffe4e6",
          200: "#fecdd3",
          300: "#fda4af",
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c",
          800: "#9f1239",
          900: "#881337",
        },

        // ── Accent — Deep crimson ──────────────────────────────────
        violet: {
          DEFAULT: "#BE123C",
          50: "#fff1f2",
          100: "#ffe4e6",
          200: "#fecdd3",
          300: "#fda4af",
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c",
          800: "#9f1239",
          900: "#881337",
          950: "#4c0519",
        },

        // ── Accent — Pink (alert / NEW) ────────────────────────────
        pink: {
          DEFAULT: "#E11D48",
          400: "#FB7185",
          500: "#E11D48",
          600: "#BE123C",
        },

        // ── Amber (warning) ────────────────────────────────────────
        amber: {
          DEFAULT: "#F43F5E",
          400: "#FB7185",
          500: "#F43F5E",
          600: "#BE123C",
        },

        // ── Text ──────────────────────────────────────────────────
        "text-primary": "#FFFFFF",
        "text-muted": "#D1D5DB",
        "text-faint": "#A1A1AA",
        "text-inverse": "#0A0A0A",

        // ── Semantic aliases ──────────────────────────────────────
        success: "#FB7185",
        warning: "#F43F5E",
        error: "#E11D48",
        info: "#E11D48",

        // ─── Radix/shadcn compat aliases ──────────────────────────
        background: "#0A0A0A",
        foreground: "#FFFFFF",
        card: {
          DEFAULT: "#121212",
          foreground: "#FFFFFF",
        },
        popover: {
          DEFAULT: "#121212",
          foreground: "#FFFFFF",
        },
        primary: {
          DEFAULT: "#E11D48",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#262626",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#1A1A1A",
          foreground: "#D1D5DB",
        },
        accent: {
          DEFAULT: "#1A1A1A",
          foreground: "#E11D48",
        },
        destructive: {
          DEFAULT: "#E11D48",
          foreground: "#ffffff",
        },
        input: "#262626",
        ring: "#E11D48",
      },

      // ─── TYPOGRAPHY ────────────────────────────────────────────────
      fontFamily: {
        display: ["Space Grotesk", ...fontFamily.sans],
        body: ["Inter", ...fontFamily.sans],
        mono: ["JetBrains Mono", ...fontFamily.mono],
        sans: ["Inter", ...fontFamily.sans],
      },

      fontSize: {
        // Fluid type scale using clamp()
        "hero-xl": ["clamp(2.5rem, 8vw, 6rem)", { lineHeight: "1.0", letterSpacing: "-0.02em", fontWeight: "800" }],
        "hero-lg": ["clamp(2rem, 5vw, 4rem)", { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "800" }],
        "section-h2": ["clamp(1.75rem, 4vw, 3rem)", { lineHeight: "1.1", letterSpacing: "-0.015em", fontWeight: "700" }],
        "section-h3": ["clamp(1.25rem, 2.5vw, 1.875rem)", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "700" }],
        "card-title": ["clamp(1rem, 2vw, 1.5rem)", { lineHeight: "1.3", fontWeight: "600" }],
        "body-lg": ["clamp(1rem, 1.5vw, 1.125rem)", { lineHeight: "1.7" }],
        body: ["clamp(0.875rem, 1.5vw, 1rem)", { lineHeight: "1.6" }],
        "body-sm": ["clamp(0.8125rem, 1.2vw, 0.875rem)", { lineHeight: "1.5" }],
        "micro": ["0.625rem", { lineHeight: "1.4", letterSpacing: "0.1em", fontWeight: "700" }],
      },

      // ─── SPACING SCALE ─────────────────────────────────────────────
      spacing: {
        "0.5": "0.125rem",   // 2px
        "1": "0.25rem",      // 4px
        "2": "0.5rem",       // 8px
        "3": "0.75rem",      // 12px
        "4": "1rem",         // 16px
        "6": "1.5rem",       // 24px
        "8": "2rem",         // 32px
        "12": "3rem",        // 48px
        "13": "3.25rem",     // 52px
        "16": "4rem",        // 64px
        "24": "6rem",        // 96px
        "32": "8rem",        // 128px
        "18": "4.5rem",
        "22": "5.5rem",
        "88": "22rem",
        "128": "32rem",
      },

      // ─── BORDER RADIUS ─────────────────────────────────────────────
      borderRadius: {
        none: "0",
        sm: "4px",
        DEFAULT: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "32px",
        full: "9999px",
      },

      // ─── BOX SHADOW / GLOW ─────────────────────────────────────────
      boxShadow: {
        sm: "0 1px 3px 0 rgba(0,0,0,0.4)",
        DEFAULT: "0 4px 12px 0 rgba(0,0,0,0.5)",
        md: "0 8px 24px 0 rgba(0,0,0,0.6)",
        lg: "0 16px 48px 0 rgba(0,0,0,0.7)",
        xl: "0 24px 64px 0 rgba(0,0,0,0.8)",

        // ── Cyan glow ────────────────────────────────────────────
        "glow-cyan-sm": "0 0 8px rgba(225, 29, 72,0.3), 0 0 16px rgba(225, 29, 72,0.15)",
        "glow-cyan": "0 0 16px rgba(225, 29, 72,0.4), 0 0 32px rgba(225, 29, 72,0.2), 0 0 64px rgba(225, 29, 72,0.1)",
        "glow-cyan-lg": "0 0 24px rgba(225, 29, 72,0.5), 0 0 48px rgba(225, 29, 72,0.3), 0 0 96px rgba(225, 29, 72,0.15)",

        // ── Neon glow ─────────────────────────────────────────────
        "glow-neon-sm": "0 0 8px rgba(251, 113, 133,0.3), 0 0 16px rgba(251, 113, 133,0.15)",
        "glow-neon": "0 0 16px rgba(251, 113, 133,0.4), 0 0 32px rgba(251, 113, 133,0.2)",
        "glow-neon-lg": "0 0 24px rgba(251, 113, 133,0.5), 0 0 48px rgba(251, 113, 133,0.3)",

        // ── Violet glow ───────────────────────────────────────────
        "glow-violet-sm": "0 0 8px rgba(190, 18, 60,0.3), 0 0 16px rgba(190, 18, 60,0.15)",
        "glow-violet": "0 0 16px rgba(190, 18, 60,0.4), 0 0 32px rgba(190, 18, 60,0.2)",
        "glow-violet-lg": "0 0 24px rgba(190, 18, 60,0.5), 0 0 48px rgba(190, 18, 60,0.3)",

        // ── Pink glow ─────────────────────────────────────────────
        "glow-pink": "0 0 16px rgba(225, 29, 72,0.4), 0 0 32px rgba(225, 29, 72,0.2)",

        // ── Card glow (hover) ──────────────────────────────────────
        "card-hover": "0 8px 32px rgba(225, 29, 72,0.1), 0 0 1px rgba(225, 29, 72,0.3)",

        // ── Glass ─────────────────────────────────────────────────
        glass: "inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.4)",
      },

      // ─── TRANSITIONS ───────────────────────────────────────────────
      transitionTimingFunction: {
        // Premium expo-out — all Framer Motion animations use this
        "expo-out": "cubic-bezier(0.16, 1, 0.3, 1)",
        "expo-in": "cubic-bezier(0.7, 0, 0.84, 0)",
        "expo-in-out": "cubic-bezier(0.87, 0, 0.13, 1)",
        "spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },

      transitionDuration: {
        "150": "150ms",
        "250": "250ms",
        "400": "400ms",
        "600": "600ms",
        "700": "700ms",
        "900": "900ms",
      },

      // ─── KEYFRAMES ─────────────────────────────────────────────────
      keyframes: {
        // Fade up — section reveal
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Fade in — simple opacity
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // Fade down — dropdown appear
        "fade-down": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },

        // Slide in from left
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },

        // Marquee scroll
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },

        // Scan line sweep
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },

        // Blob float
        "blob-float": {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.05)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.95)" },
        },

        // Live dot pulse
        "live-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(251, 113, 133, 0.7)" },
          "70%": { boxShadow: "0 0 0 10px rgba(251, 113, 133, 0)" },
        },

        // Pulse ring expand
        "ring-pulse": {
          "0%": { transform: "scale(1)", opacity: "0.8" },
          "100%": { transform: "scale(2.5)", opacity: "0" },
        },

        // Count up shimmer on stats
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },

        // Terminal cursor blink
        "cursor-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },

        // Accordion content open/close
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },

        // Glow pulse (continuous)
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 8px rgba(225, 29, 72,0.3)" },
          "50%": { boxShadow: "0 0 24px rgba(225, 29, 72,0.6), 0 0 48px rgba(225, 29, 72,0.3)" },
        },

        // Radar sweep
        "radar-sweep": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },

        // Number flip
        "flip-up": {
          "0%": { transform: "rotateX(-90deg)", opacity: "0" },
          "100%": { transform: "rotateX(0deg)", opacity: "1" },
        },
        "flip-down": {
          "0%": { transform: "rotateX(0deg)", opacity: "1" },
          "100%": { transform: "rotateX(90deg)", opacity: "0" },
        },
      },

      // ─── ANIMATION UTILITIES ───────────────────────────────────────
      animation: {
        "fade-up": "fade-up 0.9s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-up-slow": "fade-up 1.2s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in-slow": "fade-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-down": "fade-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        "slide-in-left": "slide-in-left 0.9s cubic-bezier(0.16, 1, 0.3, 1) both",
        marquee: "marquee 40s linear infinite",
        "marquee-fast": "marquee 20s linear infinite",
        "scan-line": "scan-line 6s linear infinite",
        "blob-float": "blob-float 18s ease-in-out infinite",
        "blob-float-delayed": "blob-float 22s ease-in-out infinite 4s",
        "blob-float-slow": "blob-float 28s ease-in-out infinite 8s",
        "live-pulse": "live-pulse 2s cubic-bezier(0, 0, 0.2, 1) infinite",
        "ring-pulse": "ring-pulse 2s cubic-bezier(0, 0, 0.2, 1) infinite",
        shimmer: "shimmer 3s linear infinite",
        "cursor-blink": "cursor-blink 1.1s step-end infinite",
        "accordion-down": "accordion-down 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "accordion-up": "accordion-up 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "radar-sweep": "radar-sweep 4s linear infinite",
      },

      // ─── BACKDROP BLUR ─────────────────────────────────────────────
      backdropBlur: {
        xs: "2px",
        sm: "4px",
        DEFAULT: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "40px",
        "3xl": "64px",
      },

      // ─── BACKGROUND ────────────────────────────────────────────────
      backgroundImage: {
        // Grid overlay — 60px squares at 4.5% opacity cyan
        "grid-overlay":
          "linear-gradient(rgba(225, 29, 72,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(225, 29, 72,0.045) 1px, transparent 1px)",

        // Gradient meshes
        "gradient-radial-cyan":
          "radial-gradient(ellipse at center, rgba(225, 29, 72,0.15) 0%, transparent 70%)",
        "gradient-radial-violet":
          "radial-gradient(ellipse at center, rgba(190, 18, 60,0.15) 0%, transparent 70%)",
        "gradient-radial-neon":
          "radial-gradient(ellipse at center, rgba(251, 113, 133,0.1) 0%, transparent 70%)",

        // Hero gradient
        "hero-gradient":
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(225, 29, 72,0.12) 0%, transparent 60%)",

        // Glass panel
        "glass-gradient":
          "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",

        // Shimmer
        "shimmer-gradient":
          "linear-gradient(90deg, transparent 0%, rgba(225, 29, 72,0.15) 50%, transparent 100%)",

        // Card border gradient
        "border-gradient-cyan":
          "linear-gradient(135deg, rgba(225, 29, 72,0.3), rgba(225, 29, 72,0.05), rgba(190, 18, 60,0.2))",
      },

      backgroundSize: {
        "grid-60": "60px 60px",
        "200%": "200% auto",
      },

      // ─── Z-INDEX ───────────────────────────────────────────────────
      zIndex: {
        "0": "0",
        "10": "10",
        "20": "20",
        "30": "30",
        "40": "40",
        "50": "50",
        "effects": "1",      // Matrix, blobs, grid
        "content": "10",     // Regular page content
        "sticky": "40",      // Sticky elements
        "navbar": "50",      // Navigation
        "drawer": "60",      // Sidebars / drawers
        "modal": "70",       // Modals
        "toast": "80",       // Toast notifications
        "cursor": "90",      // Custom cursor
        "scan-line": "100",  // Scan line overlay
      },

      // ─── SCREEN SIZES ─────────────────────────────────────────────
      screens: {
        xs: "375px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1440px",
        "3xl": "1920px",
        "4xl": "2560px",
      },

      // ─── GRID ──────────────────────────────────────────────────────
      gridTemplateColumns: {
        "bento-3": "repeat(3, 1fr)",
        "bento-4": "repeat(4, 1fr)",
        "auto-fill-280": "repeat(auto-fill, minmax(280px, 1fr))",
        "auto-fill-320": "repeat(auto-fill, minmax(320px, 1fr))",
        "auto-fill-360": "repeat(auto-fill, minmax(360px, 1fr))",
      },

      // ─── MIN/MAX HEIGHT ────────────────────────────────────────────
      minHeight: {
        screen: "100dvh",
        "16": "4rem",
        "24": "6rem",
        "32": "8rem",
      },

      maxWidth: {
        "8xl": "88rem",
        "9xl": "96rem",
      },
    },
  },

  plugins: [
    animatePlugin,

    // ─── Custom plugin: utility classes ──────────────────────────────
    function ({ addUtilities, addComponents }: PluginAPI) {
      // Glass morphism
      addComponents({
        ".glass": {
          background: "rgba(18, 18, 18, 0.6)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(38, 38, 38, 0.8)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
        },
        ".glass-strong": {
          background: "rgba(10, 10, 10, 0.8)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(225, 29, 72, 0.1)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.4)",
        },
        ".glass-panel": {
          background: "rgba(18, 18, 18, 0.7)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(38, 38, 38, 0.6)",
        },

        // Gradient border via pseudo-element
        ".gradient-border": {
          position: "relative",
          background: "#121212",
          "&::before": {
            content: '""',
            position: "absolute",
            inset: "0",
            borderRadius: "inherit",
            padding: "1px",
            background: "linear-gradient(135deg, rgba(225, 29, 72,0.3), rgba(225, 29, 72,0.05), rgba(190, 18, 60,0.2))",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            pointerEvents: "none",
          },
        },

        // Terminal text style
        ".text-terminal": {
          fontFamily: "'JetBrains Mono', monospace",
          color: "#E11D48",
          letterSpacing: "0.05em",
        },

        // Neon text glow
        ".text-glow-cyan": {
          textShadow: "0 0 10px rgba(225, 29, 72,0.5), 0 0 20px rgba(225, 29, 72,0.3), 0 0 40px rgba(225, 29, 72,0.15)",
        },
        ".text-glow-neon": {
          textShadow: "0 0 10px rgba(251, 113, 133,0.5), 0 0 20px rgba(251, 113, 133,0.3)",
        },
        ".text-glow-violet": {
          textShadow: "0 0 10px rgba(190, 18, 60,0.5), 0 0 20px rgba(190, 18, 60,0.3)",
        },
      })

      // Utility overrides
      addUtilities({
        ".scrollbar-hidden": {
          "-ms-overflow-style": "none",
          "scrollbar-width": "none",
        },
        ".scrollbar-hidden::-webkit-scrollbar": {
          display: "none",
        },
        ".text-balance": {
          "text-wrap": "balance",
        },
        ".text-pretty": {
          "text-wrap": "pretty",
        },
        ".hardware-accelerated": {
          transform: "translateZ(0)",
          willChange: "transform",
        },
        ".backface-hidden": {
          "backface-visibility": "hidden",
          "-webkit-backface-visibility": "hidden",
        },
      })
    },
  ],
} satisfies Config

export default config
