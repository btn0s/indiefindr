#!/usr/bin/env npx tsx

/**
 * Build-time OG image generator for the homepage.
 *
 * Creates `public/og/home.png` (1200x630) using real Steam capsule/header images.
 * This avoids runtime DB/remote fetch latency for social crawlers (Twitter/Slack).
 */

import { createClient } from "@supabase/supabase-js";
import { config as loadDotEnv } from "dotenv";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import sharp from "sharp";

loadDotEnv({ path: [".env.local"] });

const OUT_DIR = path.join(process.cwd(), "public", "og");
const OUT_FILE = path.join(OUT_DIR, "home.png");

const WIDTH = 1200;
const HEIGHT = 630;

const TILE_W = 350;
const TILE_H = 200;
const GAP = 16;
const RADIUS = 18;

const FALLBACK_APPIDS = [
  413150, // Stardew Valley
  367520, // Hollow Knight
  588650, // Dead Cells
  646570, // Slay the Spire
  504230, // Celeste
  1145360, // Hades
];

type Row = {
  appid: number;
  suggested_game_appids: unknown;
  created_at: string;
};

function steamCapsuleUrl(appid: number) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/capsule_616x353.jpg`;
}

function steamHeaderUrl(appid: number) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

async function fetchBuffer(url: string, timeoutMs = 2500): Promise<Buffer | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function backgroundSvg() {
  return `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="g1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(240 40) rotate(35) scale(900 700)">
      <stop offset="0" stop-color="rgba(124,58,237,0.22)"/>
      <stop offset="1" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <radialGradient id="g2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1180 220) rotate(10) scale(900 700)">
      <stop offset="0" stop-color="rgba(34,211,238,0.16)"/>
      <stop offset="1" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <radialGradient id="g3" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(780 700) rotate(-10) scale(900 650)">
      <stop offset="0" stop-color="rgba(251,191,36,0.10)"/>
      <stop offset="1" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="#070708"/>
  <rect width="100%" height="100%" fill="url(#g1)"/>
  <rect width="100%" height="100%" fill="url(#g2)"/>
  <rect width="100%" height="100%" fill="url(#g3)"/>
</svg>
`.trim();
}

function placeholderTileSvg() {
  return `
<svg width="${TILE_W}" height="${TILE_H}" viewBox="0 0 ${TILE_W} ${TILE_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="p" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#131316"/>
      <stop offset="1" stop-color="#0b0b0c"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" rx="${RADIUS}" ry="${RADIUS}" fill="url(#p)"/>
  <rect x="0.5" y="0.5" width="${TILE_W - 1}" height="${TILE_H - 1}" rx="${RADIUS}" ry="${RADIUS}" fill="none" stroke="rgba(255,255,255,0.10)"/>
</svg>
`.trim();
}

async function makeTilePngFromImage(image: Buffer): Promise<Buffer> {
  const maskSvg = Buffer.from(
    `<svg width="${TILE_W}" height="${TILE_H}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${TILE_W}" height="${TILE_H}" rx="${RADIUS}" ry="${RADIUS}" fill="#fff"/></svg>`
  );
  const borderSvg = Buffer.from(
    `<svg width="${TILE_W}" height="${TILE_H}" xmlns="http://www.w3.org/2000/svg"><rect x="0.5" y="0.5" width="${TILE_W - 1}" height="${TILE_H - 1}" rx="${RADIUS}" ry="${RADIUS}" fill="none" stroke="rgba(255,255,255,0.10)"/></svg>`
  );

  const resized = await sharp(image)
    .resize(TILE_W, TILE_H, { fit: "cover", position: "attention" })
    .png()
    .toBuffer();

  return sharp(resized)
    .composite([
      { input: maskSvg, blend: "dest-in" },
      { input: borderSvg, blend: "over" },
    ])
    .png()
    .toBuffer();
}

async function makePlaceholderTilePng(): Promise<Buffer> {
  return sharp(Buffer.from(placeholderTileSvg())).png().toBuffer();
}

async function getTopAppIds(): Promise<number[]> {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn(
      "[generate-home-og] Missing Supabase env; using fallback appids."
    );
    return FALLBACK_APPIDS;
  }

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from("games_new")
      .select("appid, suggested_game_appids, created_at")
      .limit(60);

    if (error || !data) {
      console.warn(
        "[generate-home-og] Supabase query failed; using fallback appids.",
        error?.message
      );
      return FALLBACK_APPIDS;
    }

    const games = data as Row[];
    const sorted = games.sort((a, b) => {
      const aCount = Array.isArray(a.suggested_game_appids)
        ? a.suggested_game_appids.length
        : 0;
      const bCount = Array.isArray(b.suggested_game_appids)
        ? b.suggested_game_appids.length
        : 0;
      if (bCount !== aCount) return bCount - aCount;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const ids = sorted
      .map((g) => g.appid)
      .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
      .slice(0, 6);

    return ids.length === 6 ? ids : FALLBACK_APPIDS;
  } catch (err) {
    console.warn(
      "[generate-home-og] Unexpected error; using fallback appids.",
      err
    );
    return FALLBACK_APPIDS;
  }
}

async function main() {
  console.log("[generate-home-og] Generating homepage OG image...");
  await fs.mkdir(OUT_DIR, { recursive: true });

  const appIds = await getTopAppIds();
  console.log("[generate-home-og] Using appids:", appIds.join(", "));

  const tiles: Buffer[] = await Promise.all(
    appIds.slice(0, 6).map(async (appid) => {
      const capsule = await fetchBuffer(steamCapsuleUrl(appid), 2200);
      const header = capsule ? null : await fetchBuffer(steamHeaderUrl(appid), 2200);
      const img = capsule || header;
      if (!img) return makePlaceholderTilePng();
      try {
        return await makeTilePngFromImage(img);
      } catch {
        return makePlaceholderTilePng();
      }
    })
  );

  const gridW = TILE_W * 3 + GAP * 2;
  const gridH = TILE_H * 2 + GAP;
  const startX = Math.floor((WIDTH - gridW) / 2);
  const startY = Math.floor((HEIGHT - gridH) / 2);

  const composites = tiles.map((input, idx) => {
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    return {
      input,
      left: startX + col * (TILE_W + GAP),
      top: startY + row * (TILE_H + GAP),
    } as const;
  });

  const bg = await sharp(Buffer.from(backgroundSvg())).png().toBuffer();

  await sharp(bg).composite(composites).png().toFile(OUT_FILE);
  console.log(`[generate-home-og] Wrote ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((err) => {
  // Never fail the build over an OG image: write a placeholder instead.
  console.warn("[generate-home-og] Failed; writing placeholder OG image.", err);
  fs.mkdir(OUT_DIR, { recursive: true })
    .then(() => sharp(Buffer.from(backgroundSvg())).png().toFile(OUT_FILE))
    .then(() =>
      console.log(
        `[generate-home-og] Wrote placeholder ${path.relative(process.cwd(), OUT_FILE)}`
      )
    )
    .catch(() => {});
});

