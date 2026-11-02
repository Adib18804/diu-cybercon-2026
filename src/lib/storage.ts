// =============================================================================
// DIU_CYBERCON 2026 — File Storage
// Two storage tiers with one shared token machinery:
//
// PRIVATE (student IDs, sensitive):
// - Files live in `.private-storage/` OUTSIDE the public/ directory.
//   They are never web-accessible directly — only through the signed,
//   permission-checked API route that logs every access.
// - Storage keys never contain user identifiers (UUID filenames only).
// - Signed view URLs expire in ≤ 5 minutes (SIGNED_URL.ttlSeconds).
//
// PUBLIC (submission assets — project images, presentations, posters):
// - Files live in `public/uploads/<folder>/` and are served statically.
//   No PII — but still UUID-named, HMAC-token-gated while staged.
//
// BOTH:
// - Upload tokens (wizard/forms staging) are HMAC-SHA256 signed and expiring,
//   bound to one user, and verified against the matching storage root.
// - All key inputs are validated against path traversal + folder whitelists.
//
// PRODUCTION NOTE: swap savePrivateUpload/readPrivateFile for a private cloud
// bucket and savePublicUpload for a public bucket/CDN (e.g. Cloudinary or S3).
// The signed-token + signed-URL contract stays identical.
// =============================================================================

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"

import { SIGNED_URL } from "@/lib/constants"

// ─── Config ───────────────────────────────────────────────────────────────────

const STORAGE_ROOT = path.join(process.cwd(), ".private-storage")

export type PrivateStorageCategory = "student-ids"

const PRIVATE_FOLDERS: Record<PrivateStorageCategory, string> = {
  "student-ids": "student-ids",
}

/** Upload-token TTL — staging window between upload and final submit (3h). */
const UPLOAD_TOKEN_TTL_SECONDS = 3 * 60 * 60

// ─── Signing secret ───────────────────────────────────────────────────────────

function getSigningSecret(): string {
  const secret =
    process.env.STORAGE_SIGNING_SECRET ?? process.env.AUTH_SECRET ?? ""
  if (secret.length < 32) {
    throw new Error(
      "STORAGE_SIGNING_SECRET (or AUTH_SECRET) is missing or too short (min 32 chars)",
    )
  }
  return secret
}

function hmacHex(data: string): string {
  return createHmac("sha256", getSigningSecret()).update(data).digest("hex")
}

/** Constant-time string comparison — never use === for signatures. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8")
  const bufB = Buffer.from(b, "utf8")
  if (bufA.length !== bufB.length) {return false}
  return timingSafeEqual(bufA, bufB)
}

// ─── Key safety ───────────────────────────────────────────────────────────────

const SAFE_KEY_PATTERN = new RegExp(
  `^(${Object.values(PRIVATE_FOLDERS).join("|")})/[a-z0-9]+\\.(webp|jpg|jpeg|png|pdf)$`,
)

/**
 * A storage key is safe when it matches `<folder>/<uuid>.<ext>` for a known
 * private folder, with no path separators beyond it and no traversal.
 */
function isSafeStorageKey(key: string): boolean {
  if (!key || key.length > 200) {return false}
  if (key.includes("..") || key.includes("\\")) {return false}
  if (!SAFE_KEY_PATTERN.test(key)) {return false}
  const resolved = path.resolve(STORAGE_ROOT, key)
  return resolved.startsWith(STORAGE_ROOT + path.sep)
}

// ─── Write / Read / Delete ────────────────────────────────────────────────────

/**
 * Persist a buffer in private storage. Returns an opaque storage key.
 * Filenames are random UUIDs — no user identifiers, no client-controlled names.
 */
export async function savePrivateUpload(
  buffer: Buffer,
  category: PrivateStorageCategory,
  extension: "webp" | "jpg" | "jpeg" | "png" | "pdf" = "webp",
): Promise<{ key: string; sizeBytes: number }> {
  const folder = PRIVATE_FOLDERS[category]
  const dir = path.join(STORAGE_ROOT, folder)
  await mkdir(dir, { recursive: true })

  const safeExt = extension.replace(/[^a-z]/gi, "").toLowerCase()
  const filename = `${randomUUID().replace(/-/g, "")}.${safeExt}`
  const key = `${folder}/${filename}`

  // 0o600 — owner read/write only
  await writeFile(path.join(dir, filename), buffer, { mode: 0o600 })

  return { key, sizeBytes: buffer.length }
}

/**
 * Read a file from private storage. Returns null when the key is unsafe
 * or the file does not exist.
 */
