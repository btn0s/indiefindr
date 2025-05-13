import Link from "next/link";
import { Send, SearchIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AuthButton from "@/components/header-auth";

export function TopNav() {
  // Handler for submitting the game form
  const handleSubmitGame = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
      <div className="container max-w-5xl mx-auto flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold">IndieFindr</span>
        </Link>

        {/* Search Form */}
        <form
          action="/search"
          method="GET"
          className="hidden sm:flex flex-grow max-w-sm gap-2 mx-4"
        >
          <Input
            type="search"
            name="q" // Query parameter name
            placeholder="Search games by title..."
            className="flex-grow"
            aria-label="Search games by title"
          />
        </form>

        {/* Auth Button and Submit Game Button */}
        <div className="flex items-center gap-2">
          <AuthButton />
          {/* Only show Submit Game button if user is logged in */}

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Submit Game">
                <Send className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Submit a New Game</DialogTitle>
                <DialogDescription>
                  Enter the Steam Store page URL for the game you want to add.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmitGame}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="steam-url" className="text-right">
                      Steam URL
                    </Label>
                    <Input />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Submit Game</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
