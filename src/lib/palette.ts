/** Colour from the game. The pipeline stores a small palette from each store header (scripts/relaunch/palette.py);
 *  this turns it into the game page's tint: the page background a few percent toward the dominant hue (the cover's
 *  fade follows it), a soft glow behind the title block, chip fills and borders, and the art placeholder. Lightness
 *  stays at the neutral theme's, so only hue moves, and every text colour drawn on a tinted surface is then darkened
 *  in small steps until it clears WCAG AA (4.5:1) on each surface it sits on. No palette, no tint: the neutrals stay. */
export type Palette = { src?: string; dominant?: string; dark?: string; accent?: string | null };

type Lab = [number, number, number];
const HEX = /^#[0-9a-f]{6}$/i;
const AA = 4.5;

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

function oklab(hex: string): Lab {
  const [r, g, b] = rgb(hex).map(toLinear);
  const [l, m, s] = [
    0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
    0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
    0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
  ].map(Math.cbrt);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLCH to hex; out-of-gamut colours lose chroma until they fit. */
function hex(L: number, C: number, h: number): string {
  for (;; C *= 0.9) {
    const a = C * Math.cos(h), b = C * Math.sin(h);
    const [l, m, s] = [L + 0.3963377774 * a + 0.2158037573 * b, L - 0.1055613458 * a - 0.0638541728 * b, L - 0.0894841775 * a - 1.291485548 * b].map(x => x ** 3);
    const out = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    if (out.every(c => c >= -1e-4 && c <= 1 + 1e-4) || C < 1e-3)
      return "#" + out.map(c => Math.round(255 * Math.min(1, Math.max(0, fromLinear(c)))).toString(16).padStart(2, "0")).join("");
  }
}

const luminance = (color: string) => { const [r, g, b] = rgb(color).map(toLinear); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// The neutral theme (globals.css): page, card, ink, muted text, and the description's softer body colour.
const NEUTRAL = { background: "#f7f7f8", card: "#ffffff", ink: "#131316", muted: "#6b6b75", description: "#55555e" };

export type GameTheme = {
  /** Declarations for the page's style block. */
  css: string;
  /** Each tinted text colour's contrast on each surface it sits on (all at least 4.5). */
  contrast: Record<"ink" | "muted" | "description", Record<string, number>>;
};

export function gameTheme(palette: Palette | null): GameTheme | null {
  if (!palette?.dominant || !HEX.test(palette.dominant)) return null;
  const [, a, b] = oklab(palette.dominant);
  const chroma = Math.min(Math.hypot(a, b), 0.16), hue = Math.atan2(b, a);
  // The glow follows the dominant hue; near-grey art lends it the accent instead, when there is one.
  const glowSource = chroma < 0.04 && palette.accent && HEX.test(palette.accent) ? oklab(palette.accent) : oklab(palette.dominant);
  const glowChroma = Math.min(Math.hypot(glowSource[1], glowSource[2]), 0.16), glowHue = Math.atan2(glowSource[2], glowSource[1]);
  // Surfaces keep the neutral theme's lightness; only a little of the art's hue comes through.
  const surfaces = {
    background: hex(oklab(NEUTRAL.background)[0], chroma * 0.1, hue),
    glow: hex(0.94, glowChroma * 0.35, glowHue),
    chip: hex(oklab(NEUTRAL.card)[0] - 0.01, chroma * 0.08, hue),
  };
  // Text takes a trace of the hue and steps darker until it clears AA on every surface it sits on.
  const text = (start: string, on: string[]) => {
    for (let L = oklab(start)[0]; ; L -= 0.01) {
      const color = hex(L, chroma * 0.12, hue);
      if (on.every(surface => contrast(color, surface) >= AA)) return color;
    }
  };
  const all = Object.values(surfaces);
  const muted = text(NEUTRAL.muted, all);
  const description = text(NEUTRAL.description, [surfaces.background, surfaces.glow]);
  const report = (color: string, on: Record<string, string>) =>
    Object.fromEntries(Object.entries(on).map(([name, surface]) => [name, Math.round(contrast(color, surface) * 100) / 100]));
  const declarations = {
    "--background": surfaces.background,
    "--muted-foreground": muted,
    "--game-description": description,
    "--game-glow": surfaces.glow,
    "--game-chip": surfaces.chip,
    "--game-chip-border": hex(0.9, chroma * 0.3, hue),
    ...(palette.dark && HEX.test(palette.dark) && { "--media": palette.dark }),
  };
  return {
    css: Object.entries(declarations).map(([name, value]) => `${name}:${value}`).join(";"),
    contrast: {
      ink: report(NEUTRAL.ink, surfaces),
      muted: report(muted, surfaces),
      description: report(description, { background: surfaces.background, glow: surfaces.glow }),
    },
  };
}
