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
      const response = await fetch("/api/find", {
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
    }
    setIsOpen(open);
  };

  if (!isDev) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Submit New Find</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Submit New Find</DialogTitle>
          <DialogDescription>
            Enter the URL of a Tweet announcing or showcasing an indie game.
            We'll analyze it to generate a report.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleLocalSubmit} className="grid gap-4 py-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-100 border border-red-300 rounded px-3 py-2">
              <strong>Error:</strong> {error}
            </p>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="url" className="text-right">
              Tweet URL
            </Label>
            <Input
              id="url"
              name="url"
              type="url"
              value={inputValue}
              onChange={handleInputChange}
              placeholder="https://x.com/..."
              className="col-span-3"
              required
              disabled={isLoading}
            />
          </div>
          <p className="col-span-4 text-xs text-muted-foreground text-center px-4">
            Example: https://x.com/Just_Game_Dev/status/1918036677609521466
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Analyzing..." : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
