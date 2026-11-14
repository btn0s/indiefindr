"use client";
import { Autocomplete, AutocompleteContent, AutocompleteInput, AutocompleteItem, AutocompleteLabel, AutocompleteList } from "@ui-sdk/react/autocomplete";
import { Button } from "@ui-sdk/react/button";
import { ArrowUpRight, Search } from "lucide-react";
import { SwordMark } from "./SwordMark";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useGameSearch, type SearchGame } from "@/lib/use-game-search";
import { steamRating } from "@/lib/rating";

export function Navbar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { games, loading, error, search } = useGameSearch();
  const navigate = (value: string) => {
    const game = games.find(game => String(game.appid) === value || game.name.toLocaleLowerCase() === value.toLocaleLowerCase()) ?? games[0];
    if (game) { setOpen(false); router.push(`/games/${game.appid}`); }
  };
  return <header className="site-header"><div className="site-nav">
    <Link href="/" className="wordmark"><SwordMark /><span>indiefindr</span></Link>
    <div className="site-search" data-open={open}>
      <Autocomplete presentation="popover" modal={false} value={query} open={open} filter={false} autoHighlight openOnFocus loop submitOnSelect
        onOpenChange={setOpen}
        onValueChange={(value, detail) => { if (detail.reason === "item-press") { navigate(value); return; } setQuery(value); search(value); }}
        onSubmit={navigate}>
        <AutocompleteLabel htmlFor="game-search" className="sr-only">Search games</AutocompleteLabel>
        <div className="search-box"><Search size={18} className="text-muted-foreground shrink-0" />
          <AutocompleteInput aria-label="Search games" id="game-search" placeholder="Search games…" autoComplete="off" onFocus={() => { if (!query) search(""); }} />
          <Button aria-label="Open selected game" onClick={() => { if (games[0]) navigate(String(games[0].appid)); }}><ArrowUpRight size={18} /></Button>
        </div>
        {open && <Button className="search-cancel" onClick={() => { setOpen(false); setQuery(""); }}>Cancel</Button>}
        <AutocompleteContent className="search-results" anchor=".site-search" sideOffset={8}>
          {!query && games.length > 0 && <p className="search-label" aria-hidden="true">Popular indies</p>}
          <AutocompleteList>
            {games.map(game => <AutocompleteItem key={game.appid} value={String(game.appid)} label={game.name}
              render={<Link href={`/games/${game.appid}`} prefetch onClick={() => setOpen(false)} />}>
              <SearchRow game={game} />
            </AutocompleteItem>)}
          </AutocompleteList>
          {!games.length && <p role="status" className="search-status">{error || (loading || !query ? "Loading search…" : "No matching games.")}</p>}
        </AutocompleteContent>
      </Autocomplete>
    </div>
  </div></header>;
}

function SearchRow({ game }: { game: SearchGame }) {
  const rating = steamRating(game.review_percent, game.review_count);
  return <>
    <span className="search-art">{game.header_image && <Image src={game.header_image} alt="" width={92} height={43} />}</span>
    <span className="search-text">
      <span className="search-title">{game.name}</span>
      {(game.year || rating) && <span className="search-meta">
        {game.year && <span>{game.year}</span>}
        {rating && <span><strong>{game.review_percent}%</strong> {rating}</span>}
      </span>}
    </span>
  </>;
}
