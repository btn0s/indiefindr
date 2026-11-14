/** Which card and game page morph into each other, and nothing else.
 *
 *  A game can show up on both sides of a navigation (a game page recommends the game you came from, a home shelf and a
 *  "More from" row repeat one), so view-transition names can't be fixed per game: two pages naming the same game make
 *  the browser morph a pair nobody tapped. Instead names exist only for the pair being navigated. Opening a card names
 *  that card instance and its game's cover. Each history entry remembers the card that opened it, so Back names the
 *  cover being left and its card on the page you return to, and Forward the same pair again. Everything else is
 *  unnamed. */
export type Morph = {
  appid: number;
  /** The tapped card instance (useId), so the same game elsewhere on the page stays put. */
  card: string;
  /** Where that card sat on screen, so swiping its page away shrinks it toward that spot. */
  center: { x: number; y: number };
  /** The card's surface on screen when it was tapped: where the page's content starts riding from (ride). */
  box: Box;
  /** The card's art, which the page's cover (or its loading skeleton) shows until the card has landed. */
  art: string | null;
};

type Box = { x: number; y: number; w: number; h: number };
const boxOf = (element: Element | null | undefined): Box | null => {
  const rect = element?.getBoundingClientRect();
  return rect ? { x: rect.left, y: rect.top, w: rect.width, h: rect.height } : null;
};
/** A page and its sheet on screen, and the page's own scale (a page being pulled down to dismiss is shrunk), since the
 *  content is moved in its own units. */
const pageOf = (main: Element | null | undefined) => {
  const box = boxOf(main), sheet = boxOf(main?.querySelector(":scope > .page-sheet"));
  return main instanceof HTMLElement && main.offsetWidth && box && sheet ? { main: box, sheet, k: box.w / main.offsetWidth } : null;
};
/** A CSS time in milliseconds (computed custom properties come back in seconds). */
const ms = (time: string) => parseFloat(time) * (/\dms$/.test(time.trim()) ? 1 : 1000);

let active: Morph | null = null;
let opening: Morph | null = null;
const byEntry = new Map<number, Morph>();

export const getMorph = () => active;
/** Names the pair in a stylesheet rather than through React: a page the router kept mounted but hidden is revealed by
 *  the transition itself, too late for a re-render, while a style rule applies the moment it shows. The card is the
 *  tapped instance (CardLink's data-card). The page is the one arriving when a card opens and the one being left
 *  (markLeavingPage's data-leaving) when it closes, so a game page still loading, its skeleton, takes part too. Other
 *  pages are hidden during the transition, so they're never captured. */
const set = (morph: Morph | null, opening = true) => {
  active = morph;
  let sheet = document.getElementById("card-morph");
  if (!sheet) { sheet = document.createElement("style"); sheet.id = "card-morph"; document.head.append(sheet); }
  if (!morph) { sheet.textContent = ""; return; }
  const card = `.game-card[data-card="${CSS.escape(morph.card)}"]`, page = opening ? "main:not([data-leaving])" : "main[data-leaving]";
  const name = (part: string) => `view-transition-name: ${part}-${morph.appid}; view-transition-class: ${part};`;
  sheet.textContent = [
    `${card} > div, ${page} > .page-sheet { ${name("sheet")} }`,
    `${card} .game-card-art, ${page} .game-trailer { ${name("art")} }`,
    `${card} .game-card-text, ${page} .source-head { ${name("text")} }`,
    // Off-screen blocks of cards skip rendering (content-visibility: auto, globals.css), and a skipped card can't be
    // captured, so the card being navigated keeps its block rendered.
    `:is(.game-grid, .discovery-page > section):has(${card}) { content-visibility: visible; }`,
  ].join("\n");
};

const root = () => document.documentElement;
const clearPressed = () => { for (const card of document.querySelectorAll("[data-opening]")) card.removeAttribute("data-opening"); };

/** The arriving page's entrance (globals.css): its content rises in as one block. Opened from a card ("card"), there is
 *  none: the page is already there, riding in the card (ride). Any other arrival ("page") plays it on the live page, and
 *  so does a card's page that was still loading when the card landed. Back and Forward return to a page as it was, with
 *  no entrance. */
const enter = (state: "card" | "page" | null) => {
  if (state) root().setAttribute("data-entering", state); else root().removeAttribute("data-entering");
};

/** The arriving cover keeps showing the card's own art until its own picture is ready (coverReady), so the art changes
 *  once: straight to the moving trailer, or to the still on a page whose trailer won't play. */
const releaseCover = () => { coverWaiting = false; root().removeAttribute("data-cover-hold"); };
let coverWaiting = false;

/** The cover's own picture is ready (GameTrailer): the trailer is playing, or there is no trailer to play and the still
 *  has painted. It takes over the cover, but never mid-flight (the card's own art is what flies): a card still
 *  expanding hands over as it lands. */
export function coverReady() {
  if (root().matches(":active-view-transition")) coverWaiting = true; else releaseCover();
}

/** A card was tapped: it holds its pressed scale while it opens (the expansion starts from there), and the arriving
 *  page holds its cover on the card's art until its own picture is ready (coverReady). */
