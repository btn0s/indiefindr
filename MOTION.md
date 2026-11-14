# Motion timing audit

Status: the family in §4 is implemented (tokens in `src/app/globals.css`, springs read by `ScreenshotViewer`), with the felt changes from §4.3. Line references in §1 are to `main` at `0ddb809`, before this change.

bt's goal: every timing on the site comes from one consistent family. This doc lists what exists today (§1), where it disagrees (§2), what the published guidance says (§3), and a proposed token family mapped to every use (§4).

## 1. What exists

### 1.1 The tokens (`src/app/globals.css:165-171`)

| Token | Value | Comment in source |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | "One ease-out that never overshoots" |
| `--duration-press` | 100ms | press in |
| `--duration-release` | 160ms | press out |
| `--duration-hover` | 200ms | |
| `--duration-enter` | 180ms | |
| `--duration-exit` | 110ms | "exits beat enters" |
| `--duration-morph` | 260ms | phone search open |
| `--duration-morph-back` | 200ms | phone search close |

### 1.2 Every use

| # | What | Where | Duration | Curve / spring | Token? |
|---|---|---|---|---|---|
| 1 | Card, showcase and trailer-button press (scale .97 / .98 / .92) | `globals.css:470-473` | in 100, out 160 | `--ease-out` | yes |
| 2 | `.button` press (scale .97, shadow) | `globals.css:479, 487` | in 100, out 160 | `--ease-out` | yes |
| 3 | `.button` hover (background, brightness) | `globals.css:479` | 200 | `--ease-out` | yes |
| 4 | Text-link press (opacity .6): See all, Cancel, wordmark, footer, facts | `globals.css:474` | instant | none | n/a |
| 5 | Showcase tile hover lift (−6px) | `globals.css:279-280` | 200 | `--ease-out` | yes |
| 6 | See all arrow nudge (2px) | `globals.css:289` | **150** | **`ease-out` keyword** | **no** |
| 7 | Trailer and copy icon crossfade (opacity, scale .6, blur) | `globals.css:348, 444` | 180 both ways | `--ease-out` | yes |
| 8 | Trailer video fade-in | `globals.css:342` | **400** | **`ease-out` keyword** | **no** |
| 9 | Cover art fades in on load | `globals.css:587` + `layout.tsx:34` | 200 (borrows `--duration-hover`) | `--ease-out` | borrowed |
| 10 | Art placeholder sheen (loop) | `globals.css:420` | **1600 / cycle** | **linear** | **no** |
| 11 | Skeleton shimmer (loop) | `globals.css:591` | **1500 / cycle** | **ease-in-out** | **no** |
| 12 | Search pending: icon swap after a beat | `globals.css:510-511` | out 110, in 180, **120 delay** | `--ease-out` | partly |
| 13 | Search pending spinner (loop) | `globals.css:511` | **800 / turn** | linear | **no** |
| 14 | Card pending dim (to .6) after a beat | `globals.css:525` | 180, **120 delay** | `--ease-out` | partly |
| 15 | Desktop search popover in (scale .97 → 1) / out (to .98) | `globals.css:495-497` | in 180, out 110 | `--ease-out` | yes |
| 16 | Desktop search popover height follows rows | `globals.css:495`, `Navbar.tsx:98` | **120** | `--ease-out` | **no** |
| 17 | Phone search takeover morph (view transition) | `globals.css:539-547`, `Navbar.tsx:59` | open 260, close 200 | `--ease-out` | yes |
| 18 | Phone search rows rise in 12px / drop out 8px | `globals.css:550-553` | open 260, close 200 | `--ease-out` | yes |
| 24 | Any other view transition (fallback) | `globals.css:541` | 170 | `--ease-out` | yes |
| 25 | **Lightbox open**: shot morphs from thumbnail, page dims and recedes | `ScreenshotViewer.tsx:13` | spring 440, bounce .08 | spring | **no** |
| 26 | Lightbox close (tap, Esc, flick) into thumbnail, velocity carried | `ScreenshotViewer.tsx:15, 249-266` | spring 240, bounce 0 | spring | **no** |
| 27 | Lightbox page swipe / arrow keys | `ScreenshotViewer.tsx:16` | spring 400, bounce 0 | spring | **no** |
| 28 | Lightbox settle after a drag that didn't dismiss; rubber band at the ends | `ScreenshotViewer.tsx:17` | spring 340, bounce .12 | spring | **no** |
| 29 | Lightbox under reduced motion (fade only) | `ScreenshotViewer.tsx:18` | spring 240, bounce 0 | spring | **no** |
| 30 | Lightbox flick momentum projection | `ScreenshotViewer.tsx:22` | iOS rate 0.998 | n/a | n/a |
| 31 | Lightbox other shots step aside while dragging | `globals.css:382` | **150** | **`ease` keyword** | **no** |
| 32 | Lightbox full-res image fades over thumbnail | `globals.css:386` | **250** | **`ease`** | **no** |
| 33 | Lightbox ✕ / arrows: show 200, hide 120; hover bg 150; press scale .94, 150 | `globals.css:392-403` | **120 / 150 / 200** | **`ease`, `ease-out`** | **no** |
| 34 | Lightbox arrows hide after the mouse stops | `ScreenshotViewer.tsx:406` | 1800 | n/a | n/a |
| 35 | Copy button reverts to the copy icon | `CodeBlock.tsx:12` | 1600 | n/a | n/a |
| 36 | **Stagger** | none | | | |
| 37 | Toasts (`ui/sonner.tsx`) | no motion | | | |

