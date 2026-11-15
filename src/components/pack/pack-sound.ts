let context: AudioContext | null = null;
let hiss: AudioBuffer | null = null;
let muted: boolean | null = null;
const listeners = new Set<() => void>();

export function isMuted() {
  muted ??= localStorage.getItem("pack-muted") === "1";
  return muted;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setMuted(value: boolean) {
  muted = value;
  localStorage.setItem("pack-muted", value ? "1" : "0");
  listeners.forEach(listener => listener());
}

export function wake() {
  if (isMuted()) return;
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume();
}

function ready() {
  if (isMuted() || !context || context.state !== "running") return null;
  if (!hiss) {
    hiss = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = hiss.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return context;
}

function burst(ctx: AudioContext, { at = 0, length, gain, type, frequency, q = 1, sweep }: {
  at?: number; length: number; gain: number; type: BiquadFilterType; frequency: number; q?: number; sweep?: number;
}) {
  const start = ctx.currentTime + at;
  const source = ctx.createBufferSource();
  source.buffer = hiss;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(frequency, start);
  if (sweep) filter.frequency.exponentialRampToValueAtTime(sweep, start + length);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(gain, start + Math.min(0.01, length / 4));
  amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
  source.connect(filter).connect(amp).connect(ctx.destination);
  source.start(start, Math.random() * 0.5, length + 0.05);
}

function tone(ctx: AudioContext, { at = 0, frequency, to, length, gain, type = "sine" }: {
  at?: number; frequency: number; to?: number; length: number; gain: number; type?: OscillatorType;
}) {
  const start = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + length);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + 0.05);
}

export function crinkle(amount: number) {
  const ctx = ready();
  if (!ctx || amount <= 0) return;
  burst(ctx, { length: 0.03 + Math.random() * 0.03, gain: Math.min(0.18, amount * 0.05), type: "bandpass", frequency: 2500 + Math.random() * 4000, q: 2.5 });
}

export function give() {
  const ctx = ready();
  if (!ctx) return;
  burst(ctx, { length: 0.09, gain: 0.32, type: "bandpass", frequency: 1800, q: 1.2 });
  tone(ctx, { frequency: 170, to: 60, length: 0.12, gain: 0.25 });
}

export function rip() {
  const ctx = ready();
  if (!ctx) return;
  burst(ctx, { length: 0.28, gain: 0.3, type: "bandpass", frequency: 900, sweep: 5200, q: 0.9 });
  burst(ctx, { at: 0.05, length: 0.2, gain: 0.14, type: "highpass", frequency: 4000 });
}

export function flip() {
  const ctx = ready();
  if (!ctx) return;
  burst(ctx, { length: 0.05, gain: 0.16, type: "highpass", frequency: 2600 });
  tone(ctx, { frequency: 520, to: 780, length: 0.07, gain: 0.05, type: "triangle" });
}

export function swell(secret: boolean) {
  const ctx = ready();
  if (!ctx) return;
  const base = secret ? 330 : 294;
  for (const [index, ratio] of [1, 1.5, 2.01].entries()) {
    tone(ctx, { at: index * 0.04, frequency: base * ratio, to: base * ratio * 2, length: 0.9, gain: 0.05 });
  }
  burst(ctx, { length: 0.9, gain: 0.08, type: "bandpass", frequency: 1200, sweep: 7000, q: 3 });
}

export function chime(secret: boolean) {
  const ctx = ready();
  if (!ctx) return;
  const notes = secret ? [784, 988, 1175, 1568] : [659, 831, 988];
  notes.forEach((frequency, index) => {
    tone(ctx, { at: index * 0.07, frequency, length: 1.6, gain: 0.09 });
    tone(ctx, { at: index * 0.07, frequency: frequency * 2.01, length: 0.8, gain: 0.025 });
  });
}

export function buzz(ms: number) {
  if ("vibrate" in navigator) navigator.vibrate(ms);
}
