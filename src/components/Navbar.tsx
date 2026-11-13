"use client";
import { ArrowUpRight, Search } from "lucide-react";
import { ControllerMark } from "./ControllerMark";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useGameSearch, type SearchDetail } from "@/lib/use-game-search";
import { steamRating } from "@/lib/rating";

const PHONE = "(max-width: 700px)";

export function Navbar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { games, details, loading, error, search } = useGameSearch();
  const close = () => { setOpen(false); (document.activeElement as HTMLElement | null)?.blur(); };
  return <header className="site-header"><div className="site-nav">
    <Link href="/" className="wordmark"><ControllerMark /><span>indiefindr</span></Link>
    {/* On phones the open search becomes a full-screen sheet; dismissing the keyboard keeps it open. */}
    <form className="site-search" data-open={open} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget) && !matchMedia(PHONE).matches) setOpen(false); }}
      onSubmit={event => { event.preventDefault(); if (games[active]) { setOpen(false); router.push(`/games/${games[active].appid}`); } }}>
      <label htmlFor="game-search" className="sr-only">Search games</label>
      <div className="search-box"><Search size={18} className="text-muted-foreground shrink-0" />
        <input id="game-search" placeholder="Search games…" value={query} autoComplete="off"
          role="combobox" aria-autocomplete="list" aria-expanded={open && !!query} aria-controls="search-results"
          aria-activedescendant={open && games[active] ? `search-game-${games[active].appid}` : undefined}
          onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); setActive(0); search(event.target.value); }}
          onKeyDown={event => {
            if (event.key === "Escape") close();
            if (event.key === "ArrowDown" && games.length) { event.preventDefault(); setOpen(true); setActive(index => (index + 1) % games.length); }
            if (event.key === "ArrowUp" && games.length) { event.preventDefault(); setActive(index => (index - 1 + games.length) % games.length); }
          }} />
        <button aria-label="Open selected game"><ArrowUpRight size={18} /></button>
      </div>
      {open && <button type="button" className="search-cancel" onClick={() => { close(); setQuery(""); search(""); }}>Cancel</button>}
      {open && !query && <p className="search-hint">Type a game you love.</p>}
      {open && query && <div className="search-results" id="search-results" role="listbox" aria-label="Games">
        {games.map((game,index) => <Link key={game.appid} id={`search-game-${game.appid}`} role="option" aria-selected={index === active}
          href={`/games/${game.appid}`} prefetch={true} onMouseEnter={() => setActive(index)} onClick={() => setOpen(false)}>
          <SearchRow title={game.title} detail={details.get(game.appid)} />
        </Link>)}
        {!games.length && <p role="status" className="search-status">{error || (loading ? "Loading search…" : "No matching games.")}</p>}
      </div>}
    </form>
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
