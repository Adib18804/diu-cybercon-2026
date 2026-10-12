// =============================================================================
// DIU CyberCon 2026 — Brand asset generator
//
// Renders the full favicon / PWA icon / social-card set from one vector
// definition, matching the Navbar brand mark (cyan `>_` terminal prompt on
// the site's deep-navy background).
//
// Usage:  node scripts/generate-brand-assets.mjs
//
// Outputs:
//   public/icons/favicon-16x16.png
//   public/icons/favicon-32x32.png
//   public/icons/apple-touch-icon.png          (180x180)
//   public/icons/android-chrome-192x192.png
//   public/icons/android-chrome-512x512.png
//   public/icons/maskable-icon.png             (512x512, safe-zone scaled)
//   public/icons/logo.png                      (512x512, JSON-LD logo)
//   public/icons/safari-pinned-tab.svg         (monochrome mask)
//   public/favicon.ico                         (16 + 32 + 48, PNG-embedded)
//   public/og-image.png                        (1200x630 Open Graph card)
// =============================================================================

import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import sharp from "sharp"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const iconsDir = path.join(root, "public", "icons")

const BG = "#05070d" // --bg-deep
const CYAN = "#00e5ff" // --cyan
const GREEN = "#39ff14" // --green
const TEXT = "#e6edf3" // --text-primary
const MUTED = "#9fb0c5" // --text-muted
const FAINT = "#8b9bb0"

const SANS = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
const MONO = "Consolas, 'Courier New', monospace"

// ─── The `>_` glyph (coordinate space: 512x512, already centered on 256,256) ──

const GLYPH_PATHS = `
  <path d="M 150 176 L 246 256 L 150 336" fill="none" stroke="${CYAN}"
        stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="268" y="318" width="96" height="36" rx="18" fill="${CYAN}"/>
`

/** Wrap the glyph in a scale-about-center transform. */
function glyph(scale) {
  return `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${GLYPH_PATHS}</g>`
}

/**
 * App icon — full-bleed background, rounded border, glyph.
 * `scale` controls glyph size; `bordered` toggles the rounded frame.
 */
