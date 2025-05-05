"use client"; // Needed because SubmitGameDialog is a client component

import Link from "next/link";
import { SubmitGameDialog } from "./SubmitGameDialog";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center max-w-5xl mx-auto px-4">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            {/* <Icons.logo className="h-6 w-6" /> Optional Logo */}
            <span className="font-bold sm:inline-block">IndieFindr</span>
          </Link>
          {/* Add other nav links here if needed */}
          {/* <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link href="/about">About</Link>
          </nav> */}
        </div>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-4">
            {/* Search link added here */}
            <Link
              href="/search"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Search
            </Link>
            {/* Submit button moves to the right */}
            <SubmitGameDialog />
            {/* Add Theme Toggle or User Auth later */}
          </nav>
        </div>
      </div>
    </header>
  );
}