export async function readPrivateFile(key: string): Promise<Buffer | null> {
  if (!isSafeStorageKey(key)) {return null}
  try {
    return await readFile(path.join(STORAGE_ROOT, key))
  } catch {
    return null
  }
}

/**
 * Delete a file from private storage (cleanup of abandoned uploads).
 * Silently ignores missing files.
 */
export async function deletePrivateFile(key: string): Promise<boolean> {
  if (!isSafeStorageKey(key)) {return false}
  try {
    await rm(path.join(STORAGE_ROOT, key))
    return true
  } catch {
    return false
  }
}

/**
 * Check whether a private file still exists on disk (no full read).
 */
export async function privateFileExists(key: string): Promise<boolean> {
  if (!isSafeStorageKey(key)) {return false}
  try {
    await stat(path.join(STORAGE_ROOT, key))
    return true
  } catch {
    return false
  }
}

// ─── Signed upload tokens (wizard staging) ────────────────────────────────────

type UploadTokenPayload = {
  /** storage key */
  k: string
  /** owner userId — token is bound to one user */
  u: string
  /** expiry — unix seconds */
  e: number
  /** stored file size in bytes */
  s: number
}

/**
 * Create a signed upload token so the wizard can reference a staged upload
 * at final submit time without trusting the client with the raw key alone.
 * Format: base64url(payload).hmacHex
 */
export function createSignedUploadToken({
  key,
  userId,
  sizeBytes,
}: {
  key: string
  userId: string
  sizeBytes: number
}): string {
  const payload: UploadTokenPayload = {
    k: key,
    u: userId,
    e: Math.floor(Date.now() / 1000) + UPLOAD_TOKEN_TTL_SECONDS,
    s: Math.max(0, Math.floor(sizeBytes)),
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  )
  return `${payloadB64}.${hmacHex(payloadB64)}`
}

/**
 * Verify an upload token for a specific user against a key-safety predicate.
 * Returns the storage key + size when valid, otherwise null.
 */
function verifyTokenInternal(
  token: string,
  userId: string,
  keyIsSafe: (key: string) => boolean,
): { key: string; sizeBytes: number } | null {
  if (!token || token.length > 2048) {return null}

  const dotIndex = token.lastIndexOf(".")
  if (dotIndex <= 0) {return null}

  const payloadB64 = token.slice(0, dotIndex)
  const signature = token.slice(dotIndex + 1)

  const expected = hmacHex(payloadB64)
  if (!safeEqual(signature, expected)) {return null}

  let payload: UploadTokenPayload
  try {
    payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as UploadTokenPayload
  } catch {
    return null
  }

  if (payload.u !== userId) {return null}
  if (typeof payload.e !== "number" || payload.e * 1000 < Date.now()) {
    return null
  }
  if (typeof payload.k !== "string" || !keyIsSafe(payload.k)) {
    return null
  }

  return {
    key: payload.k,
    sizeBytes: typeof payload.s === "number" && payload.s > 0 ? payload.s : 0,
  }
}

/** Verify a PRIVATE-storage upload token (student IDs). */
export function verifySignedUploadToken(
  token: string,
  userId: string,
): { key: string; sizeBytes: number } | null {
  return verifyTokenInternal(token, userId, isSafeStorageKey)
}

/** Verify a PUBLIC-storage upload token (submission assets). */
export function verifySignedPublicUploadToken(
  token: string,
  userId: string,
): { key: string; sizeBytes: number } | null {
  return verifyTokenInternal(token, userId, isSafePublicKey)
}

/**
 * Verify an upload token AND confirm the staged file still exists on disk.
 * Guards against stale tokens whose file was deleted (e.g. a member removed
 * from a team) being replayed into a new registration row.
 */
export async function verifySignedUploadTokenWithFile(
  token: string,
  userId: string,
): Promise<{ key: string; sizeBytes: number } | null> {
  const payload = verifySignedUploadToken(token, userId)
  if (!payload) {return null}
  if (!(await privateFileExists(payload.key))) {return null}
  return payload
}

// ─── Signed view URLs (admin document access) ─────────────────────────────────

/**
 * Create a signed relative URL for viewing a verification document.
 * TTL defaults to SIGNED_URL.ttlSeconds (max 5 minutes per spec).
 */
export function createSignedViewUrl(
  verificationId: string,
  ttlSeconds: number = SIGNED_URL.ttlSeconds,
): string {
  const ttl = Math.min(ttlSeconds, 300) // hard cap: 5 minutes
  const exp = Math.floor(Date.now() / 1000) + ttl
  const sig = hmacHex(`view:${verificationId}:${exp}`)
  return `/api/files/verification/${verificationId}?exp=${exp}&sig=${sig}`
}

