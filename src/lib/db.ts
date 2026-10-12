// =============================================================================
// Prisma Client — Singleton
// Prevents multiple client instances during hot-reload in development.
// =============================================================================

import { PrismaClient } from "@prisma/client"

// Extend globalThis type to hold our prisma instance
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    errorFormat: process.env.NODE_ENV === "development" ? "pretty" : "minimal",
  })
}

// In production: always create a new instance.
// In development: reuse the global instance to avoid hitting connection limits.
const prisma: PrismaClient =
  process.env.NODE_ENV === "production"
    ? createPrismaClient()
    : (globalThis.__prisma ?? (globalThis.__prisma = createPrismaClient()))

export default prisma
export { prisma }