Notes:
- **No stagger exists.** Nothing in `src` staggers, and git history has never had a `stagger` or `animation-delay`. The proposal below includes a stagger token anyway, ready if one is added.
- **`tw-animate-css` is imported and unused.** It's imported at `globals.css:3`, but no `animate-*` class appears anywhere.
- Reduced motion is handled everywhere it matters: lines 352, 426, 554-557, 575-577, 593, and the lightbox's FADE.

## 2. Where it's inconsistent

1. **Two vocabularies.** Rows 1-18 and 24 mostly use the tokens. The lightbox (rows 25-33) and a handful of others (6, 8, 10, 11, 13, 16) hard-code their own numbers. In practice the lightbox ships a second motion system.
2. **Four easing curves where one is intended.**
   - The token `--ease-out` is `cubic-bezier(0.23, 1, 0.32, 1)`.
   - The CSS `ease` keyword is `(0.25, 0.1, 0.25, 1)`, a slow-start curve. Rows 31-33 use it.
   - The CSS `ease-out` keyword is `(0, 0, 0.58, 1)`, much softer than the token. Rows 6 and 8 use it.
   - Rows 10, 11 and 13 use `ease-in-out` and `linear` loops.

   The `ease` keyword's slow start is exactly what the source comment rules out.
3. **About 15 distinct durations between 100 and 440ms:** 100, 110, 120, 150, 160, 170, 180, 200, 240, 250, 260, 340, 400, 440. Several pairs are below what anyone can tell apart: 110/120, 150/160, 170/180, 240/250/260. Those are noise, not intent.
4. **Two shared-element morphs on two models.**

   | Morph | Model | Time |
   |---|---|---|
   | Phone search (row 17) | CSS curve | 260ms |
   | Lightbox (row 25) | Spring with bounce | ~440ms |
5. **Tokens named by place, not by role.** The art load-fade borrows `--duration-hover` (row 9). `--duration-morph` / `-back` are really "search takeover" timings.
6. **Press feedback in five flavours.**
   - Scale .97 on cards and buttons.
   - Scale .98 on the showcase source.
   - Scale .92 on the trailer buttons.
   - Scale .94 on the lightbox buttons, which also skip the fast-in / slow-out split (one 150ms `ease-out` both ways).
   - Opacity .6 on text links.
