# Craft audit: whole site

Walked every surface at 1280 and 390, light theme, against the live site (before) and the production build of this branch (after). Each entry is the rough edge, then the fix. Evidence names refer to the before | after side-by-sides attached to the PR (`<surface>-<width>.png`, `<interaction>.mp4`).

## System

| Rough edge | Fix |
|---|---|
| No shared radius, easing, duration or shadow values; each component picked its own, so corners and shadows didn't agree. | Tokens in `globals.css`: radius scale 4/6/8/12 (nested corners concentric), `--ease-out: cubic-bezier(.23,1,.32,1)`, press 120ms, hover 200ms, enter 180ms, exit 110ms, and ink-tinted shadows (card, card-hover, raised, popover, inset). |
| Viewport had `maximum-scale=1, user-scalable=no`: pinch zoom blocked, an accessibility bug. | Removed. Inputs are 16px on phones so iOS doesn't zoom on focus; `touch-action: manipulation` removes double-tap delay while pinch zoom stays. |
| Grey tap flash on iOS, no `::selection` colour, focus ring inconsistent and also drawn on mouse click. | Tap highlight off (our `:active` states replace it), ink `::selection`, one 2px ink `:focus-visible` ring everywhere, none on pointer focus. (`focus-1280.png`, `focus-390.png`) |
| Headings and paragraphs wrapped with orphans. | `text-wrap: balance` on h1–h3, `pretty` on paragraphs. |
| Geist Sans loaded but unused; display type set in Inter's text cut. | Dropped Geist Sans; Inter loads its optical-size axis, so the hero uses the display cut, with tracking retuned (−0.032em). |
| Titles were inconsistent ("Agent access \| indiefindr", "Privacy \| indiefindr", "— IndieFindr", "Game Not Found"). | One template, `%s — IndieFindr`; pages pass bare titles; sentence case ("Game not found"). |
| No `favicon.ico`, no apple-touch-icon, no theme-color. Icon fill was pure black. | Added `favicon.ico`, `apple-icon.png`, `theme-color: #ffffff`, `color-scheme: light`; icon ink matches the UI ink (#131316). |
| `ScrollToTopOnNavigation` forced scroll to top on back/forward, losing the user's place in long grids. | Deleted; Next's own scroll restoration returns you where you were. (`card-tap-and-back-390.mp4`) |

## Header and search (look and motion only; matching/ranking untouched)

| Rough edge | Fix |
|---|---|
| Opaque header; content cut off hard at its edge. | Frosted header (blur on `::before`, so the phone search sheet's `position: fixed` isn't trapped). |
| Search field was a flat box; focus state was only a colour change. | Inset field: hairline, soft inner shadow, a crisp ink border and 3px halo on focus. |
| Results popover appeared with no origin; desktop exit the same speed as enter. | Scales and fades from its anchor (`transform-origin: var(--transform-origin)`), 0.97→1 in 180ms, out in 110ms; reduced motion falls back to a fade. (`search-open-close-1280.mp4`) |
| Row highlight animated, lagging the arrow keys. | Highlight has no transition: it changes on every keystroke. Rows are concentric with the panel (12px − 6px padding). (`search-query-1280.png`, `search-query-390.png`) |
| Phone sheet: "Cancel" was a small text hit area. | 44px target with negative margin so the text doesn't move; `:active` dims it. (`search-sheet-390.mp4`) |

## Cards, grids and carousels

| Rough edge | Fix |
|---|---|
| Cards had no press feedback; hover applied on touch too (sticky hover after a tap). | Card scales to 0.97 on `:active`; hover (deeper shadow, art eases to 1.035 inside an overflow-hidden frame, title underline fades in) only under `(hover: hover) and (pointer: fine)`. The frame never moves, so no layout shift. (`card-hover-press-1280.mp4`) |
| Art painted in top to bottom; broken or missing covers showed the browser's broken-image icon. | A head script marks each loaded URL so art fades up once loaded (already-cached art shows instantly, no fade); while loading or on failure the frame shows the sword mark with a slow sheen that stops once art lands. Reserved 460:215 ratio, so zero CLS. |
| Art edges bled into the page on light covers. | Hairline inner edge and a faint top sheen over all art. |
| Infinite scroll showed a spinner under the grid, and the grid jumped when the page landed. | Four card skeletons hold the next page's place; the spinner component is deleted. |
| Home showcase: hover lifted the link itself, which slid out from under the cursor and flickered at the bottom edge. | The link stays put; the tile inside lifts 4px. Hero art gets `fetchPriority="high"` for LCP. (`home-1280.png`) |
| "See all" was a 20px-tall hit target. | 44px target, negative margin keeps it aligned with the heading; arrow nudges 2px on hover. |
| MCP App carousel: no snap, Previous/Next scrolled a fixed 540px and never disabled at the ends, bare scrollbar, no press state. | `scroll-snap` per card, paging by visible width, buttons disable at either end, keyboard arrows scroll the focused row, thin styled scrollbar, card hover/press matching the site, reduced-motion respected. (`mcp-carousel.mp4`) |

## Game page

| Rough edge | Fix |
|---|---|
| "on Steam" button was a flat black slab. | Physical button: top-lit gradient, 1px top highlight, contact shadow; press sinks it 1px and to 0.97. Full width, 46px on phones. (`game-390.png`) |
| Trailer mute button: 36px target, no hover/press. | Smoked-glass button, 36px visually with a 44px hit area, scales to 0.92 on press. |
| Review count and score not tabular; developer link unstyled. | `tabular-nums` on meta and notes; developer link with a quiet underline that darkens on hover. |
| Loading state was generic grey bars that didn't match the page. | `loading.tsx` outlines the real layout: title, meta, 16:9 trailer, three text lines, button, recommendation grid. Same for list pages (developer, discover). |
| Empty recommendations were a bare line of grey text. | `EmptyNote`: a quiet inset tray with the sword mark, so it reads as a place, not a gap. |

## Other pages

| Rough edge | Fix |
|---|---|
| 404: one line, no way back except the header. | Kinder copy with a typographic apostrophe, a "Back to home" button, the grid below. (`404-1280.png`, `404-390.png`) |
| /agents: code samples in plain `<pre>`, no way to copy; tool names unstyled. | `CodeBlock` with a copy button whose icon crossfades to a check (scale + blur, 180ms) and back; inline code as small chips; links via `next/link`. (`agents-1280.png`, `agents-390.png`) |
| Footer: four items run together on one line, raw `<a>` tags. | Links on the left (`next/link`, 32px targets), attribution on the right; stacks on phones. |

## OG images

| Rough edge | Fix |
|---|---|
| Tiles were 350×200, cropping titles printed on Steam header art (e.g. "ENDER LILIES"); square corners. | Tiles keep Steam's 460:215 shape (360×168) in both the per-game route and the home OG script, 14px radius, hairline border. (`og-game.png`, `og-home.png`) |

## Verification

- `pnpm build`, typecheck (`tsc --noEmit`) and the vitest suite (8 tests) pass; `pnpm lint` has no errors (one pre-existing warning in `postcss.config.mjs`).
- Layout shift (Chromium `layout-shift` entries, load + scroll to mid-page): home and game page at 1280 and 390 are all 0.000 after; the live game page at 1280 was 0.013 before.
- Production build checked at 1280 and 390; no console errors (the only local error was the analytics events route, which needs a service key not copied to the worktree).
- Before/after clips recorded with Playwright against the live site and this branch's production build.
