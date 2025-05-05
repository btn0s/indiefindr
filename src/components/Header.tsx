"use client";

import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { SubmitGameDialog } from "./SubmitGameDialog";
import { Button } from "./ui/button";
export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center max-w-5xl mx-auto px-4 justify-between">
        <div className="mr-4 flex">
          <Link href="/">
            <span className="font-bold sm:inline-block">IndieFindr</span>
          </Link>
        </div>

        <nav className="flex items-center gap-2">
          {/* Search link added here */}
          <Button variant="outline" asChild>
            <Link
              href="/search"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <SearchIcon className="size-4" />
              Search
            </Link>
          </Button>
          <SubmitGameDialog />
        </nav>
      </div>
    </header>
  );
}
