"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Import icons
import {
  Gamepad as GamepadIcon,
  Link as LinkIcon,
  Search as SearchIcon,
  X as XIcon,
  AlertCircle as AlertCircleIcon,
  ArrowBigLeftDash,
  ArrowRight,
} from "lucide-react";

const isDev = process.env.NODE_ENV === "development";

export function SubmitGameDialog() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleLocalSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const messages = [{ role: "user", content: inputValue }];
      const response = await fetch("/api/find-simple", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      setIsOpen(false);
      setInputValue("");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
      console.error("Submit error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setError(null);
      setInputValue("");
    }
    setIsOpen(open);
  };

  if (!isDev) {
    return null;
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button>
            <span className="flex items-center gap-2">
              <GamepadIcon className="size-4" />
              Submit New Find
            </span>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GamepadIcon className="size-4" />
              Submit New Find
            </DialogTitle>
            <DialogDescription>
              Drop in a Steam page URL and hit submit.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleLocalSubmit}
            className="flex flex-col gap-4 py-2"
          >
            {error && (
              <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <AlertCircleIcon size={18} />
                <p>{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                name="url"
                type="url"
                value={inputValue}
                onChange={handleInputChange}
                placeholder="https://store.steampowered.com/app/12345"
                required
                disabled={isLoading}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" type="button" className="gap-2">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isLoading} className="gap-2">
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                    Analyzing...
                  </>
                ) : (
                  <>Submit game</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
