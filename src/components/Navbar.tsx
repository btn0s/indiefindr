"use client";

import { ArrowUpRight, Gamepad2, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function Navbar() {
  const [query, setQuery] = useState("");
  const [games, setGames] = useState<{ appid: number; title: string }[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return (
    <header className="site-nav">
      <Link href="/" className="wordmark"><span className="brand-mark"><Gamepad2 size={21} /></span>indiefindr<span className="text-[#7f925a]">.</span></Link>
      <form className="site-search" onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          const response = await fetch(`/api/games/search?q=${encodeURIComponent(query)}`);
          if (!response.ok) throw new Error("Search unavailable");
          const body = await response.json();
          setGames(body.data?.db || []);
        } catch {
          setError("Search is unavailable. Please try again.");
        } finally {
          setPending(false);
        }
      }}>
        <label htmlFor="game-search" className="sr-only">Search games</label>
        <div className="search-box"><Search size={18} className="text-muted-foreground shrink-0" />
          <input id="game-search" placeholder="A game you love…" value={query}
            onChange={(event) => setQuery(event.target.value)} />
          <button aria-label={pending ? "Searching" : "Search games"} disabled={pending}><ArrowUpRight size={18} /></button>
        </div>
        {error && <p role="status">{error}</p>}
        {games.length > 0 && <div className="search-results">{games.map((game) => (
          <Link key={game.appid} href={`/games/${game.appid}`} prefetch={true} onClick={() => setGames([])}>
            {game.title}
          </Link>
        ))}</div>}

      </form>
    </header>
  );
}
