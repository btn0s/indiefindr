"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, Volume2, VolumeX } from "lucide-react";
import { GameplayLoop } from "@/components/GameplayLoop";
import { Sparkle } from "@/components/Sparkle";
import { RatingChip } from "@/components/Rating";
import { SwordMark } from "@/components/SwordMark";
import { smallCopy } from "@/lib/hero";
import { FINDS, type CardClass, type PackCard } from "@/lib/packs";
import { CARD_RATIO, packLayout } from "./pack-layout";
import type { PackScene, Tint } from "./pack-scene";
import * as sound from "./pack-sound";

export type Seed = { appid: number; title: string; art: string | null; still: string | null };

const MOTION = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (listener: () => void) => {
  const query = matchMedia(MOTION);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};

type Phase = "show" | "sealed" | "opening" | "rising" | "deck" | "ready" | "walkout" | "fan" | "leaving" | "arriving";
type Step = "lift" | "veil" | "stamp";

const CLASS_NAME: Record<CardClass, string> = {
  classic: "Classic", cult: "Cult", gem: "Gem", secret: "Secret", uncharted: "Uncharted", prerelease: "Prerelease",
};

const setCode = (title: string) => {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.slice(0, 3).map(word => word[0]).join("") : (words[0] ?? "IF").slice(0, 3)).toUpperCase();
};

const releaseLabel = (release: string | null) => {
  if (!release) return "Coming soon";
  const date = new Date(`${release}T00:00:00Z`);
  return `Coming ${date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}`;
};

const isFind = (card: PackCard | undefined) => !!card && FINDS.includes(card.cls);

const TINT: Partial<Record<CardClass, Tint>> = { gem: [0.72, 0.56, 1], secret: [1, 0.8, 0.42] };
const tintOf = (pack: PackCard[] | undefined): Tint => TINT[pack?.[pack.length - 1]?.cls ?? "classic"] ?? [0.8, 0.88, 1];

function Verdict({ card }: { card: PackCard }) {
  if (card.cls === "prerelease") return <span className="card-stamp">{card.earlyAccess ? "Early Access soon" : releaseLabel(card.release)}</span>;
  if (card.cls === "uncharted") return <span className="card-first">Only {card.reviews.toLocaleString("en-US")} reviews so far</span>;
  return <>
    <RatingChip pct={card.rating} count={card.reviews} />
    <span className="card-reviews">{card.reviews.toLocaleString("en-US")} reviews</span>
  </>;
}

const RARITY: Record<CardClass, string> = { classic: "●", cult: "◆", uncharted: "○", prerelease: "◇", gem: "✦", secret: "★" };

function CardFront({ card, number, setSize, code, clip, onClip }: {
  card: PackCard; number: number | null; setSize: number; code: string; clip: boolean; onClip?: () => void;
}) {
  const full = isFind(card);
  const cover = !full && card.art;
  const still = card.still ? (full ? card.still : smallCopy(card.still)) : card.image;
  const picture = cover || still;
  const finishes = [card.fresh && "Fresh", card.earlyAccess && card.cls !== "prerelease" && "Early Access"].filter(Boolean) as string[];
  return (
    <div className="pack-card-face pack-card-front">
      <div className="card-window" data-cover={!!cover}>
        <div className="card-art">
          {picture && <Image src={picture} alt="" fill sizes={full ? "420px" : "320px"} draggable={false} />}
          {clip && card.clip && <GameplayLoop src={card.clip} threshold={0.2} onLoaded={onClip} />}
        </div>
        <div className="card-shine" aria-hidden="true"><div className="card-rainbow" /><div className="card-glitter" /></div>
        {full && <div className="card-tags-flash" aria-hidden="true">{card.tags.map((tag, index) => <span key={tag} style={{ "--i": index } as CSSProperties}>{tag}</span>)}</div>}
        <div className="card-info">
          <div className="card-top">
            <span className="card-class"><span className="card-gem" aria-hidden="true">{RARITY[card.cls]}</span>{CLASS_NAME[card.cls]}</span>
            {finishes.map(finish => <span key={finish} className="card-finish">{finish}</span>)}
          </div>
          <div className="card-title">{card.title}</div>
          {!!card.tags.length && <p className="card-tags">{card.tags.join(", ")}</p>}
          <div className="card-verdict"><Verdict card={card} /></div>
          {card.via && <p className="card-via">via {card.via.title}</p>}
          <div className="card-foot">
            <SwordMark className="card-mark" />
            <span>{code}</span>
            <span>{number ? `${String(number).padStart(2, "0")}/${setSize}` : "★"}</span>
          </div>
        </div>
      </div>
      <div className="card-sheen" aria-hidden="true" />
      <div className="card-glare" />
    </div>
  );
}

