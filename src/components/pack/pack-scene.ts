import * as THREE from "three";
import { CRIMP, PERSPECTIVE, RATIO, STRIP, packLayout, type PackLayout } from "./pack-layout";
import { createBeam, createHalo, createRing, createSparks, type Spark } from "./pack-fx";

export type PackPrint = { art: string | null; still: string | null; title: string; code: string; printed: string; font: string };

const REF_W = 280;
const REF_H = REF_W * RATIO;
const TEX_W = 1024;
const TEX_H = Math.round(TEX_W * RATIO);
const COLS = 140;

const TEAR_Y = REF_H / 2 - REF_H * STRIP;
const CURL_R = 14;
const CURL_MAX = 2.5;
const PEEL_SPAN = REF_W + CURL_R * CURL_MAX + 40;

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t * t * t;

function jag(x: number) {
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return (s - Math.floor(s) - 0.5) * 2.4;
}

function restZ(x: number, y: number) {
  const crimp = CRIMP * REF_H;
  const top = REF_H / 2 - crimp;
  const bottom = -REF_H / 2 + crimp;
  if (y >= top || y <= bottom) {
    const period = REF_W / 46;
    const phase = ((x + REF_W / 2) / period) % 1;
    return 0.7 * Math.abs(phase * 2 - 1);
  }
  const ramp = REF_H * 0.1;
  const v = smooth(clamp(Math.min(y - bottom, top - y) / ramp));
  const u = (2 * x) / REF_W;
  return REF_W * 0.075 * v * Math.sqrt(Math.max(0, 1 - u ** 6));
}

function panel(y0: number, y1: number, rows: number) {
  const geometry = new THREE.PlaneGeometry(REF_W, y1 - y0, COLS, rows);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    let y = position.getY(i) + (y0 + y1) / 2;
    if (Math.abs(y - TEAR_Y) < 0.01) y += jag(x);
    position.setXYZ(i, x, y, restZ(x, y));
    uv.setXY(i, (x + REF_W / 2) / REF_W, (y + REF_H / 2) / REF_H);
  }
  geometry.computeVertexNormals();
  return geometry;
}

const loadImage = (src: string | null) => new Promise<HTMLImageElement | null>(resolve => {
  if (!src) return resolve(null);
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = src;
});

function cover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}


const SWORD_A = new Path2D("M12.7057 17.9728L14.0299 16.6487L10.7377 13.3567L7.4396 10.0586L6.11553 11.3827L7.33348 14.3331L4.85938 17.8014L5.52604 18.4681L6.19271 19.1347L9.66681 16.6487L12.7057 17.9728Z");
const SWORD_B = new Path2D("M19 9.04753L13.6686 14.3789L12.1159 12.8262L15.5358 9.40755L14.5925 8.46419L11.1732 11.8835L9.62109 10.3314L14.9525 5H19V9.04753Z");

function sword(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = fill;
  ctx.fill(SWORD_A);
  ctx.fill(SWORD_B);
  ctx.restore();
}

function surfaceCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  return canvas;
}

function crinkles() {
  const canvas = surfaceCanvas();
  const c = canvas.getContext("2d")!;
  const k = TEX_W / REF_W;
  c.fillStyle = "rgb(128,128,128)";
  c.fillRect(0, 0, TEX_W, TEX_H);
  const tone = (v: number, a: number) => `rgba(${v},${v},${v},${a})`;
  for (let i = 0; i < 34; i++) {
    const x = Math.random() * TEX_W;
    const y = Math.random() * TEX_H;
    const r = (30 + Math.random() * 110) * k;
    const v = Math.random() < 0.5 ? 255 : 0;
    const dent = c.createRadialGradient(x, y, 0, x, y, r);
    dent.addColorStop(0, tone(v, 0.12));
    dent.addColorStop(1, tone(v, 0));
    c.fillStyle = dent;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 46; i++) {
    const edge = Math.random() < 0.55;
    const x = edge ? (Math.random() < 0.5 ? Math.random() * 0.18 : 1 - Math.random() * 0.18) * TEX_W : Math.random() * TEX_W;
    const y = Math.random() * TEX_H;
    const length = (30 + Math.random() ** 1.4 * 120) * k;
    const width = (2.5 + Math.random() * 5) * k;
    const v = Math.random() < 0.5 ? 255 : 0;
    c.save();
    c.translate(x, y);
    c.rotate(Math.PI / 2 + (Math.random() - 0.5) * (edge ? 0.9 : 2.6));
    const ridge = c.createLinearGradient(0, -width, 0, width);
    ridge.addColorStop(0, tone(v, 0));
    ridge.addColorStop(0.5, tone(v, 0.08 + Math.random() * 0.12));
    ridge.addColorStop(1, tone(v, 0));
    c.fillStyle = ridge;
    c.beginPath();
    c.moveTo(-length / 2, 0);
    c.quadraticCurveTo(0, -width * 2, length / 2, 0);
    c.quadraticCurveTo(0, width * 2, -length / 2, 0);
    c.fill();
    c.restore();
  }
  return canvas;
}

