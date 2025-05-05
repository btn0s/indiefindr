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
          <Button className="bg-slate-800 hover:bg-slate-700 text-white border-none shadow-md">
            <span className="flex items-center gap-2">
              <SearchIcon size={18} />
              Submit New Find
            </span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-lg border shadow-lg">
          <div className="bg-slate-900 p-6 text-white">
            <DialogHeader className="text-left space-y-2">
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <GamepadIcon className="h-6 w-6" />
                Submit New Find
              </DialogTitle>
              <DialogDescription className="text-slate-300 text-base">
                Enter a URL related to an indie game for analysis
              </DialogDescription>
            </DialogHeader>
          </div>

          <form
            onSubmit={handleLocalSubmit}
            className="flex flex-col gap-4 p-2"
          >
            {error && (
              <div className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <AlertCircleIcon size={18} />
                <p>{error}</p>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div className="relative flex flex-col gap-2">
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

              <div className="bg-slate-100 rounded-lg p-4 text-xs text-slate-600">
                <p className="font-medium mb-2">Example URLs:</p>
                <div className="space-y-3">
                  <div>
                    <div className="text-slate-700 mb-1">Steam Page:</div>
                    <code className="block bg-white p-2 rounded border border-slate-200 overflow-hidden text-ellipsis">
                      https://store.steampowered.com/app/1551360/Stardew_Valley/
                    </code>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex justify-between items-center pt-4 border-t border-slate-200">
              <DialogClose asChild>
                <Button variant="outline" type="button" className="gap-2">
                  <XIcon size={16} />
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-slate-800 hover:bg-slate-700 gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <SearchIcon size={16} />
                    Analyze URL
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