function CardBack() {
  return (
    <div className="pack-card-face pack-card-back" aria-hidden="true">
      <div className="back-field">
        <div className="back-ring"><SwordMark /></div>
        <span className="back-word">indiefindr</span>
      </div>
      <div className="card-sheen" />
    </div>
  );
}

function glitterTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d");
  if (!c) return "";
  c.fillStyle = "#000";
  c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 520; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 0.4 + Math.random() ** 3 * 2.2;
    const light = 140 + Math.random() * 115;
    const glow = c.createRadialGradient(x, y, 0, x, y, r * 2.4);
    glow.addColorStop(0, `rgb(${light},${light},${light})`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = glow;
    c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    if (r > 1.6) {
      c.fillStyle = `rgba(255,255,255,${light / 400})`;
      c.fillRect(x - r * 4, y - 0.4, r * 8, 0.8);
      c.fillRect(x - 0.4, y - r * 4, 0.8, r * 8);
    }
  }
  return `url(${canvas.toDataURL("image/png")})`;
}

const subscribeNothing = () => () => {};
let glitter: string | null = null;
const glitterSnapshot = () => (glitter ??= glitterTexture());

function useStage<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setSize({ w: element.clientWidth, h: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

export function PackOpening({ seed, packs, setSize, printed }: { seed: Seed; packs: PackCard[][]; setSize: number; printed: string }) {
  const [stageRef, stage] = useStage<HTMLElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scene = useRef<PackScene | null>(null);
  const [gl, setGl] = useState<"wait" | "on" | "off">("wait");
  const [phase, setPhase] = useState<Phase>("show");
  const [packIndex, setPackIndex] = useState(0);
  const [cardIndex, setCardIndex] = useState(0);
  const [faceUp, setFaceUp] = useState(0);
  const [step, setStep] = useState<Step>("lift");
  const [inspect, setInspect] = useState<number | null>(null);
  const reduced = useSyncExternalStore(subscribeMotion, () => matchMedia(MOTION).matches, () => false);
  const muted = useSyncExternalStore(sound.subscribe, sound.isMuted, () => false);
  const glitterUrl = useSyncExternalStore(subscribeNothing, glitterSnapshot, () => "");
  const [peeling, setPeeling] = useState(false);
  const peel = useRef(0);
  const clipReady = useRef(false);
  const drag = useRef<{ id: number; x: number; from: number; given: boolean; last: number } | null>(null);
  const timers = useRef<number[]>([]);
  const firstPack = useRef(packs[0]);
  const code = useMemo(() => setCode(seed.title), [seed.title]);
  const numbers = useMemo(() => { let n = 0; return packs.map(pack => pack.map(card => (card.via ? null : ++n))); }, [packs]);

  const pack = useMemo(() => packs[packIndex] ?? [], [packs, packIndex]);
  const finale = isFind(pack[pack.length - 1]) ? pack.length - 1 : -1;
  const layout = packLayout(stage.w || 393, stage.h || 700);
  const found = numbers.slice(0, packIndex).flat().filter(Boolean).length + (numbers[packIndex] ?? []).slice(0, faceUp).filter(Boolean).length;

  const later = useCallback((fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let live = true;
    let made: PackScene | null = null;
    void (async () => {
      try {
        await document.fonts.ready;
        const { createPackScene } = await import("./pack-scene");
        made = await createPackScene(canvas, {
          art: seed.art, still: seed.still, title: seed.title, code, printed, font: getComputedStyle(document.body).fontFamily,
        }, matchMedia(MOTION).matches);
        if (!live) { made.dispose(); return; }
        scene.current = made;
        made.layout(canvas.clientWidth, canvas.clientHeight);
        setGl("on");
        if (matchMedia(MOTION).matches) { setPhase("sealed"); return; }
        sound.rise();
        await made.show(tintOf(firstPack.current));
        if (!live) return;
        sound.land(firstPack.current?.[firstPack.current.length - 1]?.cls === "secret");
        sound.buzz(24);
        setPhase("sealed");
      } catch {
        if (live) { setGl("off"); setPhase("sealed"); }
      }
    })();
    return () => { live = false; made?.dispose(); scene.current = null; };
  }, [seed.art, seed.still, seed.title, code, printed]);

  useEffect(() => {
    if (stage.w && stage.h) scene.current?.layout(stage.w, stage.h);
  }, [stage.w, stage.h, gl]);

  const setPeel = (value: number) => {
    peel.current = value;
    scene.current?.tear(value);
  };

  const tweenPeel = (to: number, ms: number, done?: () => void) => {
    const from = peel.current;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setPeel(from + (to - from) * (1 - (1 - p) ** 3));
      if (p < 1) requestAnimationFrame(tick);
      else done?.();
    };
    requestAnimationFrame(tick);
  };

  const flipTo = useCallback((count: number) => {
    setFaceUp(count);
    sound.flip();
  }, []);

  const open = () => {
    if (phase !== "sealed") return;
    setPhase("opening");
    setPeeling(false);
    scene.current?.fling();
    sound.rip();
    sound.buzz(14);
    const quick = reduced || gl !== "on";
    later(() => setPhase("rising"), quick ? 0 : 140);
    later(() => { void scene.current?.drop(); setPhase(finale === 0 ? "ready" : "deck"); }, quick ? 10 : 900);
    if (finale !== 0) later(() => flipTo(1), quick ? 40 : 1480);
  };

  const openByButton = () => {
    if (phase !== "sealed") return;
    sound.wake();
    setPeeling(true);
    if (reduced || gl !== "on") { open(); return; }
    tweenPeel(1, 640, open);
  };

  const walkout = () => {
    setPhase("walkout");
    setStep("lift");
    const secret = pack[finale]?.cls === "secret";
    const tint = tintOf(pack);
    sound.swell(secret);
    sound.buzz(20);
    if (!reduced) scene.current?.gather(stage.w / 2, deckY, tint);
    let started = 0;
    const reveal = () => {
      started ||= performance.now();
      if (!clipReady.current && performance.now() - started < 1100 && !reduced) { later(reveal, 80); return; }
      setFaceUp(pack.length);
      setStep("veil");
      sound.flip();
      if (!reduced) scene.current?.burst(stage.w / 2, deckY, tint, secret ? 1.5 : 1.2);
      later(() => {
        setStep("stamp");
        sound.chime(secret);
        sound.buzz(30);
        if (!reduced) scene.current?.burst(stage.w / 2, deckY, tint, 0.55);
      }, reduced ? 0 : 2400);
    };
    later(reveal, reduced ? 0 : 560);
  };

  const advance = () => {
    if (phase === "ready") { walkout(); return; }
    if (phase === "walkout") { if (step === "stamp") setPhase("fan"); return; }
    if (phase !== "deck") return;
    if (faceUp <= cardIndex) { flipTo(cardIndex + 1); return; }
    const next = cardIndex + 1;
    if (next >= pack.length) { setPhase("fan"); return; }
    setCardIndex(next);
    if (next === finale) { setPhase("ready"); return; }
    later(() => flipTo(next + 1), reduced ? 0 : 280);
  };

  const nextPack = () => {
    if (packIndex + 1 >= packs.length) return;
    setInspect(null);
    setPhase("leaving");
    later(() => {
      setPackIndex(index => index + 1);
      setCardIndex(0);
      setFaceUp(0);
      setStep("lift");
      clipReady.current = false;
      peel.current = 0;
      setPhase("arriving");
      const coming = packs[packIndex + 1];
      const done = () => {
        if (!reduced) { sound.land(coming?.[coming.length - 1]?.cls === "secret"); sound.buzz(16); }
        setPhase("sealed");
      };
      if (scene.current) void scene.current.arrive(tintOf(coming)).then(done);
      else done();
    }, 320);
  };

  const onTearDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase !== "sealed") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, from: peel.current, given: peel.current > 0.12, last: event.clientX };
    setPeeling(true);
  };

  const onTearMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const raw = d.from + (event.clientX - d.x) / (layout.width * 0.85);
    sound.crinkle(Math.abs(event.clientX - d.last) / 6);
    d.last = event.clientX;
    if (!d.given) {
      setPeel(Math.max(0, raw) * 0.28);
      if (raw > 0.16) { d.given = true; sound.give(); sound.buzz(10); }
    }
    if (d.given) {
      setPeel(Math.max(peel.current, Math.min(1, raw)));
      if (peel.current >= 0.97) { drag.current = null; open(); }
    }
  };

  const onTearUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    if (d.given && peel.current >= 0.45) tweenPeel(1, 220, open);
    else if (!d.given) { tweenPeel(0, 260); setPeeling(false); }
  };

  const onStageMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (phase !== "sealed" || drag.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    scene.current?.look((event.clientX - rect.left - rect.width / 2) / (rect.width / 2), (event.clientY - rect.top - layout.center) / (rect.height / 2));
  };

  const onCardMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" && event.buttons === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    event.currentTarget.style.setProperty("--mx", `${x * 100}%`);
    event.currentTarget.style.setProperty("--my", `${y * 100}%`);
    event.currentTarget.style.setProperty("--px", `${x}`);
    event.currentTarget.style.setProperty("--py", `${y}`);
    event.currentTarget.style.setProperty("--ry", `${(x - 0.5) * 14}deg`);
    event.currentTarget.style.setProperty("--rx", `${(0.5 - y) * 12}deg`);
    event.currentTarget.style.setProperty("--hover", "1");
  };

  const onCardLeave = (event: ReactPointerEvent<HTMLElement>) => {
    for (const name of ["--ry", "--rx", "--hover", "--px", "--py"]) event.currentTarget.style.removeProperty(name);
  };

  const toggleMute = () => {
    sound.setMuted(!muted);
    if (muted) sound.wake();
  };

  const cardW = Math.max(160, Math.min(300, stage.w - 56, (stage.h - 190) / CARD_RATIO));
  const cardH = cardW * CARD_RATIO;
  const deckY = 64 + (stage.h - 64 - 112) / 2;
  const inside = (layout.width * 0.84) / cardW;
  const wide = stage.w >= 700;

  const place = (i: number) => {
    const n = pack.length;
    const mid = (n - 1) / 2;
    const k = i - cardIndex;
    if (phase === "show" || phase === "sealed" || phase === "opening" || phase === "arriving") {
      return { x: stage.w / 2, y: layout.center + 10, s: inside, r: 0, z: 10 + n - i, o: phase === "arriving" || phase === "show" ? 0 : 1, ms: 0 };
    }
    if (phase === "rising") {
      return { x: stage.w / 2 + i * 1.5, y: layout.mouth - inside * cardH * 0.04 + i * 2, s: inside, r: 0, z: 10 + n - i, o: 1, ms: 620 };
    }
    if (phase === "fan" || phase === "leaving") {
      const o = phase === "leaving" ? 0 : 1;
      if (inspect === i) return { x: stage.w / 2, y: deckY - 30, s: Math.min(1, (stage.h - 300) / cardH), r: 0, z: 60, o, ms: 420 };
      if (wide) {
        const s = Math.min(0.62, (stage.w - 80) / (n * cardW + (n - 1) * 20));
        const spacing = cardW * s + 20;
        return { x: stage.w / 2 + (i - mid) * spacing, y: deckY + Math.abs(i - mid) ** 2 * 7, s, r: (i - mid) * 3, z: 10 + i, o, ms: 560 };
      }
      const s = (stage.w - 32 - 20) / 3 / cardW;
      const row = i < 3 ? 0 : 1;
      const inRow = row ? n - 3 : Math.min(3, n);
      const col = row ? i - 3 : i;
      const gap = cardW * s + 10;
      const rows = n > 3 ? 2 : 1;
      const y = deckY + (rows === 2 ? (row ? 1 : -1) * (cardH * s / 2 + 6) : 0);
      return { x: stage.w / 2 + (col - (inRow - 1) / 2) * gap, y, s, r: 0, z: 10 + i, o, ms: 560 };
    }
    if (phase === "walkout" && i === finale) {
      return { x: stage.w / 2, y: deckY, s: step === "lift" ? 1.06 : 1, r: 0, z: 40, o: 1, ms: step === "lift" ? 520 : 700 };
    }
    if (k < 0 || (phase === "walkout" && i !== finale)) {
      return { x: -cardW * 0.7, y: deckY - 30, s: 0.9, r: -14, z: 1 + i, o: 1, ms: 420 };
    }
    return { x: stage.w / 2 + k * 3, y: deckY + k * 4, s: 1, r: k ? (k % 2 ? 1.2 : -0.8) : 0, z: 10 + n - i, o: 1, ms: 640 };
  };

  useEffect(() => {
    if ((phase !== "ready" && phase !== "walkout") || reduced || finale < 0) return;
    const tint = tintOf(pack);
    const emit = () => scene.current?.ambient(stage.w / 2, deckY, cardW, cardH, tint);
    emit();
    const id = window.setInterval(emit, 1400);
    return () => window.clearInterval(id);
  }, [phase, reduced, finale, pack, stage.w, deckY, cardW, cardH]);

  const playing = (i: number) => {
    const card = pack[i];
    if (!card?.clip || reduced) return false;
    if (inspect === i) return true;
    if (["opening", "rising", "deck", "ready", "walkout"].includes(phase)) return i === finale || (i === cardIndex && i < faceUp);
    return false;
  };

  const ready = gl !== "wait" && stage.w > 0;
  const done = packIndex + 1 >= packs.length;
  const sealed = phase === "sealed";
  const current = pack[cardIndex];
  const announce = phase === "deck" && current && faceUp > cardIndex ? `${current.title}, ${CLASS_NAME[current.cls]}`
    : phase === "ready" ? "The last card is glowing" : phase === "walkout" && step === "stamp" && pack[finale] ? `${pack[finale].title}, ${CLASS_NAME[pack[finale].cls]}` : "";

  if (!packs.length) {
    return (
      <main className="pack-stage pack-empty">
        <p>There&apos;s no pack for {seed.title} yet.</p>
        <Link href={`/games/${seed.appid}`}>See games like {seed.title}</Link>
      </main>
    );
  }

  return (
    <main ref={stageRef} className="pack-stage" style={{ "--glitter": glitterUrl || "none" } as CSSProperties} data-phase={phase} data-step={step} data-ready={ready} data-gl={gl} onPointerMove={onStageMove} onPointerDown={() => { sound.wake(); if (phase === "show") scene.current?.skip(); }} onPointerUp={sound.wake}>
      <div className="pack-backdrop" aria-hidden="true">{seed.still && <Image src={smallCopy(seed.still)} alt="" fill sizes="160px" priority />}</div>

      <header className="pack-hud">
        <Link href={`/games/${seed.appid}`} className="pack-set"><ChevronLeft aria-hidden="true" /><span>Games like <strong>{seed.title}</strong></span></Link>
        <p className="pack-count"><span>Pack {packIndex + 1} of {packs.length}</span><span>{found} of {setSize} found</span></p>
        <button type="button" className="pack-mute" onClick={toggleMute} aria-label={muted ? "Turn sound on" : "Turn sound off"} aria-pressed={!muted}>
          {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        </button>
      </header>

      <div className="pack-cards" style={{ "--card-w": `${cardW}px`, "--card-h": `${cardH}px` } as CSSProperties}>
        {gl === "off" && (sealed || phase === "arriving") && (
          <div className="pack-fallback" style={{ width: layout.width, height: layout.height, transform: `translate(${stage.w / 2 - layout.width / 2}px, ${layout.center - layout.height / 2}px)` }}>
            {seed.art && <Image src={seed.art} alt="" fill sizes="280px" />}
            <span>Games like {seed.title}</span>
          </div>
        )}
        {pack.map((card, i) => {
          const spot = place(i);
          const up = i < faceUp;
          const top = (phase === "deck" || phase === "ready") && i === cardIndex;
          const focus = (top && up) || inspect === i || (phase === "walkout" && i === finale);
          const fan = phase === "fan";
          const style = {
            transform: `translate3d(${spot.x - cardW / 2}px, ${spot.y - cardH / 2}px, 0) rotate(${spot.r}deg) scale(${spot.s})`,
            zIndex: spot.z,
            opacity: spot.o,
            transitionDuration: `${spot.ms}ms, ${phase === "leaving" ? 260 : 200}ms`,
            transitionDelay: fan && inspect === null ? `${i * 40}ms` : "0ms",
          } as CSSProperties;
          const label = up ? `${card.title}, ${CLASS_NAME[card.cls]}` : i === finale ? "Glowing card, face down" : "Card, face down";
          const interactive = top || (phase === "walkout" && i === finale) || fan;
          const activate = () => { if (fan) setInspect(inspect === i ? null : i); else if (interactive) advance(); };
          return (
            <div key={`${packIndex}-${card.appid}`} className="pack-card" data-cls={card.cls} data-full={isFind(card)} data-top={top} data-finale={i === finale}
              data-inspect={inspect === i} data-focus={focus} style={style}>
              <div role="button" className="pack-card-hit" tabIndex={interactive ? 0 : -1} aria-hidden={!interactive} aria-label={label}
                onPointerMove={onCardMove} onPointerLeave={onCardLeave} onClick={activate}
                onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } }}>
                <div className="pack-card-flip" data-face={up ? "up" : "down"}>
                  <CardFront card={card} number={numbers[packIndex]?.[i] ?? null} setSize={setSize} code={code}
                    clip={playing(i)} onClip={i === finale ? () => { clipReady.current = true; } : undefined} />
                  <CardBack />
                </div>
              </div>
            </div>
          );
        })}
        {finale >= 0 && <div className="pack-rays" data-cls={pack[finale]?.cls} style={{ top: deckY, left: stage.w / 2 }} aria-hidden="true" />}
        {phase === "walkout" && step === "veil" && <div className="pack-flash" style={{ "--fx": `${stage.w / 2}px`, "--fy": `${deckY}px` } as CSSProperties} aria-hidden="true" />}
      </div>

      <canvas ref={canvasRef} className="pack-canvas" aria-hidden="true" />

      {sealed && ready && (
        <div className="pack-hit" onPointerDown={onTearDown} onPointerMove={onTearMove} onPointerUp={onTearUp} onPointerCancel={onTearUp}
          style={{ width: layout.width + 40, height: layout.height * 0.5, transform: `translate(${stage.w / 2 - layout.width / 2 - 20}px, ${layout.center - layout.height / 2 - 20}px)` }}>
          {!peeling && <span className="pack-guide" style={{ top: layout.mouth - (layout.center - layout.height / 2 - 20), width: layout.width - 24 }} aria-hidden="true" />}
        </div>
      )}

      <div className="pack-controls">
        {sealed && ready && <>
          <p className="pack-hint">{peeling ? "Keep going" : "Drag across the top to tear it open"}</p>
          <button type="button" className="pack-button sparkle" onClick={openByButton}><Sparkle /><span className="sparkle-label">Open pack</span></button>
        </>}
        {(phase === "deck" || phase === "ready" || phase === "walkout") && <>
          <div className="pack-pips" aria-hidden="true">{pack.map((card, i) => <span key={card.appid} data-on={i < faceUp} data-finale={i === finale} />)}</div>
          <p className="pack-hint">{phase === "ready" ? "Something's glowing. Tap to reveal it" : phase === "walkout" ? (step === "stamp" ? "Tap to see your pack" : " ") : faceUp > cardIndex ? "Tap for the next card" : "Tap to flip"}</p>
        </>}
        {phase === "fan" && <>
          {inspect !== null && pack[inspect] ? (
            <div className="pack-actions">
              {pack[inspect].blurb && <p className="pack-blurb">{pack[inspect].blurb}</p>}
              <Link className="pack-button" href={`/games/${pack[inspect].appid}`}><span>Open {pack[inspect].title}</span></Link>
              <button type="button" className="pack-link" onClick={() => setInspect(null)}>Back to the pack</button>
            </div>
          ) : (
            <div className="pack-actions">
              {done ? <p className="pack-hint">That&apos;s every pack in this set.</p> : <button type="button" className="pack-button sparkle" onClick={nextPack}><Sparkle /><span className="sparkle-label">Open the next pack</span></button>}
              <Link className="pack-link" href={`/games/${seed.appid}`}>See all {setSize} games like {seed.title}</Link>
            </div>
          )}
        </>}
      </div>
      <p className="sr-only" aria-live="polite">{announce}</p>
    </main>
  );
}
