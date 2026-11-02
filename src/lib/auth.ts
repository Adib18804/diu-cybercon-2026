// =============================================================================
// DIU_CYBERCON 2026 — NextAuth v5 (Auth.js) Configuration
// =============================================================================

import { PrismaAdapter } from "@auth/prisma-adapter"
import type { AdminRole, UserRole } from "@prisma/client"
import argon2 from "argon2"
import NextAuth, { CredentialsSignin } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

import { auditLog } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { checkRateLimit } from "@/lib/security/rate-limit"
import { SESSION_COOKIE_NAME, USE_SECURE_SESSION_COOKIE } from "@/lib/session-cookie"

// =============================================================================
// Sign-in error codes
// CredentialsSignin subclasses — the `code` is surfaced to the client as
// `result.code` in signIn({ redirect: false }). Plain Error throws are NOT
// client-safe in @auth/core and surface as a generic "Configuration" error.
// =============================================================================

class SuspendedAccountError extends CredentialsSignin {
  override code = "ACCOUNT_SUSPENDED"
}

class EmailNotVerifiedError extends CredentialsSignin {
  override code = "EMAIL_NOT_VERIFIED"
}

class LoginRateLimitedError extends CredentialsSignin {
  override code = "RATE_LIMITED"
}

// =============================================================================
// Auth configuration
// =============================================================================