function raise(ctx: CanvasRenderingContext2D, k: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  ctx.save();
  ctx.lineJoin = "round";
  for (const [width, alpha] of [[3.2, 0.1], [1.8, 0.12], [0.8, 0.14]]) {
    ctx.lineWidth = width * k;
    ctx.strokeStyle = ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    paint(ctx);
  }
  ctx.restore();
}

function normals(relief: HTMLCanvasElement, strength: number) {
  const { width, height } = relief;
  const src = relief.getContext("2d")!.getImageData(0, 0, width, height).data;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const o = out.getContext("2d")!;
  const image = o.createImageData(width, height);
  const d = image.data;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    const up = Math.max(0, y - 1) * width;
    const down = Math.min(height - 1, y + 1) * width;
    for (let x = 0; x < width; x++) {
      const nx = ((src[(row + Math.max(0, x - 1)) * 4] - src[(row + Math.min(width - 1, x + 1)) * 4]) / 255) * strength;
      const ny = ((src[(down + x) * 4] - src[(up + x) * 4]) / 255) * strength;
      const scale = 127.5 / Math.hypot(nx, ny, 1);
      const i = (row + x) * 4;
      d[i] = 127.5 + nx * scale;
      d[i + 1] = 127.5 + ny * scale;
      d[i + 2] = 127.5 + scale;
      d[i + 3] = 255;
    }
  }
  o.putImageData(image, 0, 0);
  return out;
}

function holoBands() {
  const width = 256;
  const height = Math.round(width * RATIO);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext("2d")!;
  const image = c.createImageData(width, height);
  const d = image.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const wave = Math.sin(((x + y * 0.55) / width) * Math.PI * 2 * 7 + Math.sin(y / 23) * 1.4);
      const v = Math.max(0, Math.min(255, 128 + wave * 100 + (Math.random() - 0.5) * 70));
      const i = (y * width + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  c.putImageData(image, 0, 0);
  return canvas;
}

function studio() {
  const room = new THREE.Scene();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const shell = new THREE.BoxGeometry(12, 12, 12);
  const walls = new THREE.MeshBasicMaterial({ color: 0x2e2f36, side: THREE.BackSide });
  geometries.push(shell);
  materials.push(walls);
  room.add(new THREE.Mesh(shell, walls));
  const light = (w: number, h: number, x: number, y: number, z: number, power: number, color = 0xffffff) => {
    const geometry = new THREE.PlaneGeometry(w, h);
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide });
    geometries.push(geometry);
    materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
  };
  light(3.2, 2.2, -2.6, 2.8, 4.2, 6);
  light(0.5, 7, 4.6, 0.4, 2.6, 7);
  light(0.5, 7, -4.8, -0.6, 1.4, 4);
  light(7, 0.45, 0.4, 4.8, 2.2, 6);
  light(4, 1.6, 1.8, -4.4, 3, 2.2, 0xb8c8ff);
  light(2.4, 2.4, 0, 0.6, -5.5, 3, 0xffe2c4);
  return { room, dispose: () => { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); } };
}

