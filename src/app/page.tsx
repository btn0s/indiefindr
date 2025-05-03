"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { IndieDevReportSchema } from "@/schema";
import { Button } from "@/components/ui/button";
import { z } from "zod";

type IndieDevReport = z.infer<typeof IndieDevReportSchema>;

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [resultData, setResultData] = useState<IndieDevReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResultData(null);

    try {
      const messages = [{ role: "user", content: inputValue }];
      const response = await fetch("/api/gather", {
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

      const data: IndieDevReport = await response.json();
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
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-6">
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
          <span className="text-xs text-gray-500">
            example: https://x.com/Just_Game_Dev/status/1918036677609521466
          </span>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Gathering Info..." : "Analyze URL"}
          </Button>
        </form>

        {isLoading && (
          <div className="text-center text-gray-500">Loading...</div>
        )}

        {error && (
          <div className="text-red-500 border border-red-500 rounded p-3">
            <p>
              <strong>Error:</strong> {error.message}
            </p>
          </div>
        )}

        {resultData && (
          <div className="space-y-4 border rounded p-4 shadow-md">
            <h2 className="text-lg font-semibold border-b pb-2">
              Gathered Information
            </h2>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {resultData.developerName && (
                <>
                  <dt className="font-medium">Developer:</dt>
                  <dd>{resultData.developerName}</dd>
                </>
              )}
              {resultData.gameName && (
                <>
                  <dt className="font-medium">Game:</dt>
                  <dd>{resultData.gameName}</dd>
                </>
              )}
              {resultData.developerWebsiteUrl && (
                <>
                  <dt className="font-medium">Dev Website:</dt>
                  <dd>
                    <a
                      href={resultData.developerWebsiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {resultData.developerWebsiteUrl}
                    </a>
                  </dd>
                </>
              )}
              {resultData.gameWebsiteUrl && (
                <>
                  <dt className="font-medium">Game Website:</dt>
                  <dd>
                    <a
                      href={resultData.gameWebsiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {resultData.gameWebsiteUrl}
                    </a>
                  </dd>
                </>
              )}
              {resultData.steamStoreUrl && (
                <>
                  <dt className="font-medium">Steam Page:</dt>
                  <dd>
                    <a
                      href={resultData.steamStoreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {resultData.steamStoreUrl}
                    </a>
                  </dd>
                </>
              )}
              {resultData.fundingPageUrl && (
                <>
                  <dt className="font-medium">Funding Page:</dt>
                  <dd>
                    <a
                      href={resultData.fundingPageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {resultData.fundingPageUrl}
                    </a>
                  </dd>
                </>
              )}
            </dl>
            {resultData.tweetSummary && (
              <div className="pt-2">
                <h3 className="font-medium text-sm">Tweet Summary:</h3>
                <p className="text-sm whitespace-pre-wrap bg-gray-50 p-2 rounded">
                  {resultData.tweetSummary}
                </p>
              </div>
            )}
            {resultData.webSearchResultSummary && (
              <div className="pt-2">
                <h3 className="font-medium text-sm">Web Search Summary:</h3>
                <p className="text-sm whitespace-pre-wrap bg-gray-50 p-2 rounded">
                  {resultData.webSearchResultSummary}
                </p>
              </div>
            )}
            {resultData.steamDescription && (
              <div className="pt-2">
                <h3 className="font-medium text-sm">Steam Description:</h3>
                <p className="text-sm whitespace-pre-wrap bg-gray-50 p-2 rounded">
                  {resultData.steamDescription}
                </p>
              </div>
            )}
            {resultData.steamTags && (
              <div className="pt-2">
                <h3 className="font-medium text-sm">Steam Tags:</h3>
                <p className="text-sm whitespace-pre-wrap bg-gray-50 p-2 rounded">
                  {resultData.steamTags}
                </p>
              </div>
            )}
            {resultData.overallSummary && (
              <div className="pt-4 border-t mt-4">
                <h3 className="font-semibold">Overall Summary:</h3>
                <p className="text-sm whitespace-pre-wrap">
                  {resultData.overallSummary}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