export const { handlers, auth, signIn, signOut } = NextAuth({
  // ── Adapter ────────────────────────────────────────────────────────────────
  adapter: PrismaAdapter(prisma),

  // ── Session strategy: JWT (edge-compatible, no DB lookup per request) ──────
  session: {
    strategy: "jwt",
    maxAge: Number(process.env.AUTH_SESSION_MAX_AGE) || 7 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60, // Re-issue token once per day if active
  },

  // ── JWT ────────────────────────────────────────────────────────────────────
  jwt: {
    maxAge: Number(process.env.AUTH_SESSION_MAX_AGE) || 7 * 24 * 60 * 60,
  },

  // ── Pages ──────────────────────────────────────────────────────────────────
  pages: {
    signIn:  "/login",
    signOut: "/",
    error:   "/login",
    verifyRequest: "/verify-email",
    newUser: "/dashboard",
  },

  // ── Providers ──────────────────────────────────────────────────────────────
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials, request) {
        // ── Input validation ─────────────────────────────────────────────────
        if (
          !credentials?.email ||
          !credentials?.password ||
          typeof credentials.email !== "string" ||
          typeof credentials.password !== "string"
        ) {
          return null
        }

        const email = credentials.email.toLowerCase().trim()
        const password = credentials.password

        // ── Rate limit — login attempts per IP (5 / 15 min) ─────────────────
        const ip =
          (request?.headers as Headers | undefined)
            ?.get("x-forwarded-for")
            ?.split(",")[0]
            ?.trim() ?? "unknown"

        const rate = await checkRateLimit("login", ip)
        if (!rate.success) {
          throw new LoginRateLimitedError()
        }

        // ── Fetch user ───────────────────────────────────────────────────────
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            role: true,
            adminRole: true,
            isSuspended: true,
            emailVerified: true,
            deletedAt: true,
          },
        })

        // User not found — use constant-time comparison to prevent enumeration
        if (!user || !user.passwordHash) {
          // Perform a dummy hash to prevent timing attacks
          await argon2.hash("dummy-timing-prevention")
          return null
        }

        // ── Verify password ──────────────────────────────────────────────────
        let passwordValid = false
        try {
          passwordValid = await argon2.verify(user.passwordHash, password)
        } catch {
          return null
        }

        if (!passwordValid) {return null}

        // ── Soft-deleted account — treat as non-existent ─────────────────────
        if (user.deletedAt) {return null}

        // ── Suspended account ────────────────────────────────────────────────
        if (user.isSuspended) {
          throw new SuspendedAccountError()
        }

        // ── Email not verified ───────────────────────────────────────────────
        if (!user.emailVerified) {
          throw new EmailNotVerifiedError()
        }

        // ── Audit log ────────────────────────────────────────────────────────
        void auditLog({
          actorId:    user.id,
          action:     "USER_LOGIN",
          targetType: "User",
          targetId:   user.id,
          ipAddress:  ip,
          userAgent:  (request?.headers as Headers | undefined)?.get("user-agent") ?? undefined,
        })

        return {
          id:            user.id,
          email:         user.email,
          name:          user.name ?? "",
          role:          user.role,
          adminRole:     user.adminRole,
          isSuspended:   user.isSuspended,
          emailVerified: user.emailVerified,
        }
      },
    }),
  ],

  // ── Callbacks ──────────────────────────────────────────────────────────────
  callbacks: {
    /**
     * jwt callback — runs when token is created/updated
     * Embed custom fields so we avoid DB lookups on every request
     */
    async jwt({ token, user, trigger }) {
      // Initial sign-in — attach user fields to token
      if (user) {
        token.id          = user.id
        token.role        = (user as { role: UserRole }).role
        token.adminRole   = (user as { adminRole: AdminRole | null }).adminRole ?? null
        token.isSuspended = (user as { isSuspended: boolean }).isSuspended ?? false
        // Store as epoch ms — Date objects don't survive JWT serialization
        const verified = (user as { emailVerified?: Date | null }).emailVerified
        token.emailVerified = verified instanceof Date ? verified.getTime() : null
      }

      // Session update trigger — re-fetch latest user state from DB
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            role: true,
            adminRole: true,
            isSuspended: true,
            emailVerified: true,
            deletedAt: true,
          },
        })
        if (!fresh || fresh.deletedAt) {return null}
        token.role = fresh.role
        token.adminRole = fresh.adminRole ?? null
        token.isSuspended = fresh.isSuspended
        token.lastChecked = Date.now()
      }

      // ── Periodic freshness check ──────────────────────────────────────────
      // At most once per minute per token: a suspension / role change becomes
      // effective within ~60s instead of waiting for JWT expiry (up to 7
      // days), and soft-deleted accounts are signed out immediately.
      if (!user && trigger !== "update" && token.id) {
        const nowMs = Date.now()
        const lastChecked =
          typeof token.lastChecked === "number" ? token.lastChecked : 0
        if (nowMs - lastChecked > 60_000) {
          const fresh = await prisma.user.findUnique({
            where: { id: token.id },
            select: {
              role: true,
              adminRole: true,
              isSuspended: true,
              deletedAt: true,
            },
          })
          if (!fresh || fresh.deletedAt) {return null}
          token.role = fresh.role
          token.adminRole = fresh.adminRole ?? null
          token.isSuspended = fresh.isSuspended
          token.lastChecked = nowMs
        }
      }

      return token
    },

    /**
     * session callback — shapes what client.useSession() sees
     * Never expose the full token — only explicit fields
     */
    session({ session, token }) {
      if (session.user) {
        session.user.id          = token.id
        session.user.role        = token.role
        session.user.adminRole   = (token.adminRole) ?? null
        session.user.isSuspended = token.isSuspended
        session.user.emailVerified =
          typeof token.emailVerified === "number"
            ? new Date(token.emailVerified)
            : null
      }
      return session
    },
  },

  // ── Events ─────────────────────────────────────────────────────────────────
  events: {
    // NextAuth v5 types this callback as a union — narrow before accessing token
    signOut(message) {
      const token = "token" in message ? message.token : null
      if (token?.id) {
        void auditLog({
          actorId:    token.id,
          action:     "USER_LOGOUT",
          targetType: "User",
          targetId:   token.id,
        })
      }
    },
  },

  // ── Security ───────────────────────────────────────────────────────────────
  cookies: {
    sessionToken: {
      name: SESSION_COOKIE_NAME,
      options: {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        secure: USE_SECURE_SESSION_COOKIE,
      },
    },
  },

  // ── Debug (dev only) ───────────────────────────────────────────────────────
  debug: process.env.NODE_ENV === "development",

  trustHost: true,
})
