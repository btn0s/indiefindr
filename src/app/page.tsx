"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { DetailedIndieGameReport } from "@/schema";
import { Button } from "@/components/ui/button";
import { IndieGameReport } from "@/components/IndieGameReport";

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [resultData, setResultData] = useState<DetailedIndieGameReport | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResultData(null);

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
      setResultData(data);
    } catch (err: any) {
      setError(err);
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 bg-background text-foreground">
      <div className="w-full max-w-5xl space-y-6">
        <h1 className="text-3xl font-bold text-center">Indie Game Deep Dive</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <Input
            type="url"
            name="url"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Enter Tweet URL (e.g., https://x.com/...)"
            required
            className="w-full"
            disabled={isLoading}
          />
          <span className="text-xs text-muted-foreground mb-2">
            Try: https://x.com/Just_Game_Dev/status/1918036677609521466
          </span>
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? "Gathering Info... (this may take a while)"
              : "Analyze"}
          </Button>
        </form>

        {error && (
          <div className="text-red-500 border border-red-500 rounded p-3">
            <p>
              <strong>Error:</strong> {error.message}
            </p>
          </div>
        )}

        {resultData && <IndieGameReport reportData={resultData} />}
      </div>
    </div>
  );
}
