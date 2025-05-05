"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function HeroSearchForm() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  // Placeholder suggestions
  const suggestions = [
    "a cozy farming sim...",
    "a fast-paced roguelike...",
    "a narrative adventure...",
    "a challenging puzzle game...",
    "a retro-style platformer...",
  ];
  const [placeholder, setPlaceholder] = useState(suggestions[0]);

  useEffect(() => {
    // Rotate placeholders
    let index = 0;
    const intervalId = setInterval(() => {
      index = (index + 1) % suggestions.length;
      setPlaceholder(suggestions[index]);
    }, 3000); // Change every 3 seconds

    return () => clearInterval(intervalId); // Cleanup interval on component unmount
  }, []); // Empty dependency array ensures this runs only once on mount

  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?query=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <form
      onSubmit={handleSearchSubmit}
      className="flex w-full max-w-md items-center space-x-2"
    >
      <Input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={placeholder} // Use dynamic placeholder
        className="flex-grow bg-background" // Make input take available space
      />
      <Button type="submit">Search</Button>
    </form>
  );
}
