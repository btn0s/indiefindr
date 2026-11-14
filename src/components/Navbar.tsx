"use client";
import { Autocomplete, AutocompleteContent, AutocompleteInput, AutocompleteItem, AutocompleteLabel, AutocompleteList } from "@ui-sdk/react/autocomplete";
import { Button } from "@ui-sdk/react/button";
import { useShortcut } from "@ui-sdk/react/shortcuts";
import { matchRanges, matchSegments } from "@ui-sdk/core/text-match";
import { ArrowUpRight, LoaderCircle, Search } from "lucide-react";
import { SwordMark } from "./SwordMark";
import Link from "next/link";
import { addTransitionType, startTransition, useRef, useState, useTransition, ViewTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useGameSearch, type PopularPick, type SearchDetail } from "@/lib/use-game-search";
import { steamRating } from "@/lib/rating";

export function Navbar({ popular }: { popular: PopularPick[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // Opened from the keyboard: the panel appears at once, with no scale-in (globals.css [data-instant]).
  const [instant, setInstant] = useState(false);
  // A search submit that has to wait for its page shows a spinner in the field, after a beat (globals.css).
  const [pending, startNavigation] = useTransition();
  // The target state, ahead of React: Cancel also blurs the field, which asks to close a second time mid-transition.
  const target = useRef(false);
  // Picking a game closes at once: the next page replaces the takeover, so there is nothing to animate back to.
  const closeNow = () => { target.current = false; setOpen(false); };
  // On phones search opens as a full-screen takeover. Opening and closing are a view transition, typed search-open or
  // search-close: the field morphs between the header and the takeover while the page fades beneath it (globals.css).
  // Desktop keeps its popover and runs no transition. However the takeover closes (Cancel, or a tap outside the field,
  // which is how Cancel reaches the Autocomplete), it leaves search as it found it: empty, unfocused, keyboard down.
  // The query clears inside the transition; the keyboard drops once it finishes, because the viewport resize that
  // causes would cut it short.
  const changeOpen = (next: boolean) => {
    if (next === target.current) return;
    target.current = next;
    if (!next) setInstant(false);
    if (!matchMedia("(max-width: 700px)").matches) { setOpen(next); return; }
    startTransition(() => {
      addTransitionType(next ? "search-open" : "search-close");
      setOpen(next);
      if (!next) setQuery("");
    });
  };
  const openFromKeyboard = () => { setInstant(true); document.getElementById("game-search")?.focus(); changeOpen(true); };
  useShortcut("/", openFromKeyboard, { description: "Search games" });
  useShortcut("mod+k", openFromKeyboard, { description: "Search games" });
  const dropKeyboardAfterClose = (_: unknown, types: string[]) => {
    if (!types.includes("search-close")) return;
    return () => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); };
  };
  const { games, details, loading, error, search } = useGameSearch(popular);
  const navigate = (value: string) => {
    const game = games.find(game => String(game.appid) === value || game.title.toLocaleLowerCase() === value.toLocaleLowerCase()) ?? games[0];
    if (game) { closeNow(); startNavigation(() => router.push(`/games/${game.appid}`)); }
  };
  const status = error || (loading ? "Loading search…" : query ? "No matching games." : "");
  return <header className="site-header"><div className="site-nav">
    <Link href="/" className="wordmark"><SwordMark /><span>indiefindr</span></Link>
    <ViewTransition default="none" update={{ "search-open": "search-morph", "search-close": "search-morph", default: "none" }}
      onUpdate={dropKeyboardAfterClose}>
    <div className="site-search" data-open={open}>
      <Autocomplete presentation="popover" modal={false} value={query} open={open} filter={false} autoHighlight openOnFocus loop submitOnSelect
        onOpenChange={changeOpen}
        // Rows don't prefetch as they appear; the one under the highlight (the top result while typing, or the row the
        // arrow keys or pointer rest on) fetches its whole page.
        onHighlight={value => { if (value) router.prefetch(`/games/${value}`); }}
        onValueChange={(value, detail) => { if (detail.reason === "item-press") { navigate(value); return; } setQuery(value); search(value); }}
        onSubmit={navigate}>
        <AutocompleteLabel htmlFor="game-search" className="sr-only">Search games</AutocompleteLabel>
        <div className="search-box" data-pending={pending || undefined}>
          <span className="search-icon text-muted-foreground"><Search size={18} /><LoaderCircle size={18} aria-hidden="true" /></span>
          <AutocompleteInput aria-label="Search games" aria-keyshortcuts="/ Meta+K Control+K" aria-busy={pending}
            id="game-search" name="q" placeholder="Search games…" autoComplete="off" onFocus={() => { if (!query) search(""); }} />
          <kbd className="search-kbd" aria-hidden="true">/</kbd>
          <Button aria-label="Open selected game" onClick={() => { if (games[0]) navigate(String(games[0].appid)); }}><ArrowUpRight size={18} /></Button>
        </div>
        {open && <Button className="search-cancel" onClick={() => changeOpen(false)}>Cancel</Button>}
        <AutocompleteContent className="search-results" anchor=".site-search" sideOffset={8} data-instant={instant || undefined}>
          <div className="search-panel" ref={followHeight}>
            {!query && games.length > 0 && <p className="search-label" aria-hidden="true">Popular indies</p>}
            <AutocompleteList>
              {games.map(game => <AutocompleteItem key={game.appid} value={String(game.appid)} label={game.title}
                render={<Link href={`/games/${game.appid}`} prefetch={false} onClick={closeNow} />}>
                <SearchRow title={game.title} query={query} detail={details.get(game.appid)} />
              </AutocompleteItem>)}
            </AutocompleteList>
            {!games.length && status && <p role="status" className="search-status">{status}</p>}
          </div>
        </AutocompleteContent>
      </Autocomplete>
    </div>
    </ViewTransition>
  </div></header>;
}

