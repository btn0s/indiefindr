export const PERSPECTIVE = 1200;
export const RATIO = 1.62;
export const CRIMP = 0.075;
export const STRIP = 0.13;
export const CARD_RATIO = 88 / 63;

export type PackLayout = { width: number; height: number; center: number; mouth: number };

export function packLayout(width: number, height: number): PackLayout {
  const packW = Math.max(120, Math.min(280, width * 0.6, (height - 200) / RATIO));
  const packH = packW * RATIO;
  const center = Math.max(packH / 2 + 72, height * 0.47);
  return { width: packW, height: packH, center, mouth: center - packH * (0.5 - STRIP) };
}
