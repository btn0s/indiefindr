"use client";
import { Autocomplete, AutocompleteContent, AutocompleteInput, AutocompleteItem, AutocompleteLabel, AutocompleteList } from "@ui-sdk/react/autocomplete";
import { Button } from "@ui-sdk/react/button";
import { ArrowUpRight, Search } from "lucide-react";
import { SwordMark } from "./SwordMark";
import Link from "next/link";
import { addTransitionType, startTransition, useRef, useState, ViewTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useGameSearch, type SearchDetail } from "@/lib/use-game-search";
import { steamRating } from "@/lib/rating";

export function Navbar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
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
    if (!matchMedia("(max-width: 700px)").matches) { setOpen(next); return; }
    startTransition(() => {
      addTransitionType(next ? "search-open" : "search-close");
      setOpen(next);
      if (!next) setQuery("");
    });
  };
  const dropKeyboardAfterClose = (_: unknown, types: string[]) => {
    if (!types.includes("search-close")) return;
    return () => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); };
  };
  const { games, details, loading, error, search } = useGameSearch();
  const navigate = (value: string) => {
    const game = games.find(game => String(game.appid) === value || game.title.toLocaleLowerCase() === value.toLocaleLowerCase()) ?? games[0];
    if (game) { closeNow(); router.push(`/games/${game.appid}`); }
  };
  return <header className="site-header"><div className="site-nav">
    <Link href="/" className="wordmark"><SwordMark /><span>indiefindr</span></Link>
    <ViewTransition default="none" update={{ "search-open": "search-morph", "search-close": "search-morph", default: "none" }}
      onUpdate={dropKeyboardAfterClose}>
    <div className="site-search" data-open={open}>
      <Autocomplete presentation="popover" modal={false} value={query} open={open} filter={false} autoHighlight openOnFocus loop submitOnSelect
        onOpenChange={changeOpen}
        onValueChange={(value, detail) => { if (detail.reason === "item-press") { navigate(value); return; } setQuery(value); search(value); }}
        onSubmit={navigate}>
        <AutocompleteLabel htmlFor="game-search" className="sr-only">Search games</AutocompleteLabel>
        <div className="search-box"><Search size={18} className="search-icon text-muted-foreground shrink-0" />
          <AutocompleteInput aria-label="Search games" id="game-search" name="q" placeholder="Search games…" autoComplete="off" onFocus={() => { if (!query) search(""); }} />
          <Button aria-label="Open selected game" onClick={() => { if (games[0]) navigate(String(games[0].appid)); }}><ArrowUpRight size={18} /></Button>
        </div>
        {open && <Button className="search-cancel" onClick={() => changeOpen(false)}>Cancel</Button>}
        <AutocompleteContent className="search-results" anchor=".site-search" sideOffset={8}>
          {!query && games.length > 0 && <p className="search-label" aria-hidden="true">Popular indies</p>}
          <AutocompleteList>
            {games.map(game => <AutocompleteItem key={game.appid} value={String(game.appid)} label={game.title}
              render={<Link href={`/games/${game.appid}`} prefetch onClick={closeNow} />}>
              <SearchRow title={game.title} detail={details.get(game.appid)} />
            </AutocompleteItem>)}
          </AutocompleteList>
          {!games.length && <p role="status" className="search-status">{error || (loading || !query ? "Loading search…" : "No matching games.")}</p>}
        </AutocompleteContent>
      </Autocomplete>
    </div>
    </ViewTransition>
  </div></header>;
}

function SearchRow({ title, detail }: { title: string; detail?: SearchDetail }) {
  const rating = detail && steamRating(detail.review_positive_pct, detail.review_count);
  const year = detail?.release_date?.slice(0, 4);
  return <>
    <span className="search-art">{detail?.header_image && <Image src={detail.header_image} alt="" width={92} height={43} />}</span>
    <span className="search-text">
      <span className="search-title">{title}</span>
      {(year || rating) && <span className="search-meta">
        {year && <span>{year}</span>}
        {rating && <span><strong>{detail.review_positive_pct}%</strong> {rating}</span>}
      </span>}
    </span>
  </>;
}