/**
 * Verify the signature + expiry for a signed view URL.
 */
export function verifyViewSignature(
  verificationId: string,
  exp: number,
  sig: string,
): boolean {
  if (!Number.isFinite(exp) || !sig) {return false}
  if (exp * 1000 < Date.now()) {return false}
  const expected = hmacHex(`view:${verificationId}:${exp}`)
  return safeEqual(sig, expected)
}

// ─── Public uploads (submission assets — non-sensitive) ──────────────────────
// Project images, presentation files, and poster files contain no PII —
// unlike student IDs, which never leave private storage. They live under
// `public/uploads/<folder>/` and are served as static files.
//
// SECURITY:
// - Same hardening as private uploads: HMAC-signed user-bound tokens,
//   UUID filenames, extension/MIME/magic-byte/size validation (in the route),
//   Sharp re-encoding for all raster images (EXIF stripped).
// - Keys are strictly scoped to the three known folders below.
//
// PRODUCTION NOTE: swap for a cloud bucket/CDN — the key + token contract
// stays identical.

const PUBLIC_ROOT = path.join(process.cwd(), "public", "uploads")

export type PublicStorageFolder =
  | "projects"
  | "posters"
  | "presentations"
  // Admin-managed public imagery (logos, photos, gallery). Raster only —
  // SVG is deliberately NOT allowed anywhere (script-injection vector).
  | "gallery"
  | "sponsors"
  | "speakers"
  | "partners"

const SAFE_PUBLIC_KEY_PATTERN =
  /^(projects|posters|presentations|gallery|sponsors|speakers|partners)\/[a-z0-9]+\.(webp|jpg|jpeg|png|pdf)$/

function isSafePublicKey(key: string): boolean {
  if (!key || key.length > 200) {return false}
  if (key.includes("..") || key.includes("\\")) {return false}
  if (!SAFE_PUBLIC_KEY_PATTERN.test(key)) {return false}
  const resolved = path.resolve(PUBLIC_ROOT, key)
  return resolved.startsWith(PUBLIC_ROOT + path.sep)
}

/** Public URL for a safe key, or null when the key is unsafe. */
export function publicUrlForKey(key: string): string | null {
  return isSafePublicKey(key) ? `/uploads/${key}` : null
}

/**
 * Persist a buffer in public storage. Returns an opaque key + its public URL.
 * Filenames are random UUIDs — no user identifiers, no client-controlled names.
 */
export async function savePublicUpload(
  buffer: Buffer,
  folder: PublicStorageFolder,
  extension: "webp" | "jpg" | "jpeg" | "png" | "pdf" = "webp",
): Promise<{ key: string; sizeBytes: number; url: string }> {
  const dir = path.join(PUBLIC_ROOT, folder)
  await mkdir(dir, { recursive: true })

  const safeExt = extension.replace(/[^a-z]/gi, "").toLowerCase()
  const filename = `${randomUUID().replace(/-/g, "")}.${safeExt}`
  const key = `${folder}/${filename}`

  await writeFile(path.join(dir, filename), buffer, { mode: 0o644 })

  return { key, sizeBytes: buffer.length, url: `/uploads/${key}` }
}

/** Read a public file's bytes — null when the key is unsafe or missing. */
export async function readPublicFile(key: string): Promise<Buffer | null> {
  if (!isSafePublicKey(key)) {return null}
  try {
    return await readFile(path.join(PUBLIC_ROOT, key))
  } catch {
    return null
  }
}

/** Check whether a public file still exists on disk (no full read). */
export async function publicFileExists(key: string): Promise<boolean> {
  if (!isSafePublicKey(key)) {return false}
  try {
    await stat(path.join(PUBLIC_ROOT, key))
    return true
  } catch {
    return false
  }
}

/** Delete a public file (best-effort cleanup of replaced uploads). */
export async function deletePublicFile(key: string): Promise<boolean> {
  if (!isSafePublicKey(key)) {return false}
  try {
    await rm(path.join(PUBLIC_ROOT, key))
    return true
  } catch {
    return false
  }
}

/**
 * Verify a PUBLIC upload token AND confirm the staged file still exists.
 * Mirrors verifySignedUploadTokenWithFile for the public storage root.
 */
export async function verifySignedPublicUploadTokenWithFile(
  token: string,
  userId: string,
): Promise<{ key: string; sizeBytes: number } | null> {
  const payload = verifySignedPublicUploadToken(token, userId)
  if (!payload) {return null}
  if (!(await publicFileExists(payload.key))) {return null}
  return payload
}