/** Writes the panel's content height to the popup, so a change in the number of rows animates (globals.css). The
 *  write goes straight to the element, coalesced to one per frame, without a React render. */
function followHeight(panel: HTMLDivElement) {
  let frame = 0;
  const observer = new ResizeObserver(([entry]) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => panel.parentElement?.style.setProperty("--panel-height", `${entry.borderBoxSize[0].blockSize}px`));
  });
  observer.observe(panel);
  return () => { cancelAnimationFrame(frame); observer.disconnect(); };
}

/** The title with each word of the query marked where it matched, so a row shows why it's there. Matching folds case
 *  and accents the way the autocomplete does. */
function MarkedTitle({ title, query }: { title: string; query: string }) {
  const ranges = query.split(/\s+/).flatMap(word => word ? matchRanges(title, word, "contains") : [])
    .sort((a, b) => a.start - b.start)
    .reduce<{ start: number; end: number }[]>((merged, range) => {
      const last = merged.at(-1);
      if (last && range.start <= last.end) last.end = Math.max(last.end, range.end); else merged.push({ ...range });
      return merged;
    }, []);
  return matchSegments(title, ranges).map((segment, index) => segment.match ? <mark key={index}>{segment.text}</mark> : segment.text);
}

function SearchRow({ title, query, detail }: { title: string; query: string; detail?: SearchDetail }) {
  const rating = detail && steamRating(detail.review_positive_pct, detail.review_count);
  const year = detail?.release_date?.slice(0, 4);
  return <>
    <span className="search-art">{detail?.header_image && <Image src={detail.header_image} alt="" width={92} height={43} unoptimized />}</span>
    <span className="search-text">
      <span className="search-title"><MarkedTitle title={title} query={query} /></span>
      {(year || rating) && <span className="search-meta">
        {year && <span>{year}</span>}
        {rating && <span><strong>{detail.review_positive_pct}%</strong> {rating}</span>}
      </span>}
    </span>
  </>;
}
