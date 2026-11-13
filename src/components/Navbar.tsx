"use client";
import { ArrowUpRight, Search } from "lucide-react";
import { ControllerMark } from "./ControllerMark";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGameSearch } from "@/lib/use-game-search";

export function Navbar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { games, loading, error, search } = useGameSearch();
  return <header className="site-nav">
    <Link href="/" className="wordmark"><ControllerMark /><span>indiefindr</span></Link>
    <form className="site-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onSubmit={event => { event.preventDefault(); if (games[active]) { setOpen(false); router.push(`/games/${games[active].appid}`); } }}>
      <label htmlFor="game-search" className="sr-only">Search games</label>
      <div className="search-box"><Search size={18} className="text-muted-foreground shrink-0" />
        <input id="game-search" placeholder="Search any game…" value={query} autoComplete="off"
          role="combobox" aria-autocomplete="list" aria-expanded={open && !!query} aria-controls="search-results"
          aria-activedescendant={open && games[active] ? `search-game-${games[active].appid}` : undefined}
          onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); setActive(0); search(event.target.value); }}
          onKeyDown={event => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "ArrowDown" && games.length) { event.preventDefault(); setOpen(true); setActive(index => (index + 1) % games.length); }
            if (event.key === "ArrowUp" && games.length) { event.preventDefault(); setActive(index => (index - 1 + games.length) % games.length); }
          }} />
        <button aria-label="Open selected game"><ArrowUpRight size={18} /></button>
      </div>
      {open && query && <div className="search-results" id="search-results" role="listbox" aria-label="Games">
        {games.map((game,index) => <Link key={game.appid} id={`search-game-${game.appid}`} role="option" aria-selected={index === active}
          href={`/games/${game.appid}`} prefetch={true} onMouseEnter={() => setActive(index)} onClick={() => setOpen(false)}>{game.title}</Link>)}
        {!games.length && <p role="status" className="p-3 text-sm text-muted-foreground">{error || (loading ? "Loading search…" : "No matching games.")}</p>}
      </div>}
    </form>
  </header>;
}
