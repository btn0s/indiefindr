import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CRIMP, PERSPECTIVE, RATIO, STRIP, packLayout, type PackLayout } from "./pack-layout";

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

async function printPack(print: PackPrint) {
  const [art, still] = await Promise.all([loadImage(print.art), loadImage(print.still)]);
  const color = document.createElement("canvas");
  const orm = document.createElement("canvas");
  color.width = orm.width = TEX_W;
  color.height = orm.height = TEX_H;
  const c = color.getContext("2d")!;
  const o = orm.getContext("2d")!;
  const k = TEX_W / REF_W;
  const crimp = CRIMP * TEX_H;
  const tear = STRIP * TEX_H;
  const frame = 7 * k;
  const ink = "rgb(0,107,51)";
  const foil = "rgb(64,64,255)";
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

  return { color, orm };
}

export type PackScene = {
  layout(width: number, height: number): PackLayout;
  look(x: number, y: number): void;
  tear(progress: number): void;
  fling(): void;
  drop(): Promise<void>;
  arrive(): Promise<void>;
  dispose(): void;
};

export async function createPackScene(canvas: HTMLCanvasElement, print: PackPrint, still: boolean): Promise<PackScene> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = 1.1;
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-300, 500, 900);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(45, 1, 1, PERSPECTIVE * 4);
  camera.position.set(0, 0, PERSPECTIVE);

  const { color, orm } = await printPack(print);
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = anisotropy;
  const surface = new THREE.CanvasTexture(orm);
  surface.anisotropy = anisotropy;

  const printed = new THREE.MeshPhysicalMaterial({
    map, metalnessMap: surface, roughnessMap: surface, iridescenceMap: surface,
    metalness: 1, roughness: 1, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessMinimum: 180, iridescenceThicknessMaximum: 520,
    clearcoat: 1, clearcoatRoughness: 0.12, alphaTest: 0.5,
  });
  const inside = new THREE.MeshPhysicalMaterial({ color: 0xdfe2e8, metalness: 1, roughness: 0.32, side: THREE.BackSide });

  const root = new THREE.Group();
  const body = new THREE.Mesh(panel(-REF_H / 2, TEAR_Y, 132), printed);
  const stripGeometry = panel(TEAR_Y, REF_H / 2, 14);
  const rest = Float32Array.from(stripGeometry.attributes.position.array as ArrayLike<number>);
  const strip = new THREE.Group();
  strip.add(new THREE.Mesh(stripGeometry, printed), new THREE.Mesh(stripGeometry, inside));
  root.add(body, strip);
  scene.add(root);

  let size = { width: 0, height: 0 };
  let center = 0;
  let pointer = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0, vx: 0, vy: 0 };
  let peel = 0;
  let flight: { start: number; vx: number; vy: number; vz: number; spin: number } | null = null;
  let tween: { from: number; to: number; start: number; duration: number; ease: (t: number) => number; done: () => void } | null = null;
  let level = false;
  let frame = 0;
  let last = performance.now();
  const born = last;

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

  const render = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - born) / 1000;
    const sway = still || level ? 0 : 1;
    const targetY = level ? 0 : pointer.x * 0.32 + Math.sin(t * 0.7) * 0.05 * sway;
    const targetX = level ? 0 : -pointer.y * 0.22 + Math.sin(t * 0.9 + 1) * 0.03 * sway;
    const stiffness = 90;
    const damping = 2 * Math.sqrt(stiffness) * 0.9;
    tilt.vy += ((targetY - tilt.y) * stiffness - tilt.vy * damping) * dt;
    tilt.vx += ((targetX - tilt.x) * stiffness - tilt.vx * damping) * dt;
    tilt.y += tilt.vy * dt;
    tilt.x += tilt.vx * dt;
    root.rotation.set(tilt.x, tilt.y, 0);
    scene.environmentRotation.set(-tilt.x * 0.8, tilt.y * 1.6 + 0.4, 0);

    let offset = 0;
    if (tween) {
      const p = clamp((now - tween.start) / tween.duration);
      offset = tween.from + (tween.to - tween.from) * tween.ease(p);
      if (p >= 1) { const done = tween.done; tween = null; done(); }
    } else if (root.userData.offset !== undefined) offset = root.userData.offset;
    root.userData.offset = offset;
    root.position.set(0, center + offset + (still || level ? 0 : Math.sin(t * 1.1) * 3), 0);

    if (flight) {
      const s = (now - flight.start) / 1000;
      strip.position.set(flight.vx * s, flight.vy * s - 1400 * s * s, flight.vz * s);
      strip.rotation.set(flight.spin * s * 0.4, 0, -flight.spin * s);
      if (s > 1.4) { strip.visible = false; flight = null; }
    }

    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
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
      renderer.render(scene, camera);
      halt();
    },
    async arrive() {
      level = false;
      peel = 0;
      curl(0);
      strip.position.set(0, 0, 0);
      strip.rotation.set(0, 0, 0);
      strip.visible = true;
      flight = null;
      root.visible = true;
      await animate(size.height * 1.1, 0, 640, easeOut);
    },
    dispose() {
      halt();
      document.removeEventListener("visibilitychange", onVisibility);
      body.geometry.dispose();
      stripGeometry.dispose();
      printed.dispose();
      inside.dispose();
      map.dispose();
      surface.dispose();
      environment.dispose();
      renderer.dispose();
    },
  };
}
