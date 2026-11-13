"use client";

import Link from "next/link";
import { useState } from "react";

export function Navbar() {
  const [query, setQuery] = useState("");
  const [games, setGames] = useState<{ appid: number; title: string }[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return (
    <header className="container mx-auto max-w-4xl p-4">
      <Link href="/" className="font-bold">IndieFindr</Link>
      <form className="relative mt-3" onSubmit={async (event) => {
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
        <input id="game-search" className="border rounded p-2 w-full"
          placeholder="Find indie games like…" value={query}
          onChange={(event) => setQuery(event.target.value)} />
        <button className="mt-2 underline" disabled={pending}>
          {pending ? "Searching…" : "Search"}
        </button>
        {error && <p role="status">{error}</p>}
        {games.map((game) => (
          <Link className="block p-2" key={game.appid} href={`/games/${game.appid}`}
            prefetch={true} onClick={() => setGames([])}>
            {game.title}
          </Link>
        ))}
      </form>
    </header>
  );
}
