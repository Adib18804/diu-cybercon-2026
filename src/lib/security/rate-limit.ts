// =============================================================================
// DIU_CYBERCON 2026 — Rate Limiting
// Uses rate-limiter-flexible with Redis (production) or in-memory (dev).
// =============================================================================

import type { Redis as RedisClient } from "ioredis"
import { NextResponse } from "next/server"
import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible"

import { RATE_LIMIT } from "@/lib/constants"

// ─── Redis client (lazy init) ─────────────────────────────────────────────────

let redisClient: RedisClient | null = null

async function getRedisClient(): Promise<RedisClient | null> {
  if (!process.env.REDIS_URL) {return null}

  if (redisClient) {return redisClient}

  try {
    // Dynamic import to avoid bundling ioredis on the client
    const { default: Redis } = await import("ioredis")
    redisClient = new Redis(process.env.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    })

    redisClient.on("error", (err: Error) => {
      // Don't crash — fall back to memory
      console.error("[RateLimit] Redis error:", err.message)
      redisClient = null
    })

    await redisClient.connect()
    return redisClient
  } catch {
    console.warn("[RateLimit] Redis unavailable — using in-memory fallback")
    return null
  }
}

// ─── Limiter factory ─────────────────────────────────────────────────────────

type LimiterConfig = {
  points: number
  durationSeconds: number
  blockDurationSeconds: number
  keyPrefix: string
}

async function createLimiter(config: LimiterConfig) {
  const redis = await getRedisClient()

  if (redis) {
    return new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: config.keyPrefix,
      points: config.points,
      duration: config.durationSeconds,
      blockDuration: config.blockDurationSeconds,
    })
  }

  return new RateLimiterMemory({
    keyPrefix: config.keyPrefix,
    points: config.points,
    duration: config.durationSeconds,
    blockDuration: config.blockDurationSeconds,
  })
}

// ─── Singleton limiters (lazy init per route) ─────────────────────────────────

const limiters = new Map<string, RateLimiterMemory | RateLimiterRedis>()

async function getLimiter(
  name: string,
  config: Omit<LimiterConfig, "keyPrefix">,
): Promise<RateLimiterMemory | RateLimiterRedis> {
  if (!limiters.has(name)) {
    const limiter = await createLimiter({ ...config, keyPrefix: `rl:${name}` })
    limiters.set(name, limiter)
  }
  return limiters.get(name)!
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type RateLimitResult =
  | { success: true; remainingPoints: number }
  | { success: false; msBeforeNext: number; retryAfter: number }

/**
 * Check and consume rate limit points for a given key.
 * @param limiterName  One of the keys in RATE_LIMIT constant
 * @param key          Unique key to rate-limit (IP address, userId, email)
 */
export async function checkRateLimit(
  limiterName: keyof typeof RATE_LIMIT,
  key: string,
): Promise<RateLimitResult> {
  try {
    const config = RATE_LIMIT[limiterName]
    const limiter = await getLimiter(limiterName, config)

    const result = await limiter.consume(key)
    return {
      success: true,
      remainingPoints: result.remainingPoints,
    }
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      return {
        success: false,
        msBeforeNext: error.msBeforeNext,
        retryAfter: Math.ceil(error.msBeforeNext / 1000),
      }
    }
    // If rate limiter itself fails — fail open (don't block the request)
    console.error("[RateLimit] Limiter error:", error)
    return { success: true, remainingPoints: 0 }
  }
}

/**
 * Build a standard rate-limit-exceeded Response.
 */
export function rateLimitExceededResponse(retryAfter: number): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: "Too many requests. Please wait a moment and try again.",
      code: "RATE_LIMITED",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": "exceeded",
      },
    },
  )
}