async function printPack(print: PackPrint, field: HTMLCanvasElement) {
  const [art, still] = await Promise.all([loadImage(print.art), loadImage(print.still)]);
  const color = document.createElement("canvas");
  const orm = document.createElement("canvas");
  color.width = orm.width = TEX_W;
  color.height = orm.height = TEX_H;
  const c = color.getContext("2d")!;
  const o = orm.getContext("2d")!;
  const relief = surfaceCanvas();
  const r = relief.getContext("2d")!;
  r.drawImage(field, 0, 0);
  const k = TEX_W / REF_W;
  const crimp = CRIMP * TEX_H;
  const tear = STRIP * TEX_H;
  const frame = 7 * k;
  const ink = "rgb(0,107,51)";
  const foil = "rgb(140,44,255)";
  const stamp = "rgb(255,36,255)";

  const silver = c.createLinearGradient(0, 0, TEX_W, 0);
  silver.addColorStop(0, "#9da3ad");
  silver.addColorStop(0.5, "#e6e8ec");
  silver.addColorStop(1, "#9aa0aa");
  c.fillStyle = silver;
  c.fillRect(0, 0, TEX_W, TEX_H);
  o.fillStyle = foil;
  o.fillRect(0, 0, TEX_W, TEX_H);

  const artY = crimp + frame;
  const artH = TEX_H - 2 * crimp - 2 * frame;
  const picture = art ?? still;
  c.fillStyle = "#16161a";
  c.fillRect(frame, artY, TEX_W - 2 * frame, artH);
  if (picture) cover(c, picture, frame, artY, TEX_W - 2 * frame, artH);
  o.fillStyle = ink;
  o.fillRect(frame, artY, TEX_W - 2 * frame, artH);

  const period = TEX_W / 46;
  for (let x = 0; x < TEX_W; x += period) {
    for (const [y, h] of [[0, crimp], [TEX_H - crimp, crimp]]) {
      const stripe = c.createLinearGradient(x, 0, x + period, 0);
      stripe.addColorStop(0, "rgba(255,255,255,0.35)");
      stripe.addColorStop(0.5, "rgba(0,0,0,0.18)");
      stripe.addColorStop(1, "rgba(255,255,255,0.35)");
      c.fillStyle = stripe;
      c.fillRect(x, y, period, h);
    }
  }

  c.fillStyle = "rgba(12,12,16,0.86)";
  c.fillRect(frame, artY, TEX_W - 2 * frame, tear - artY);
  c.setLineDash([14, 12]);
  c.lineWidth = 3;
  c.strokeStyle = "rgba(255,255,255,0.55)";
  c.beginPath();
  c.moveTo(frame + 30, tear);
  c.lineTo(TEX_W - frame - 30, tear);
  c.stroke();
  c.setLineDash([]);
  c.font = `600 ${7 * k}px ${print.font}`;
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText("TEAR  ALONG  THE  LINE", TEX_W / 2, (artY + tear) / 2);

  const band = tear + 2 * k;
  const bandH = 40 * k;
  c.fillStyle = "rgba(12,12,16,0.8)";
  c.fillRect(frame, band, TEX_W - 2 * frame, bandH);
  c.textAlign = "center";
  o.textAlign = "center";
  c.textBaseline = "alphabetic";
  o.textBaseline = "alphabetic";
  c.font = `700 ${7 * k}px ${print.font}`;
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.fillText("G A M E S   L I K E", TEX_W / 2, band + 13 * k);
  o.font = c.font;
  o.fillStyle = stamp;
  o.fillText("G A M E S   L I K E", TEX_W / 2, band + 13 * k);
  r.font = c.font;
  r.textAlign = "center";
  r.textBaseline = "alphabetic";
  raise(r, k * 0.5, ctx => { ctx.strokeText("G A M E S   L I K E", TEX_W / 2, band + 13 * k); ctx.fillText("G A M E S   L I K E", TEX_W / 2, band + 13 * k); });
  const titleW = TEX_W - 2 * frame - 28 * k;
  let titleSize = 17 * k;
  c.font = `800 ${titleSize}px ${print.font}`;
  while (c.measureText(print.title).width > titleW && titleSize > 10 * k) {
    titleSize -= k;
    c.font = `800 ${titleSize}px ${print.font}`;
  }
  let title = print.title;
  while (c.measureText(title).width > titleW && title.length > 4) title = `${title.slice(0, -2).trimEnd()}…`;
  c.fillStyle = "#ffffff";
  c.fillText(title, TEX_W / 2, band + 31 * k);
  o.font = c.font;
  o.fillText(title, TEX_W / 2, band + 31 * k);
  r.font = c.font;
  raise(r, k, ctx => { ctx.strokeText(title, TEX_W / 2, band + 31 * k); ctx.fillText(title, TEX_W / 2, band + 31 * k); });

  if (!art && still) {
    const scrimTop = artY + artH * 0.55;
    const scrim = c.createLinearGradient(0, scrimTop, 0, artY + artH);
    scrim.addColorStop(0, "rgba(8,8,12,0)");
    scrim.addColorStop(1, "rgba(8,8,12,0.85)");
    c.fillStyle = scrim;
    c.fillRect(frame, scrimTop, TEX_W - 2 * frame, artY + artH - scrimTop);
  }

  const footH = 22 * k;
  const foot = artY + artH - footH;
  c.fillStyle = "rgba(12,12,16,0.8)";
  c.fillRect(frame, foot, TEX_W - 2 * frame, footH);
  const pad = 12 * k;
  const mid = foot + footH / 2;
  const seal = 12 * k;
  c.beginPath();
  c.arc(pad + seal / 2, mid, seal / 2, 0, Math.PI * 2);
  c.fillStyle = "rgba(255,255,255,0.92)";
  c.fill();
  o.beginPath();
  o.arc(pad + seal / 2, mid, seal / 2, 0, Math.PI * 2);
  o.fillStyle = stamp;
  o.fill();
  sword(c, pad + seal * 0.18, mid - seal * 0.32, seal * 0.64, "#16161a");
  c.textBaseline = "middle";
  o.textBaseline = "middle";
  c.textAlign = "left";
  o.textAlign = "left";
  c.font = `750 ${10 * k}px ${print.font}`;
  c.fillStyle = "#ffffff";
  c.fillText("indiefindr", pad + seal + 5 * k, mid + 0.5 * k);
  o.font = c.font;
  o.fillText("indiefindr", pad + seal + 5 * k, mid + 0.5 * k);
  r.font = c.font;
  r.textAlign = "left";
  r.textBaseline = "middle";
  raise(r, k * 0.6, ctx => {
    ctx.strokeText("indiefindr", pad + seal + 5 * k, mid + 0.5 * k);
    ctx.fillText("indiefindr", pad + seal + 5 * k, mid + 0.5 * k);
    ctx.beginPath();
    ctx.arc(pad + seal / 2, mid, seal / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
  });
  c.textAlign = "right";
  c.font = `600 ${7 * k}px ${print.font}`;
  c.fillStyle = "rgba(255,255,255,0.66)";
  c.fillText(`SET ${print.code}    5 CARDS    ${print.printed}`, TEX_W - pad, mid + 0.5 * k);

  c.save();
  c.globalCompositeOperation = "destination-out";
  for (const side of [0, TEX_W]) {
    c.beginPath();
    c.moveTo(side, tear - 9 * k);
    c.lineTo(side + (side ? -7 : 7) * k, tear);
    c.lineTo(side, tear + 9 * k);
    c.closePath();
    c.fill();
  }
  c.restore();

  return { color, orm, relief };
}

function printBack(print: PackPrint, field: HTMLCanvasElement) {
  const color = document.createElement("canvas");
  const orm = document.createElement("canvas");
  color.width = orm.width = TEX_W;
  color.height = orm.height = TEX_H;
  const c = color.getContext("2d")!;
  const o = orm.getContext("2d")!;
  const relief = surfaceCanvas();
  const r = relief.getContext("2d")!;
  r.drawImage(field, 0, 0);
  const k = TEX_W / REF_W;
  const crimp = CRIMP * TEX_H;
  const tear = STRIP * TEX_H;
  const frame = 7 * k;
  const ink = "rgb(0,107,51)";
  const foil = "rgb(140,44,255)";
  const stamp = "rgb(255,36,255)";

  const silver = c.createLinearGradient(0, 0, TEX_W, 0);
  silver.addColorStop(0, "#9da3ad");
  silver.addColorStop(0.5, "#e6e8ec");
  silver.addColorStop(1, "#9aa0aa");
  c.fillStyle = silver;
  c.fillRect(0, 0, TEX_W, TEX_H);
  o.fillStyle = foil;
  o.fillRect(0, 0, TEX_W, TEX_H);

  const top = crimp + frame;
  const height = TEX_H - 2 * crimp - 2 * frame;
  const panel = c.createLinearGradient(0, top, TEX_W, top + height);
  panel.addColorStop(0, "#221a3d");
  panel.addColorStop(0.5, "#110e1d");
  panel.addColorStop(1, "#24173a");
  c.fillStyle = panel;
  c.fillRect(frame, top, TEX_W - 2 * frame, height);
  o.fillStyle = ink;
  o.fillRect(frame, top, TEX_W - 2 * frame, height);

  c.save();
  o.save();
  for (const ctx of [c, o]) {
    ctx.beginPath();
    ctx.rect(frame, top, TEX_W - 2 * frame, height);
    ctx.clip();
  }
  const step = 26 * k;
  for (let row = 0, y = top - step / 2; y < top + height + step; row++, y += step * 0.6) {
    for (let x = (row % 2) * step / 2 - step / 2; x < TEX_W + step; x += step) {
      sword(c, x, y, 8 * k, "rgba(255,255,255,0.09)");
      sword(o, x, y, 8 * k, stamp);
    }
  }
  c.restore();
  o.restore();

  const cx = TEX_W / 2;
  const cy = top + height * 0.44;
  const radius = 44 * k;
  c.fillStyle = "#0d0b16";
  c.beginPath();
  c.arc(cx, cy, radius + 10 * k, 0, Math.PI * 2);
  c.fill();
  o.fillStyle = ink;
  o.beginPath();
  o.arc(cx, cy, radius + 10 * k, 0, Math.PI * 2);
  o.fill();
  for (const [ctx, fill] of [[c, "rgba(255,255,255,0.92)"], [o, stamp]] as const) {
    ctx.lineWidth = 3 * k;
    ctx.strokeStyle = fill;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.2 * k;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 6 * k, 0, Math.PI * 2);
    ctx.stroke();
    sword(ctx, cx - 32 * k, cy - 32 * k, 64 * k, fill);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = `750 ${24 * k}px ${print.font}`;
    ctx.fillStyle = fill;
    ctx.fillText("indiefindr", cx, cy + radius + 46 * k);
  }
  r.font = `750 ${24 * k}px ${print.font}`;
  r.textAlign = "center";
  r.textBaseline = "alphabetic";
  raise(r, k, ctx => {
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 6 * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeText("indiefindr", cx, cy + radius + 46 * k);
    ctx.fillText("indiefindr", cx, cy + radius + 46 * k);
  });

  c.font = `700 ${6.5 * k}px ${print.font}`;
  c.fillStyle = "rgba(255,255,255,0.55)";
  c.textAlign = "center";
  c.fillText("G A M E S   L I K E", cx, top + height - 30 * k);
  c.font = `650 ${8 * k}px ${print.font}`;
  c.fillStyle = "rgba(255,255,255,0.8)";
  let title = print.title;
  while (c.measureText(title).width > TEX_W - 2 * frame - 40 * k && title.length > 4) title = `${title.slice(0, -2).trimEnd()}…`;
  c.fillText(title, cx, top + height - 16 * k);

  const period = TEX_W / 46;
  for (let x = 0; x < TEX_W; x += period) {
    for (const [y, h] of [[0, crimp], [TEX_H - crimp, crimp]]) {
      const stripe = c.createLinearGradient(x, 0, x + period, 0);
      stripe.addColorStop(0, "rgba(255,255,255,0.35)");
      stripe.addColorStop(0.5, "rgba(0,0,0,0.18)");
      stripe.addColorStop(1, "rgba(255,255,255,0.35)");
      c.fillStyle = stripe;
      c.fillRect(x, y, period, h);
    }
  }

  c.save();
  c.globalCompositeOperation = "destination-out";
  for (const side of [0, TEX_W]) {
    c.beginPath();
    c.moveTo(side, tear - 9 * k);
    c.lineTo(side + (side ? -7 : 7) * k, tear);
    c.lineTo(side, tear + 9 * k);
    c.closePath();
    c.fill();
  }
  c.restore();

  return { color, orm, relief };
}

