"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DetailedIndieGameReport } from "@/schema";

interface SubmitGameDialogProps {
  onSuccess: (data: DetailedIndieGameReport) => void;
  onError: (error: Error) => void;
  onLoadingChange: (loading: boolean) => void;
}

export function SubmitGameDialog({
  onSuccess,
  onError,
  onLoadingChange,
}: SubmitGameDialogProps) {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // Control dialog visibility

  const handleLocalSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    onLoadingChange(true); // Notify parent

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

      const data: DetailedIndieGameReport = await response.json();
      onSuccess(data);
      setIsOpen(false); // Close dialog on success
      setInputValue(""); // Clear input
    } catch (err: any) {
      onError(err);
      // Keep dialog open on error? Or close? Let's keep it open for now.
      console.error("Submit error:", err);
    } finally {
      setIsLoading(false);
      onLoadingChange(false); // Notify parent
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Analyzing..." : "Submit"}
            </Button>
          </DialogFooter>
        </form>
        <p className="text-xs text-muted-foreground text-center">
          Example: https://x.com/Just_Game_Dev/status/1918036677609521466
        </p>
      </DialogContent>
    </Dialog>
  );
}
