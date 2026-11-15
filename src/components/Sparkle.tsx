"use client";
import { useEffect, useRef } from "react";

const BLEED = 14;

const VERTEX = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

const FRAGMENT = `
precision highp float;
uniform vec4 rect;
uniform float radius;
uniform float time;
uniform vec2 light;
uniform float hover;
uniform float dpr;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 hash2(vec2 p) { float n = hash(p); return vec2(n, hash(p + n + 19.19)); }
float roundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
vec3 spectrum(float t) { return .5 + .5 * cos(6.28318 * (t + vec3(0., .33, .67))); }

float star(vec2 q, float size) {
  q /= size;
  float r = length(q);
  float core = exp(-r * r * 14.);
  float rays = exp(-abs(q.x) * 36.) * exp(-abs(q.y) * 1.5) + exp(-abs(q.y) * 36.) * exp(-abs(q.x) * 1.5);
  vec2 d = vec2(q.x + q.y, q.x - q.y) * .7071;
  float diagonal = exp(-abs(d.x) * 44.) * exp(-abs(d.y) * 4.) + exp(-abs(d.y) * 44.) * exp(-abs(d.x) * 4.);
  return core * 1.4 + rays * .9 + diagonal * .35;
}

void main() {
  vec2 p = gl_FragCoord.xy;
  vec2 c = (rect.xy + rect.zw) * .5;
  vec2 h = (rect.zw - rect.xy) * .5;
  float d = roundBox(p - c, h, radius);
  float inside = 1. - smoothstep(-.75, .75, d);
  vec2 uv = (p - rect.xy) / (rect.zw - rect.xy);

  float phase = uv.x * .85 + uv.y * .4 + light.x * .3 - light.y * .18 + time * .07;
  vec3 holo = mix(spectrum(phase), vec3(1.), .28);
  float grating = .5 + .5 * sin((p.x * .62 + p.y * 1.4) / dpr * 1.25 - time * 2.4);
  vec3 silver = mix(vec3(.70, .72, .79), vec3(.95, .95, .98), smoothstep(-.1, 1.1, uv.y));
  vec3 foil = silver * mix(vec3(1.), holo * 1.08, .7) * (.92 + .08 * grating);

  float sweep = fract(time * .21) * 2.8 - .9;
  float band = uv.x + (uv.y - .5) * .55;
  float sheen = exp(-pow((band - sweep) * 5.5, 2.)) * .6 + exp(-pow((band - sweep + .12) * 14., 2.)) * .35;
  vec2 lit = (light * .5 + .5);
  float spot = exp(-pow(length((uv - lit) * vec2(h.x / h.y, 1.)) * 1.4, 2.)) * hover * .45;
  foil += vec3(sheen + spot);

  float g = 3. * dpr;
  vec2 cell = floor(p / g);
  vec2 rnd = hash2(cell);
  vec2 local = fract(p / g) - .5 - (hash2(cell + 7.7) - .5) * .4;
  float angle = time * 1.7 + light.x * 2.6 + light.y * 1.3 + uv.x * 2.2 - uv.y * 1.1;
  float glint = pow(max(0., cos(rnd.x * 6.28318 - angle)), 40.) * step(.35, rnd.y);
  float speck = exp(-dot(local, local) * 26.);
  vec3 glitter = mix(vec3(1.), spectrum(rnd.y * 3. + time * .1), .45) * glint * speck * 2.2;

  float rim = smoothstep(-2.4 * dpr, -.3 * dpr, d) * inside;
  foil = mix(foil, vec3(1.), rim * .6);

  float outside = max(d, 0.) / dpr;
  float aura = exp(-outside / 6.) * (1. - inside) * (.32 + .3 * hover);
  vec3 auraColor = spectrum(phase + .15 + atan(p.y - c.y, p.x - c.x) * .16) * aura;
  float line = (1. - smoothstep(0., 1.1 * dpr, abs(d + .4 * dpr))) * .5;

  vec3 glints = vec3(0.);
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float t = time * (.46 + fi * .037) + fi * .173;
    float k = floor(t);
    vec2 r = hash2(vec2(k, fi * 7.13));
    vec2 at = rect.xy + h * 2. * (r * .92 + .04);
    float life = pow(sin(fract(t) * 3.14159), 3.);
    float size = (5. + 9. * hash(vec2(k, fi + 3.))) * dpr * (1. + hover * .35);
    glints += star(p - at, size) * life * mix(vec3(1.), spectrum(r.x + r.y), .3);
  }

  vec3 color = foil * inside + glitter * inside + glints + auraColor;
  color = mix(color, vec3(.26, .2, .38), line * inside);
  color = min(color, vec3(1.));
  float alpha = max(inside, max(color.r, max(color.g, color.b)));
  gl_FragColor = vec4(color, min(alpha, 1.));
}`;

function compile(gl: WebGLRenderingContext) {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]] as const) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

export function Sparkle() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false });
    const program = gl && compile(gl);
    if (!gl || !program) return;
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const u = { rect: uniform("rect"), radius: uniform("radius"), time: uniform("time"), light: uniform("light"), hover: uniform("hover"), dpr: uniform("dpr") };
    host.dataset.sparkle = "on";

    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = { x: 0, y: 0, tx: 0, ty: 0, hover: 0, target: 0 };
    let frame = 0;
    let visible = true;
    let last = performance.now();
    let clock = 3.7;

    const draw = () => {
      gl.uniform1f(u.time, clock);
      gl.uniform2f(u.light, state.x, state.y);
      gl.uniform1f(u.hover, state.hover);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const size = () => {
      const dpr = Math.min(devicePixelRatio, 2);
      const w = host.offsetWidth;
      const h = host.offsetHeight;
      canvas.width = Math.round((w + BLEED * 2) * dpr);
      canvas.height = Math.round((h + BLEED * 2) * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform4f(u.rect, BLEED * dpr, BLEED * dpr, (BLEED + w) * dpr, (BLEED + h) * dpr);
      gl.uniform1f(u.radius, Math.min(h / 2, parseFloat(getComputedStyle(host).borderTopLeftRadius) || 8) * dpr);
      gl.uniform1f(u.dpr, dpr);
      draw();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      const ease = 1 - Math.exp(-dt * 8);
      state.x += (state.tx - state.x) * ease;
      state.y += (state.ty - state.y) * ease;
      state.hover += (state.target - state.hover) * ease;
      draw();
      frame = requestAnimationFrame(tick);
    };
    const run = () => {
      if (still || frame || !visible || document.hidden) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };
    const halt = () => { cancelAnimationFrame(frame); frame = 0; };

    const onMove = (event: PointerEvent) => {
      const box = host.getBoundingClientRect();
      state.tx = ((event.clientX - box.left) / box.width) * 2 - 1;
      state.ty = 1 - ((event.clientY - box.top) / box.height) * 2;
      state.target = 1;
    };
    const onLeave = () => { state.tx = 0; state.ty = 0; state.target = 0; };
    const onVisibility = () => (document.hidden ? halt() : run());
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    const resize = new ResizeObserver(size);
    resize.observe(host);
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) run(); else halt();
    });
    seen.observe(host);
    size();
    run();

    return () => {
      halt();
      resize.disconnect();
      seen.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      delete host.dataset.sparkle;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <canvas ref={ref} className="sparkle-canvas" aria-hidden="true" />;
}