export type Tint = [number, number, number];

export type PackScene = {
  layout(width: number, height: number): PackLayout;
  look(x: number, y: number): void;
  tear(progress: number): void;
  fling(): void;
  drop(): Promise<void>;
  show(tint: Tint): Promise<void>;
  arrive(tint: Tint): Promise<void>;
  skip(): void;
  burst(x: number, y: number, tint: Tint, power: number): void;
  gather(x: number, y: number, tint: Tint): void;
  ambient(x: number, y: number, width: number, height: number, tint: Tint): void;
  dispose(): void;
};

type Plan = { beam: [number, number, number, number]; fall: [number, number]; turns: number; end: number; motes: number; swirl: number; burst: number; level: number };

const FULL: Plan = { beam: [0.15, 1.0, 2.05, 2.9], fall: [0.8, 2.1], turns: 2, end: 3.3, motes: 240, swirl: 140, burst: 180, level: 1 };
const SHORT: Plan = { beam: [0, 0.3, 0.95, 1.5], fall: [0.05, 0.95], turns: 1, end: 1.8, motes: 0, swirl: 0, burst: 90, level: 0.7 };

const random = (min: number, max: number) => min + Math.random() * (max - min);

export async function createPackScene(canvas: HTMLCanvasElement, print: PackPrint, still: boolean): Promise<PackScene> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const lights = studio();
  const environment = pmrem.fromScene(lights.room, 0.035).texture;
  lights.dispose();
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = 1.1;
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-300, 500, 900);
  const spot = new THREE.DirectionalLight(0xffffff, 0);
  spot.position.set(0, 1200, 300);
  scene.add(key, spot);

  const camera = new THREE.PerspectiveCamera(45, 1, 1, PERSPECTIVE * 4);
  camera.position.set(0, 0, PERSPECTIVE);

  const field = crinkles();
  const [front, back] = await Promise.all([printPack(print, field), printBack(print, field)]);
  const bands = new THREE.CanvasTexture(holoBands());
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const textures: THREE.Texture[] = [];
  textures.push(bands);
  const foilMaterial = ({ color, orm, relief }: { color: HTMLCanvasElement; orm: HTMLCanvasElement; relief: HTMLCanvasElement }) => {
    const map = new THREE.CanvasTexture(color);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = anisotropy;
    const surface = new THREE.CanvasTexture(orm);
    surface.anisotropy = anisotropy;
    const bumps = new THREE.CanvasTexture(normals(relief, 5));
    bumps.anisotropy = anisotropy;
    textures.push(map, surface, bumps);
    return new THREE.MeshPhysicalMaterial({
      map, metalnessMap: surface, roughnessMap: surface, iridescenceMap: surface,
      metalness: 1, roughness: 1, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessMinimum: 180, iridescenceThicknessMaximum: 520,
      clearcoat: 1, clearcoatRoughness: 0.12, alphaTest: 0.5,
      normalMap: bumps, normalScale: new THREE.Vector2(0.6, 0.6), clearcoatNormalMap: bumps, clearcoatNormalScale: new THREE.Vector2(0.25, 0.25),
      iridescenceThicknessMap: bands,
    });
  };
  const printed = foilMaterial(front);
  const printedBack = foilMaterial(back);
  const inside = new THREE.MeshPhysicalMaterial({ color: 0xdfe2e8, metalness: 1, roughness: 0.32, side: THREE.BackSide });

  const root = new THREE.Group();
  const body = new THREE.Mesh(panel(-REF_H / 2, TEAR_Y, 132), printed);
  const backGeometry = panel(-REF_H / 2, REF_H / 2, 150);
  backGeometry.scale(-1, 1, -1);
  const backing = new THREE.Mesh(backGeometry, printedBack);
  const stripGeometry = panel(TEAR_Y, REF_H / 2, 14);
  const rest = Float32Array.from(stripGeometry.attributes.position.array as ArrayLike<number>);
  const strip = new THREE.Group();
  strip.add(new THREE.Mesh(stripGeometry, printed), new THREE.Mesh(stripGeometry, inside));
  root.add(body, backing, strip);
  scene.add(root);

  const sparks = createSparks(renderer.getPixelRatio());
  const beam = createBeam();
  const halo = createHalo();
  const ring = createRing();
  scene.add(sparks.object, beam.mesh, halo.mesh, ring.mesh);

  let size = { width: 0, height: 0 };
  let pack = { width: 0, height: 0 };
  let center = 0;
  let pointer = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0, vx: 0, vy: 0 };
  let peel = 0;
  let flight: { start: number; vx: number; vy: number; vz: number; spin: number } | null = null;
  let tween: { from: number; to: number; start: number; duration: number; ease: (t: number) => number; done: () => void } | null = null;
  let entrance: { start: number; plan: Plan; tint: THREE.Color; landed: boolean; land: () => void } | null = null;
  let flare: { x: number; y: number; start: number; power: number; tint: THREE.Color } | null = null;
  let level = false;
  let frame = 0;
  let last = performance.now();
  const born = last;
  const clock = () => (performance.now() - born) / 1000;
  const unit = () => Math.max(0.6, Math.min(1.4, Math.min(size.width, size.height) / 800));

  const curl = (progress: number) => {
    const position = stripGeometry.attributes.position as THREE.BufferAttribute;
    const front = -REF_W / 2 + progress * PEEL_SPAN;
    for (let i = 0; i < position.count; i++) {
      const x = rest[i * 3];
      const y = rest[i * 3 + 1];
      const z = rest[i * 3 + 2];
      const d = front - x;
      if (d <= 0) { position.setXYZ(i, x, y, z); continue; }
      const angle = Math.min(d / CURL_R, CURL_MAX);
      let px = front - CURL_R * Math.sin(angle);
      let pz = z + CURL_R * (1 - Math.cos(angle));
      const beyond = d - CURL_R * CURL_MAX;
      if (beyond > 0) {
        px += -Math.cos(CURL_MAX) * beyond;
        pz += Math.sin(CURL_MAX) * beyond;
      }
      position.setXYZ(i, px, y + d * 0.06, pz);
    }
    position.needsUpdate = true;
    stripGeometry.computeVertexNormals();
  };

  const shade = (tint: THREE.Color, amount: number) => new THREE.Color(1, 1, 1).lerp(tint, amount);

  const sparkle = (t: number, x: number, y: number, tint: THREE.Color, count: number, power: number) => {
    const u = unit() * power;
    const list: Spark[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = random(220, 860) * u;
      list.push({
        x, y, z: random(-20, 60), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, vz: random(-120, 220),
        life: random(0.8, 1.7), size: random(1.6, 4.6) * Math.min(1.2, u), color: shade(tint, Math.random() * 0.8),
        star: Math.random() < 0.3, drag: 2.4, gravity: 240 * u,
      });
    }
    for (let i = 0; i < count / 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = random(20, 110) * u;
      list.push({
        x: x + random(-40, 40) * u, y: y + random(-60, 60) * u, z: random(0, 80), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed + 30,
        life: random(1.8, 3), size: random(1.4, 3.2), color: shade(tint, Math.random()), star: Math.random() < 0.5, drag: 0.8, gravity: 30,
        delay: random(0, 0.4),
      });
    }
    sparks.emit(t, list);
    flare = { x, y, start: t, power, tint };
  };

  const converge = (x: number, y: number, tint: THREE.Color, count: number, delay: [number, number]) => {
    const u = unit();
    const list: Spark[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const reach = Math.max(size.width, size.height) * random(0.42, 0.62);
      const k = 2.4;
      const inward = reach * k * 0.92;
      const around = reach * k * random(0.25, 0.45);
      list.push({
        x: x + Math.cos(angle) * reach, y: y + Math.sin(angle) * reach, z: random(-200, 100),
        vx: -Math.cos(angle) * inward - Math.sin(angle) * around, vy: -Math.sin(angle) * inward + Math.cos(angle) * around,
        life: random(1, 1.3), size: random(1.4, 3.4) * u, color: shade(tint, 0.3 + Math.random() * 0.7), star: Math.random() < 0.25,
        drag: k, delay: random(...delay),
      });
    }
    return list;
  };

  const begin = (plan: Plan, tint: THREE.Color) => {
    const t = clock();
    const list: Spark[] = [];
    for (let i = 0; i < plan.motes; i++) {
      list.push({
        x: random(-0.55, 0.55) * size.width, y: random(-0.5, 0.5) * size.height, z: random(-600, 200),
        vx: random(-6, 6), vy: random(8, 32), life: random(3, 4.6), size: random(1.1, 3.1),
        color: shade(tint, Math.random() * 0.7), star: Math.random() < 0.12, delay: random(0, 0.9),
      });
    }
    list.push(...converge(0, center, tint, plan.swirl, [0.5, 1.05]));
    if (list.length) sparks.emit(t, list);
    level = true;
    peel = 0;
    curl(0);
    strip.position.set(0, 0, 0);
    strip.rotation.set(0, 0, 0);
    strip.visible = true;
    flight = null;
    tween = null;
    root.userData.offset = 0;
    root.visible = false;
    return new Promise<void>(resolve => {
      entrance = { start: t, plan, tint, landed: false, land: resolve };
      run();
    });
  };

  const stage = (t: number) => {
    let fall = { y: 0, z: 0, spin: 0, tilt: 0 };
    if (entrance) {
      const { plan, tint } = entrance;
      const s = t - entrance.start;
      const p = clamp((s - plan.fall[0]) / (plan.fall[1] - plan.fall[0]));
      const lift = (1 - p) ** 4;
      fall = { y: lift * size.height * 0.95, z: -lift * 1500, spin: lift * plan.turns * Math.PI * 2, tilt: lift * 0.6 };
      root.visible = s >= plan.fall[0];
      const [a, b, c, d] = plan.beam;
      const light = s < c ? smooth(clamp((s - a) / (b - a))) : 1 - smooth(clamp((s - c) / (d - c)));
      const topY = size.height / 2 + 60;
      const bottomY = center - pack.height * 0.2;
      beam.mesh.position.set(0, (topY + bottomY) / 2, -180);
      beam.mesh.scale.set(pack.width * 1.7, topY - bottomY, 1);
      beam.material.uniforms.color.value.copy(shade(tint, 0.35));
      beam.set(light * plan.level);
      spot.intensity = light * 2.4;
      if (!entrance.landed && s >= plan.fall[1]) {
        entrance.landed = true;
        level = false;
        sparkle(t, 0, center, tint, plan.burst, plan.level);
        entrance.land();
      }
      if (!entrance.landed) halo.set(light * p * 0.35 * plan.level);
      if (s >= plan.end) {
        entrance = null;
        beam.set(0);
        spot.intensity = 0;
      }
    }
    if (flare) {
      const since = t - flare.start;
      const { tint } = flare;
      halo.mesh.position.set(flare.x, flare.y, -90);
      halo.mesh.scale.setScalar(Math.max(pack.height, 260) * 2.8 * Math.max(0.6, flare.power));
      halo.material.uniforms.color.value.copy(shade(tint, 0.4));
      halo.set(Math.exp(-since * 3.2) * flare.power);
      ring.mesh.position.set(flare.x, flare.y, 40);
      ring.mesh.scale.setScalar(Math.max(size.width, size.height) * 1.3 * Math.max(0.6, flare.power));
      ring.material.uniforms.radius.value = easeOut(clamp(since / 0.9));
      ring.material.uniforms.color.value.copy(shade(tint, 0.5));
      ring.set(since < 0.9 ? 1 : 0);
      if (since > 1.6) { flare = null; halo.set(0); ring.set(0); }
    }
    for (const effect of [beam, halo, ring]) effect.material.uniforms.now.value = t;
    sparks.tick(t);
    return fall;
  };

  const render = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - born) / 1000;
    const fall = stage(t);
    const calm = still || level || !!entrance;
    const targetY = calm ? 0 : pointer.x * 0.32 + Math.sin(t * 0.7) * 0.05;
    const targetX = calm ? 0 : -pointer.y * 0.22 + Math.sin(t * 0.9 + 1) * 0.03;
    const stiffness = 90;
    const damping = 2 * Math.sqrt(stiffness) * 0.9;
    tilt.vy += ((targetY - tilt.y) * stiffness - tilt.vy * damping) * dt;
    tilt.vx += ((targetX - tilt.x) * stiffness - tilt.vx * damping) * dt;
    tilt.y += tilt.vy * dt;
    tilt.x += tilt.vx * dt;
    root.rotation.set(tilt.x + fall.tilt, tilt.y + fall.spin, 0);
    scene.environmentRotation.set(-tilt.x * 0.8, tilt.y * 1.6 + 0.4, 0);

    let offset = 0;
    if (tween) {
      const p = clamp((now - tween.start) / tween.duration);
      offset = tween.from + (tween.to - tween.from) * tween.ease(p);
      if (p >= 1) { const done = tween.done; tween = null; done(); }
    } else if (root.userData.offset !== undefined) offset = root.userData.offset;
    root.userData.offset = offset;
    root.position.set(0, center + offset + fall.y + (calm ? 0 : Math.sin(t * 1.1) * 3), fall.z);

    if (flight) {
      const s = (now - flight.start) / 1000;
      strip.position.set(flight.vx * s, flight.vy * s - 1400 * s * s, flight.vz * s);
      strip.rotation.set(flight.spin * s * 0.4, 0, -flight.spin * s);
      if (s > 1.4) { strip.visible = false; flight = null; }
    }

    renderer.render(scene, camera);
    const busy = root.visible || !!entrance || !!flare || !!tween || sparks.alive(t);
    frame = busy && !document.hidden ? requestAnimationFrame(render) : 0;
  };

  const run = () => {
    if (frame || document.hidden) return;
    last = performance.now();
    frame = requestAnimationFrame(render);
  };
  const halt = () => { cancelAnimationFrame(frame); frame = 0; };
  const onVisibility = () => (document.hidden ? halt() : run());
  document.addEventListener("visibilitychange", onVisibility);

  const animate = (from: number, to: number, duration: number, ease: (t: number) => number) => new Promise<void>(resolve => {
    tween = { from, to, start: performance.now(), duration: still ? 1 : duration, ease, done: resolve };
    run();
  });

  run();

  return {
    layout(width, height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = (2 * Math.atan(height / 2 / PERSPECTIVE) * 180) / Math.PI;
      camera.updateProjectionMatrix();
      const layout = packLayout(width, height);
      root.scale.setScalar(layout.width / REF_W);
      center = height / 2 - layout.center;
      size = { width, height };
      pack = { width: layout.width, height: layout.height };
      if (!frame) renderer.render(scene, camera);
      return layout;
    },
    look(x, y) { pointer = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) }; },
    tear(progress) {
      peel = clamp(progress);
      level = peel > 0;
      curl(peel);
    },
    fling() {
      curl(1);
      flight = { start: performance.now(), vx: 520, vy: 520, vz: 260, spin: 2.2 };
    },
    async drop() {
      level = true;
      await animate(root.userData.offset ?? 0, -size.height * 1.1, 520, easeIn);
      root.visible = false;
    },
    show(tint) {
      return begin(FULL, new THREE.Color(...tint));
    },
    arrive(tint) {
      if (still) {
        level = false;
        peel = 0;
        curl(0);
        strip.position.set(0, 0, 0);
        strip.rotation.set(0, 0, 0);
        strip.visible = true;
        flight = null;
        root.userData.offset = 0;
        root.visible = true;
        run();
        return Promise.resolve();
      }
      return begin(SHORT, new THREE.Color(...tint));
    },
    skip() {
      if (entrance && !entrance.landed) entrance.start = clock() - entrance.plan.fall[1];
    },
    burst(x, y, tint, power) {
      sparkle(clock(), x - size.width / 2, size.height / 2 - y, new THREE.Color(...tint), Math.round(140 * power), power);
      run();
    },
    gather(x, y, tint) {
      const t = clock();
      sparks.emit(t - 0.5, converge(x - size.width / 2, size.height / 2 - y, new THREE.Color(...tint), 110, [0.5, 0.8]));
      run();
    },
    ambient(x, y, width, height, tint) {
      const color = new THREE.Color(...tint);
      const list: Spark[] = [];
      for (let i = 0; i < 26; i++) {
        list.push({
          x: x - size.width / 2 + random(-0.75, 0.75) * width, y: size.height / 2 - y + random(-0.65, 0.65) * height, z: random(-40, 120),
          vx: random(-10, 10), vy: random(14, 40), life: random(2, 3.4), size: random(1, 2.8), color: shade(color, 0.4 + Math.random() * 0.6),
          star: Math.random() < 0.35, delay: random(0, 1.4),
        });
      }
      sparks.emit(clock(), list);
      run();
    },
    dispose() {
      halt();
      document.removeEventListener("visibilitychange", onVisibility);
      body.geometry.dispose();
      backGeometry.dispose();
      stripGeometry.dispose();
      printed.dispose();
      printedBack.dispose();
      inside.dispose();
      textures.forEach(texture => texture.dispose());
      sparks.dispose();
      beam.dispose();
      halo.dispose();
      ring.dispose();
      environment.dispose();
      renderer.dispose();
    },
  };
}
