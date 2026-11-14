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
  /** The card's art, which the page's cover (or its loading skeleton) shows until the card has landed. */
  art: string | null;
};

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

/** The arriving page's entrance (globals.css): its content above the fold rises in as one staggered beat. Opened from a
 *  card ("card"), the card's own view transition plays it; any other arrival ("page") plays it on the live page, and so
 *  does a card's page that was still loading when the card landed. Back and Forward return to a page as it was, with
 *  no entrance. */
const enter = (state: "card" | "page" | null) => {
  if (state) root().setAttribute("data-entering", state); else root().removeAttribute("data-entering");
};

/** The arriving cover keeps showing the card's own art until the trailer is actually playing, so the art changes once,
 *  straight to the moving trailer; if it hasn't started by the end of the entrance, the still comes in instead. */
export function releaseCover() {
  root().removeAttribute("data-cover-hold");
}

/** The trailer has started: it takes over the cover, but never mid-flight (the card's own art is what flies); a card
 *  still expanding releases the cover as it lands. */
export function trailerPlaying() {
  if (!root().matches(":active-view-transition")) releaseCover();
}

/** A card was tapped: it holds its pressed scale while it opens (the expansion starts from there), and the arriving
 *  page holds its cover (releaseCover) and its entrance until the card has landed. */
export function openCard(morph: Morph, card: Element) {
  clearPressed();
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
}

/** How long the next close takes: a flick hands its speed to the spring (SwipeDismiss). Reset when it ends. */
export function setCloseDuration(ms: number) {
  root().style.setProperty("--duration-close", `${Math.round(ms)}ms`);
}

if (typeof document !== "undefined") {
  document.addEventListener("animationend", event => {
    // The entrance has settled once its last element has: the page is at rest, and the cover shows the still if the
    // trailer hasn't started.
    if (/^enter/.test(event.animationName) && !document.getAnimations().some(animation =>
      animation instanceof CSSAnimation && /^enter/.test(animation.animationName) && animation.playState === "running")) {
      enter(null);
      releaseCover();
    }
    // A view transition has finished (an opened page that was still loading takes a second one, from its skeleton): the
    // names go, so no other navigation can pair them; the page left behind is hidden by now, so the opened card can let
    // go of its press; and a flick's close speed applies only to its own close.
    if (event.pseudoElement === "::view-transition") {
      document.getElementById("card-morph")?.replaceChildren();
      // The card has landed and its entrance has played; if the page was still loading, it plays when the page arrives.
      if (root().getAttribute("data-entering") === "card") {
        if (document.querySelector("main[aria-busy=true]:not([data-leaving])")?.checkVisibility()) enter("page");
        else { enter(null); releaseCover(); }
      }
      clearPressed();
      root().style.removeProperty("--duration-close");
    }
  });
}
