import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import AuthButton from "@/components/header-auth";
import { SubmitGameDialog } from "@/components/nav/submit-game-dialog";

export async function TopNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
      <div className="container max-w-5xl mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2 flex-1 sm:flex-none sm:w-1/4">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">IndieFindr</span>
          </Link>
        </div>

        <form
          action="/search"
          method="GET"
          className="hidden sm:flex flex-grow max-w-sm gap-2 mx-4"
        >
          <Input
            type="search"
            name="q"
            placeholder="Search games by title..."
            className="flex-grow"
            aria-label="Search games by title"
          />
        </form>

        <div className="flex items-center gap-2 flex-1 sm:flex-none sm:w-1/4 justify-end">
          <AuthButton />
          <SubmitGameDialog />
        </div>
      </div>
    </header>
  );
}