7. **"Never overshoots" vs. bounce.** The CSS comment promises no overshoot, while the lightbox's OPEN (.08) and SETTLE (.12) springs do overshoot. The SETTLE bounce is deliberate (it's a physical release). The OPEN bounce is a judgement call that nothing else on the site matches.
8. **Two loading loops that disagree.** The placeholder sheen runs 1.6s linear; the skeleton shimmer runs 1.5s ease-in-out. They often sit on screen together (the card skeleton next to a card whose art is loading).
9. **Delays.** A 120ms "after a beat" delay appears twice (rows 12 and 14) as a raw number.


## 3. What the published guidance says

Primary sources only. Where a source gives no numbers, this says so.

| Source | Durations | Curves | Springs | Rules that matter here |
|---|---|---|---|---|
| **Emil Kowalski** ([great-animations](https://emilkowal.ski/ui/great-animations), [7 practical tips](https://emilkowal.ski/ui/7-practical-animation-tips), [drawer](https://emilkowal.ski/ui/building-a-drawer-component), animations.dev via the installed `animate` skill) | UI under 300ms; a 180ms select beats a 400ms one; tooltip 125ms; Vaul sheet 500ms | Custom ease-out to enter **and** exit; ease-in-out for movement on screen; linear for constant loops; never ease-in; built-in keywords "not strong enough" | (uses Motion springs for gestures) | Press `scale(.97)`; never start from `scale(0)`; never animate keyboard-initiated actions; animate less the more often something happens; reduced motion means a fade |
| **Rauno Freiberg** ([Invisible Details of Interaction Design](https://rauno.me/craft/interaction-design)) | none published | none published | none published | Frequency kills animation; interruptible always; a thrown object keeps its momentum and angle; motion comes from where the thing came from |
| **Vercel** ([Web Interface Guidelines](https://vercel.com/design/guidelines)) | Spinner/skeleton show-delay ~150–300ms, minimum visible ~300–500ms | "Choose easing based on what changes (size, distance, trigger)" | none | Prefer CSS over JS; `transform`/`opacity` only; interruptible; anchor at the physical origin; honour reduced motion. **Geist publishes no motion tokens.** |
| **Material 3** ([MotionTokens.kt](https://github.com/androidx/androidx/blob/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/MotionTokens.kt), [Motion.md](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md)) | 50-ms steps: short 50–200, medium 250–400, long 450–600 | standard (0.2,0,0,1); emphasized-decelerate (0.05,0.7,0.1,1); emphasized-accelerate (0.3,0,0.8,0.15) | Standard scheme: spatial damping 0.9 (fast/default/slow), effects 1.0 | Small/short = short, large/full-screen = long; exits shorter than enters; opacity and color never overshoot; M3 is moving from curves to springs |
| **Apple** ([HIG Motion](https://developer.apple.com/design/human-interface-guidelines/motion), [SwiftUI Animation](https://developer.apple.com/documentation/swiftui/animation), [WWDC23 Animate with springs](https://developer.apple.com/videos/play/wwdc2023/10158/)) | HIG gives none; SwiftUI springs default to 0.5s | n/a (springs) | `duration`+`bounce`; default bounce 0; `.snappy` 0.15; `.bouncy` 0.3; caution above 0.4; retargeting keeps velocity | Brief, precise feedback; avoid motion on frequent interactions; let people cancel motion; feedback follows the gesture |
| **IBM Carbon** ([Motion](https://carbondesignsystem.com/elements/motion/overview/)) | 70 / 110 / 150 / 240 / 400 / 700 | productive entrance (0,0,0.38,0.9), exit (0.2,0,1,0.9) | none | "The larger the change in distance or size, the longer the animation"; productive (task UI) is much faster than expressive |

**Where they agree.**
- Everyday UI motion runs about 100–300ms; only large or full-screen motion reaches ~400–500ms.
- Duration grows with size and distance.
- Exits are shorter than enters.
- Opacity never overshoots, and UI springs default to no bounce.
- Everything is interruptible and keeps its velocity.
- Frequent and keyboard-triggered actions animate least or not at all.
- Motion starts at its physical origin.

**Where they conflict, and the call this proposal makes.**
- **Exit curve.** M3 and Carbon accelerate out (ease-in family); Emil says never ease-in on UI. *Call: Emil.* Every exit here is short and user-triggered, so a fast start keeps it responsive.
- **Springs vs fixed curves.** Apple and M3 Expressive use springs; Carbon and baseline M3 use durations plus Béziers; Vercel prefers CSS. *Call: both.* Springs wherever a finger or velocity is involved (only the lightbox today). Everything else is CSS. CSS morphs borrow the spring's shape via a `linear()` curve, so both read as one family.
- **Long sheets.** Vaul's 500ms and SwiftUI's 0.5s exceed Emil's 300ms ceiling. *Call:* 400ms is the longest step, for full-screen spatial motion only.

## 4. Proposed token family

One ladder of four durations, three curves and three springs. The springs reuse the ladder's numbers, so the CSS and the lightbox speak the same scale.

### 4.1 The tokens

```css
/* Durations: one ladder, each step ~1.5x the last (Carbon's non-linear scale, M3's short → long bands). */
--duration-xs: 100ms;   /* press in, exits of small things           (M3 short2 100, Carbon fast-02 110) */
--duration-s:  160ms;   /* hovers, small enters, crossfades, release  (M3 short3 150, Carbon moderate-01 150, Emil's 125–180) */
--duration-m:  240ms;   /* medium enters, image fades, takeover close (Carbon moderate-02 240, M3 medium1 250) */
--duration-l:  400ms;   /* full-screen or large-area motion           (Carbon slow-01 400, M3 medium4 400) */
--delay-beat:  var(--duration-s);  /* "after a beat" before pending feedback shows (Vercel 150–300 show-delay) */
--loop:        1.6s;    /* one period for every loading loop */

/* Curves */
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1);       /* unchanged: enters, exits, presses, hovers, fades (Emil; ≈ M3 emphasized-decelerate) */
--ease-in-out: cubic-bezier(0.645, 0.045, 0.355, 1); /* something already on screen changes size in place (Emil; M3 "emphasized" for start-and-end-on-screen) */
--ease-glide:  linear(…);                            /* the glide spring below, sampled for CSS morphs (Vercel: keep it CSS) */
/* Loops use plain linear (Emil: constant motion is linear). */
```

| Spring | `duration` / `bounce` | For | Follows |
|---|---|---|---|
| **snap** | 0.24 / 0 | Closing into the thumbnail (velocity carried), reduced-motion fades | M3 effects springs (damping 1.0); SwiftUI default bounce 0; Material "exits shorter" |
| **glide** | 0.40 / 0 | Lightbox open, page swipe, and (as `--ease-glide`) the search morph | WWDC23 "when unsure, bounce 0"; Carbon slow-01 / M3 "slow for full-screen" |
| **release** | 0.40 / 0.15 | Settling back after a drag that didn't dismiss; rubber band at the ends | SwiftUI `.snappy` base bounce 0.15; Rauno: a thrown object keeps its momentum |

The springs live once, as CSS custom properties beside the durations (`--spring-snap: 0.24 0`, etc.). `ScreenshotViewer` reads them on mount instead of declaring its own constants, so there's a single source of truth.

Rules that come with the family:
- **Exits take one step down from their enter** (M3).
- **Presses go in at `xs` and come out at `s`.**
- **Keyboard-opened things appear at once** (Emil, Rauno). The search popover already does this.
- **One press scale: `.97`** (Emil). Icon buttons 44px and under use `.92`, since .97 is invisible at that size. Text links keep the opacity .6 press.

### 4.2 Mapping every use

Bold marks a change you would feel; the rest moves by ≤20ms or only changes its curve.

| # | Use | Today | Proposed |
|---|---|---|---|
| 1-2 | Card, showcase, `.button` press | in 100, out 160; scales .97/.98 | in `xs`, out `s`, `--ease-out`; scale **.97** everywhere (showcase .98 → .97) |
| 3 | `.button` hover | 200 | `s` |
| 4 | Text-link press | opacity .6, instant | unchanged (frequent; Rauno) |
| 5 | Showcase tile hover lift | 200 | `s` |
| 6 | See all arrow nudge | 150 `ease-out` keyword | `s`, `--ease-out` |
| 7 | Trailer / copy icon crossfade | 180 | `s` |
| 8 | Trailer video fade-in | 400 `ease-out` keyword | `l`, `--ease-out` (large area; M3, Carbon) |
| 9 | Cover art load fade | 200 (borrowed hover) | `m`: an image arriving, not a hover |
| 10-11 | Placeholder sheen / skeleton shimmer | 1.6s linear / 1.5s ease-in-out | both `--loop` linear, so they move in step when side by side |
| 12 | Search pending icon swap | out 110, in 180, delay 120 | out `xs`, in `s`, delay `--delay-beat` |
| 13 | Search spinner | 800 linear | unchanged (a spinner's speed is its own; Emil: faster spinners feel faster) |
| 14 | Card pending dim | 180, delay 120 | `s`, delay `--delay-beat` |
| 15 | Desktop search popover | in 180, out 110 | in `s`, out `xs` |
| 16 | Popover height follows rows | 120 `--ease-out` | `s`, `--ease-in-out` (already on screen, changing size) |
| 17-18 | Phone search takeover morph and rows | open 260, close 200 | **open `--ease-glide` over `l`; close `m`, `--ease-out`** |
| 24 | Default view transition | 170 | `m` |
| 25 | Lightbox open | spring 0.44 / .08 | **glide 0.40 / 0** |
| 26 | Lightbox close | spring 0.24 / 0 | snap (same) |
| 27 | Lightbox page swipe | spring 0.40 / 0 | glide (same) |
| 28 | Lightbox settle / rubber band | spring 0.34 / .12 | **release 0.40 / .15** |
| 29 | Lightbox reduced motion | spring 0.24 / 0 | snap (same) |
| 31 | Other shots step aside | 150 `ease` | `s`, `--ease-out` |
| 32 | Full-res shot fades in | 250 `ease` | `m`, `--ease-out` |
| 33 | Lightbox ✕ / arrows | show 200, hide 120, bg 150, press .94 one-speed | show `s`, hide `xs`, bg `s`, press **.92** in `xs` / out `s`, all `--ease-out` |
| 34-35 | Arrow idle-hide 1800; copy revert 1600 | timers | unchanged (dwell times, not motion) |
| 36 | Stagger (none today) | — | If one is added: 40ms per item, capped at 6 items, each item `s` |
| 37 | Toasts | none | If they animate: in `m`, out `s` (Carbon puts toasts at 240) |

Housekeeping that comes with it:
- Drop the unused `tw-animate-css` import.
- Replace the role-named tokens (`--duration-press`, `-morph-back`…) with the ladder.

### 4.3 The calls that are bt's to feel

The table changes timing almost everywhere by a frame or less. These three you would notice, so they're yours to judge on a preview before anything ships:

1. **Lightbox open loses its slight overshoot (bounce .08 → 0).** It's the only overshoot on an opening anywhere on the site, and SwiftUI's default and M3 Standard both say no bounce unless it's expressive. The overshoot is small enough that most people won't see it go.
2. **Drag-settle gets a touch more bounce (.12 → .15, 0.34 → 0.40s).** This aligns it with SwiftUI `.snappy` and keeps one "released" feel.
3. **Phone search open: 260 → glide over 400.** It's a full-screen takeover, and every guideline ties duration to size (Carbon, M3, Vercel).

   **Recommendation:** open on glide, close stays fast at `m`.

Everything else is a ≤20ms nudge or a curve swap to the site's own `--ease-out`. I'd ship those without a separate review.