function appIconSvg({ scale = 1.06, bordered = true } = {}) {
  const frame = bordered
    ? `<rect x="20" y="20" width="472" height="472" rx="96"
             fill="${CYAN}" fill-opacity="0.04"
             stroke="${CYAN}" stroke-opacity="0.45" stroke-width="10"/>`
    : ""

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="${BG}"/>
    ${frame}
    ${glyph(scale)}
  </svg>`
}

// ─── Safari pinned tab — monochrome, transparent, single-colour mask ─────────

const safariPinnedTabSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <g transform="translate(256 256) scale(0.8) translate(-256 -256)">
    <path d="M 150 176 L 246 256 L 150 336" fill="none" stroke="#000"
          stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="268" y="318" width="96" height="36" rx="18" fill="#000"/>
  </g>
</svg>`

// ─── Open Graph card — 1200x630 ───────────────────────────────────────────────

function ogImageSvg() {
  const gridStep = 60
  const grid = []
  for (let x = gridStep; x < 1200; x += gridStep) {
    grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="630" stroke="${CYAN}" stroke-opacity="0.05" stroke-width="1"/>`)
  }
  for (let y = gridStep; y < 630; y += gridStep) {
    grid.push(`<line x1="0" y1="${y}" x2="1200" y2="${y}" stroke="${CYAN}" stroke-opacity="0.05" stroke-width="1"/>`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="0.5" cy="0.38" r="0.62">
      <stop offset="0%" stop-color="${CYAN}" stop-opacity="0.16"/>
      <stop offset="60%" stop-color="${CYAN}" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="${CYAN}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${CYAN}"/>
      <stop offset="55%" stop-color="${GREEN}"/>
      <stop offset="100%" stop-color="${CYAN}" stop-opacity="0.2"/>
    </linearGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${CYAN}"/>
      <stop offset="100%" stop-color="${GREEN}"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="${BG}"/>
  ${grid.join("\n  ")}
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- Terminal watermark -->
  <g opacity="0.07">
    <g transform="translate(935 320) scale(2.4) translate(-256 -256)">
      <path d="M 150 176 L 246 256 L 150 336" fill="none" stroke="${CYAN}"
            stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="268" y="318" width="96" height="36" rx="18" fill="${CYAN}"/>
    </g>
  </g>

  <!-- Corner brackets -->
  <g stroke="${CYAN}" stroke-opacity="0.35" stroke-width="3" fill="none">
    <path d="M 48 96 L 48 48 L 96 48"/>
    <path d="M 1104 48 L 1152 48 L 1152 96"/>
    <path d="M 48 534 L 48 582 L 96 582"/>
    <path d="M 1152 534 L 1152 582 L 1104 582"/>
  </g>

  <!-- Club chip -->
  <rect x="80" y="56" width="40" height="40" rx="9"
        fill="${CYAN}" fill-opacity="0.05" stroke="${CYAN}" stroke-opacity="0.45" stroke-width="2"/>
  <g>
    <g transform="translate(100 76) scale(0.052) translate(-256 -256)">
      <path d="M 150 176 L 246 256 L 150 336" fill="none" stroke="${CYAN}"
            stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="268" y="318" width="96" height="36" rx="18" fill="${CYAN}"/>
    </g>
  </g>
  <text x="136" y="84" font-family="${MONO}" font-size="20" font-weight="600"
        letter-spacing="3" fill="${FAINT}">CYBER SECURITY CLUB — DAFFODIL INTERNATIONAL UNIVERSITY</text>

  <!-- Title -->
  <text x="78" y="240" font-family="${SANS}" font-size="94" font-weight="800"
        fill="${TEXT}">DIU CYBERCON 2026</text>

  <!-- Tagline -->
  <text x="80" y="304" font-family="${MONO}" font-size="30" font-weight="700"
        letter-spacing="12" fill="${CYAN}">LEARN · SECURE · DEFEND</text>

  <!-- Divider -->
  <rect x="80" y="348" width="240" height="4" rx="2" fill="url(#rule)"/>

  <!-- Event lines -->
  <text x="80" y="428" font-family="${MONO}" font-size="26" fill="${MUTED}">CTF PRELIMS — 24 OCT 2026 · ONLINE</text>
  <text x="80" y="476" font-family="${MONO}" font-size="26" fill="${MUTED}">MAIN EVENT — 14–15 NOV 2026 · DAFFODIL SMART CITY, DHAKA</text>

  <!-- Site -->
  <text x="1128" y="560" font-family="${MONO}" font-size="24" font-weight="700"
        letter-spacing="2" fill="${CYAN}" text-anchor="end">diucybercon.com</text>

  <!-- Bottom accent -->
  <rect x="0" y="624" width="1200" height="6" fill="url(#bar)"/>
</svg>`
}

// ─── ICO container (Vista+ PNG-embedded format) ───────────────────────────────

function icoFromPngs(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(entries.length, 4)

  const dir = []
  let offset = 6 + 16 * entries.length
  for (const { size, buf } of entries) {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0) // width
    e.writeUInt8(size >= 256 ? 0 : size, 1) // height
    e.writeUInt8(0, 2) // palette
    e.writeUInt8(0, 3) // reserved
    e.writeUInt16LE(1, 4) // colour planes
    e.writeUInt16LE(32, 6) // bits per pixel
    e.writeUInt32LE(buf.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += buf.length
    dir.push(e)
  }

  return Buffer.concat([header, ...dir, ...entries.map((e) => e.buf)])
}

// ─── Render everything ────────────────────────────────────────────────────────

async function renderPng(svg, size) {
  return sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

async function main() {
  await mkdir(iconsDir, { recursive: true })

  const bordered = appIconSvg({ scale: 1.06, bordered: true })
  const plain = appIconSvg({ scale: 1.15, bordered: false })
  const maskable = appIconSvg({ scale: 0.72, bordered: false })

  const targets = [
    { file: "favicon-16x16.png", size: 16, svg: bordered },
    { file: "favicon-32x32.png", size: 32, svg: bordered },
    { file: "apple-touch-icon.png", size: 180, svg: plain },
    { file: "android-chrome-192x192.png", size: 192, svg: bordered },
    { file: "android-chrome-512x512.png", size: 512, svg: bordered },
    { file: "maskable-icon.png", size: 512, svg: maskable },
    { file: "logo.png", size: 512, svg: bordered },
  ]

  for (const { file, size, svg } of targets) {
    const buf = await renderPng(svg, size)
    await writeFile(path.join(iconsDir, file), buf)
    console.log(`✓ public/icons/${file} (${size}x${size}, ${buf.length} bytes)`)
  }

  // Safari pinned tab — plain SVG file
  await writeFile(path.join(iconsDir, "safari-pinned-tab.svg"), safariPinnedTabSvg)
  console.log(`✓ public/icons/safari-pinned-tab.svg`)

  // favicon.ico — 16 + 32 + 48 embedded PNGs
  const icoEntries = []
  for (const size of [16, 32, 48]) {
    icoEntries.push({ size, buf: await renderPng(bordered, size) })
  }
  await writeFile(path.join(root, "public", "favicon.ico"), icoFromPngs(icoEntries))
  console.log(`✓ public/favicon.ico (16+32+48)`)

  // Open Graph card
  const og = await sharp(Buffer.from(ogImageSvg()), { density: 96 })
    .png({ compressionLevel: 9 })
    .toBuffer()
  await writeFile(path.join(root, "public", "og-image.png"), og)
  console.log(`✓ public/og-image.png (1200x630, ${og.length} bytes)`)
}

main().catch((err) => {
  console.error("Asset generation failed:", err)
  process.exit(1)
})
