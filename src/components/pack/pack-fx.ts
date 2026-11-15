import * as THREE from "three";
import { PERSPECTIVE } from "./pack-layout";

const LIGHT = {
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  transparent: true,
  depthWrite: false,
} as const;

const EMIT = `
  vec3 c = min(glow, vec3(1.));
  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
`;

const MAX = 2400;

export type Spark = {
  x: number; y: number; z?: number;
  vx: number; vy: number; vz?: number;
  life: number; size: number; color: THREE.Color;
  star?: boolean; drag?: number; gravity?: number; delay?: number;
};

export function createSparks(pixelRatio: number) {
  const geometry = new THREE.BufferGeometry();
  const origin = new Float32Array(MAX * 3);
  const velocity = new Float32Array(MAX * 3);
  const timing = new Float32Array(MAX * 4).fill(-1e6);
  const tint = new Float32Array(MAX * 4);
  const motion = new Float32Array(MAX * 2);
  const attributes = {
    position: new THREE.BufferAttribute(origin, 3),
    velocity: new THREE.BufferAttribute(velocity, 3),
    timing: new THREE.BufferAttribute(timing, 4),
    tint: new THREE.BufferAttribute(tint, 4),
    motion: new THREE.BufferAttribute(motion, 2),
  };
  for (const [name, attribute] of Object.entries(attributes)) geometry.setAttribute(name, attribute);

  const material = new THREE.ShaderMaterial({
    ...LIGHT,
    uniforms: { now: { value: 0 }, pixel: { value: pixelRatio }, distance: { value: PERSPECTIVE } },
    vertexShader: `
      uniform float now; uniform float pixel; uniform float distance;
      attribute vec3 velocity; attribute vec4 timing; attribute vec4 tint; attribute vec2 motion;
      varying vec3 vColor; varying float vAlpha; varying float vStar;
      void main() {
        float age = now - timing.x;
        if (age < 0. || age > timing.y) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
        float k = motion.x;
        vec3 travel = k > 0. ? velocity * (1. - exp(-k * age)) / k : velocity * age;
        vec3 at = position + travel - vec3(0., .5 * motion.y * age * age, 0.);
        vec4 view = modelViewMatrix * vec4(at, 1.);
        gl_Position = projectionMatrix * view;
        float t = age / timing.y;
        float fade = smoothstep(0., .1, t) * (1. - smoothstep(.55, 1., t));
        float twinkle = .62 + .38 * sin(age * (8. + timing.w * 13.) + timing.w * 40.);
        vAlpha = fade * twinkle;
        vColor = tint.rgb;
        vStar = tint.a;
        gl_PointSize = timing.z * pixel * (distance / max(1., -view.z)) * (vStar > .5 ? 3.2 : 1.6);
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vAlpha; varying float vStar;
      void main() {
        vec2 q = gl_PointCoord * 2. - 1.;
        float r2 = dot(q, q);
        float light = exp(-r2 * 14.) * 1.3 + exp(-r2 * 4.) * .3;
        if (vStar > .5) {
          light = exp(-r2 * 60.) * 2. + exp(-abs(q.x) * 30.) * exp(-abs(q.y) * 2.6) + exp(-abs(q.y) * 30.) * exp(-abs(q.x) * 2.6);
          light *= 1. - smoothstep(.7, 1., sqrt(r2));
        }
        vec3 glow = vColor * light * vAlpha;
        ${EMIT}
      }`,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 20;
  let head = 0;
  let until = 0;

  return {
    object: points,
    emit(now: number, sparks: Spark[]) {
      for (const spark of sparks) {
        const i = head;
        head = (head + 1) % MAX;
        origin.set([spark.x, spark.y, spark.z ?? 0], i * 3);
        velocity.set([spark.vx, spark.vy, spark.vz ?? 0], i * 3);
        const born = now + (spark.delay ?? 0);
        timing.set([born, spark.life, spark.size, Math.random()], i * 4);
        tint.set([spark.color.r, spark.color.g, spark.color.b, spark.star ? 1 : 0], i * 4);
        motion.set([spark.drag ?? 0, spark.gravity ?? 0], i * 2);
        until = Math.max(until, born + spark.life);
      }
      for (const attribute of Object.values(attributes)) attribute.needsUpdate = true;
    },
    tick(now: number) { material.uniforms.now.value = now; },
    alive(now: number) { return now < until; },
    dispose() { geometry.dispose(); material.dispose(); },
  };
}

function glowPlane(fragment: string, uniforms: Record<string, THREE.IUniform>, order: number) {
  const material = new THREE.ShaderMaterial({
    ...LIGHT,
    uniforms: { level: { value: 0 }, color: { value: new THREE.Color(1, 1, 1) }, now: { value: 0 }, ...uniforms },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
    fragmentShader: `uniform float level; uniform vec3 color; uniform float now; varying vec2 vUv; ${fragment}`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  mesh.visible = false;
  return {
    mesh, material,
    set(level: number) {
      material.uniforms.level.value = level;
      mesh.visible = level > 0.002;
    },
    dispose() { mesh.geometry.dispose(); material.dispose(); },
  };
}

export function createBeam() {
  return glowPlane(`
    void main() {
      float x = (vUv.x - .5) * 2.;
      float streaks = .72 + .28 * sin(vUv.x * 57. + now * 2.7) * sin(vUv.x * 21. - now * 1.6 + vUv.y * 3.);
      float core = exp(-x * x * 18.) * streaks;
      float wide = exp(-x * x * 2.8) * .28;
      float reach = smoothstep(0., .4, vUv.y) * (.75 + .25 * vUv.y);
      vec3 glow = color * (core * 1.25 + wide) * reach * level;
      ${EMIT}
    }`, {}, 1);
}

export function createHalo() {
  return glowPlane(`
    void main() {
      vec2 q = vUv * 2. - 1.;
      float r2 = dot(q, q);
      float rays = .82 + .18 * sin(atan(q.y, q.x) * 14. + now * .9) * sin(atan(q.y, q.x) * 5. - now * .6);
      vec3 glow = color * (exp(-r2 * 9.) * 1.2 + exp(-r2 * 2.6) * .45 * rays) * level;
      ${EMIT}
    }`, {}, 2);
}

export function createRing() {
  return glowPlane(`
    uniform float radius;
    void main() {
      float r = length(vUv * 2. - 1.);
      float width = .012 + radius * .05;
      float band = exp(-pow((r - radius) / width, 2.)) + exp(-pow((r - radius * .9) / (width * 3.), 2.)) * .25;
      vec3 glow = color * band * (1. - radius) * level;
      ${EMIT}
    }`, { radius: { value: 0 } }, 21);
}