export function openCard(morph: Morph, card: Element) {
  clearPressed();
  flight = { card: morph.box };
  card.setAttribute("data-opening", "");
  root().setAttribute("data-cover-hold", "");
  enter("card");
  opening = morph;
  set(morph);
}

/** Every history entry change (HistoryTransition), before the router handles it. */
export function onEntryChange(type: string, from: number, to: number) {
  if (type === "push") {
    if (opening) byEntry.set(to, opening);
    else { set(null); releaseCover(); enter("page"); }
    opening = null;
    return;
  }
  if (type !== "traverse") return;
  clearPressed();
  // Back closes the page being left into its card; Forward opens the page it goes to again. Jumps of several entries
  // have no single card to morph.
  const forward = to === from + 1;
  set(Math.abs(to - from) === 1 ? byEntry.get(forward ? to : from) ?? null : null, forward);
  if (forward && active) root().setAttribute("data-cover-hold", ""); else releaseCover();
  enter(null);
  // What the content rides from, measured while it is still on screen: Forward, the card; Back, the page and its sheet.
  flight = {};
  if (!active) return;
  if (forward) flight.card = boxOf(document.querySelector(`.game-card[data-card="${CSS.escape(active.card)}"] > div`)) ?? undefined;
  else flight.page = pageOf([...document.querySelectorAll("main")].find(main => main.checkVisibility())) ?? undefined;
}

/** Where the content riding in the sheet travels between: the card's surface, and the page with its sheet. */
let flight: { card?: Box; page?: NonNullable<ReturnType<typeof pageOf>> } = {};

/** The game page's content rides inside the card as it opens, at its own size, carried by the sheet's corner and cut
 *  off by its edges, so the page is all there from the first frame and the card reveals it (and Back folds it away
 *  the same way). Called once the transition's pseudo-elements exist (HistoryTransition), with the arriving side now
 *  on screen to measure. The sheet's own group moves with the transition's timing, so this uses the same. */
export function ride(types: readonly string[]) {
  const opening = types.includes("card-open");
  if (!active || !(opening || types.includes("card-close")) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // The arriving page is the one on screen: pages visited before stay mounted, hidden (cacheComponents).
  if (opening) flight.page = pageOf([...document.querySelectorAll("main:not([data-leaving])")].find(main => main.checkVisibility())) ?? undefined;
  else flight.card = boxOf(document.querySelector(`.game-card[data-card="${CSS.escape(active.card)}"] > div`)) ?? undefined;
  const { card, page } = flight;
  flight = {};
  if (!card || !page) return;
  const { main, sheet, k } = page;
  const css = getComputedStyle(root());
  const at = (s: Box, radius: string): Keyframe => ({
    translate: `${(s.x - sheet.x) / k}px ${(s.y - sheet.y) / k}px`,
    clipPath: `inset(${(sheet.y - main.y) / k}px ${(main.x + main.w - sheet.x - s.w) / k}px ${(main.y + main.h - sheet.y - s.h) / k}px ${(sheet.x - main.x) / k}px round ${radius})`,
  });
  const frames = [at(card, css.getPropertyValue("--card-radius")), at(sheet, css.getPropertyValue("--page-radius"))];
  // No fill: it runs exactly as long as the transition, and a filled effect targets the pseudo-element by name, so it
  // would carry over onto the next transition's page.
  root().animate(opening ? frames : frames.reverse(), {
    duration: ms(css.getPropertyValue("--vt-duration")), easing: css.getPropertyValue("--vt-ease").trim(),
    pseudoElement: opening ? "::view-transition-new(page-arrive)" : "::view-transition-old(page-leave)",
  });
}

/** How long the next close takes: a flick hands its speed to the spring (SwipeDismiss). Reset when it ends. */
export function setCloseDuration(ms: number) {
  root().style.setProperty("--duration-close", `${Math.round(ms)}ms`);
}

if (typeof document !== "undefined") {
  document.addEventListener("animationend", event => {
    // The entrance has settled once its last element has: the page is at rest.
    if (/^enter/.test(event.animationName) && !document.getAnimations().some(animation =>
      animation instanceof CSSAnimation && /^enter/.test(animation.animationName) && animation.playState === "running")) {
      enter(null);
    }
    // A view transition has finished (an opened page that was still loading takes a second one, from its skeleton): the
    // names go, so no other navigation can pair them; the page left behind is hidden by now, so the opened card can let
    // go of its press; and a flick's close speed applies only to its own close.
    if (event.pseudoElement === "::view-transition") {
      document.getElementById("card-morph")?.replaceChildren();
      // The card has landed with the page in it; if the page was still loading, its entrance plays when it arrives.
      if (root().getAttribute("data-entering") === "card") {
        enter(document.querySelector("main[aria-busy=true]:not([data-leaving])")?.checkVisibility() ? "page" : null);
      }
      // A cover that became ready mid-flight takes over now.
      if (coverWaiting) releaseCover();
      clearPressed();
      root().style.removeProperty("--duration-close");
    }
  });
}
