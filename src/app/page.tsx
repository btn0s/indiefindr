"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { GameLandingPageSchema, GameLandingPageData } from "@/schema";
import { Button } from "@/components/ui/button";
import { z } from "zod";

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [resultData, setResultData] = useState<GameLandingPageData | null>(
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

      const data: GameLandingPageData = await response.json();
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
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold text-center">Indie Game Finder</h1>
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
          <span className="text-xs text-muted-foreground text-center">
            Example: https://x.com/Just_Game_Dev/status/1918036677609521466
          </span>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Gathering Info..." : "Analyze URL"}
          </Button>
        </form>

        {isLoading && (
          <div className="text-center text-muted-foreground">Loading...</div>
        )}

        {error && (
          <div className="text-red-500 border border-red-500 rounded p-3">
            <p>
              <strong>Error:</strong> {error.message}
            </p>
          </div>
        )}

        {resultData && (
          <div className="space-y-6 border rounded p-4 md:p-6 shadow-lg bg-card text-card-foreground">
            {/* --- Game Info Section --- */}
            <section>
              <h2 className="text-xl font-semibold border-b pb-2 mb-3">
                Game Information
              </h2>
              <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                {resultData.gameName && (
                  <div className="md:col-span-2">
                    <dt className="font-medium">Game Name:</dt>
                    <dd className="text-lg font-bold">{resultData.gameName}</dd>
                  </div>
                )}
                {resultData.tagline && (
                  <div className="md:col-span-1">
                    <dt className="font-medium">Tagline:</dt>
                    <dd className="italic text-muted-foreground">
                      {resultData.tagline}
                    </dd>
                  </div>
                )}
                {resultData.releaseStatus && (
                  <div>
                    <dt className="font-medium">Status:</dt>
                    <dd>{resultData.releaseStatus}</dd>
                  </div>
                )}
                {resultData.releaseDate && (
                  <div>
                    <dt className="font-medium">Release Date:</dt>
                    <dd>{resultData.releaseDate}</dd>
                  </div>
                )}
                {resultData.price && (
                  <div>
                    <dt className="font-medium">Price:</dt>
                    <dd>{resultData.price}</dd>
                  </div>
                )}
                {resultData.officialWebsiteUrl && (
                  <div>
                    <dt className="font-medium">Game Website:</dt>
                    <dd>
                      <a
                        href={resultData.officialWebsiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        {resultData.officialWebsiteUrl}
                      </a>
                    </dd>
                  </div>
                )}
                {resultData.steamStoreUrl && (
                  <div>
                    <dt className="font-medium">Steam Page:</dt>
                    <dd>
                      <a
                        href={resultData.steamStoreUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        {resultData.steamStoreUrl}
                      </a>
                    </dd>
                  </div>
                )}
                {resultData.trailerVideoUrl && (
                  <div>
                    <dt className="font-medium">Trailer:</dt>
                    <dd>
                      <a
                        href={resultData.trailerVideoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        Watch Trailer
                      </a>
                    </dd>
                  </div>
                )}
              </dl>

              {resultData.shortDescription && (
                <div className="pt-3">
                  <h3 className="font-medium text-sm">Short Description:</h3>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-2 rounded">
                    {resultData.shortDescription}
                  </p>
                </div>
              )}
              {resultData.detailedDescription && (
                <div className="pt-3">
                  <h3 className="font-medium text-sm">Detailed Description:</h3>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-2 rounded">
                    {resultData.detailedDescription}
                  </p>
                </div>
              )}
              {resultData.keyFeatures && resultData.keyFeatures.length > 0 && (
                <div className="pt-3">
                  <h3 className="font-medium text-sm">Key Features:</h3>
                  <ul className="list-disc list-inside text-sm bg-muted p-2 rounded">
                    {resultData.keyFeatures.map((feature, index) => (
                      <li key={index}>{feature}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="pt-3 grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                {resultData.genres && resultData.genres.length > 0 && (
                  <div>
                    <dt className="font-medium">Genres:</dt>
                    <dd className="flex flex-wrap gap-1">
                      {resultData.genres.map((genre, index) => (
                        <span
                          key={index}
                          className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs"
                        >
                          {genre}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                {resultData.tags && resultData.tags.length > 0 && (
                  <div>
                    <dt className="font-medium">Tags:</dt>
                    <dd className="flex flex-wrap gap-1">
                      {resultData.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                {resultData.platforms && resultData.platforms.length > 0 && (
                  <div>
                    <dt className="font-medium">Platforms:</dt>
                    <dd className="flex flex-wrap gap-1">
                      {resultData.platforms.map((platform, index) => (
                        <span
                          key={index}
                          className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs"
                        >
                          {platform}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
              </div>
              {resultData.otherStoreUrls &&
                resultData.otherStoreUrls.length > 0 && (
                  <div className="pt-3">
                    <h3 className="font-medium text-sm">Other Stores:</h3>
                    <ul className="list-none text-sm space-y-1">
                      {resultData.otherStoreUrls.map((store, index) => (
                        <li key={index}>
                          <span className="font-semibold">{store.name}:</span>{" "}
                          <a
                            href={store.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline break-all"
                          >
                            {store.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              {resultData.screenshotUrls &&
                resultData.screenshotUrls.length > 0 && (
                  <div className="pt-3">
                    <h3 className="font-medium text-sm">Screenshots:</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                      {resultData.screenshotUrls.map((url, index) => (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={url}
                            alt={`Screenshot ${index + 1}`}
                            className="rounded shadow hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
            </section>

            {/* --- Developer Info Section --- */}
            <section>
              <h2 className="text-xl font-semibold border-b pb-2 mb-3">
                Developer Information
              </h2>
              <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                {resultData.developerName && (
                  <div>
                    <dt className="font-medium">Developer:</dt>
                    <dd>{resultData.developerName}</dd>
                  </div>
                )}
                {resultData.developerWebsiteUrl && (
                  <div>
                    <dt className="font-medium">Dev Website:</dt>
                    <dd>
                      <a
                        href={resultData.developerWebsiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        {resultData.developerWebsiteUrl}
                      </a>
                    </dd>
                  </div>
                )}
                {resultData.developerLocation && (
                  <div>
                    <dt className="font-medium">Location:</dt>
                    <dd>{resultData.developerLocation}</dd>
                  </div>
                )}
              </dl>
              {resultData.teamBackground && (
                <div className="pt-3">
                  <h3 className="font-medium text-sm">Team Background:</h3>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-2 rounded">
                    {resultData.teamBackground}
                  </p>
                </div>
              )}
              {resultData.teamMembers && resultData.teamMembers.length > 0 && (
                <div className="pt-3">
                  <h3 className="font-medium text-sm">Team Members:</h3>
                  <ul className="list-none text-sm space-y-1">
                    {resultData.teamMembers.map((member, index) => (
                      <li key={index}>
                        <span className="font-semibold">
                          {member.name || "N/A"}:
                        </span>{" "}
                        {member.role || "N/A"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {resultData.socialMediaLinks &&
                resultData.socialMediaLinks.length > 0 && (
                  <div className="pt-3">
                    <h3 className="font-medium text-sm">Social Media:</h3>
                    <ul className="list-none text-sm space-y-1">
                      {resultData.socialMediaLinks.map((link, index) => (
                        <li key={index}>
                          <span className="font-semibold">
                            {link.platform}:
                          </span>{" "}
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline break-all"
                          >
                            {link.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </section>

            {/* --- Community & Funding Section --- */}
            <section>
              <h2 className="text-xl font-semibold border-b pb-2 mb-3">
                Community & Funding
              </h2>
              <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                {resultData.pressKitUrl && (
                  <div>
                    <dt className="font-medium">Press Kit:</dt>
                    <dd>
                      <a
                        href={resultData.pressKitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        Link
                      </a>
                    </dd>
                  </div>
                )}
                {resultData.discordInviteUrl && (
                  <div>
                    <dt className="font-medium">Discord:</dt>
                    <dd>
                      <a
                        href={resultData.discordInviteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        Invite Link
                      </a>
                    </dd>
                  </div>
                )}
                {resultData.subredditUrl && (
                  <div>
                    <dt className="font-medium">Subreddit:</dt>
                    <dd>
                      <a
                        href={resultData.subredditUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        Link
                      </a>
                    </dd>
                  </div>
                )}
                {resultData.fundingStatus && (
                  <div>
                    <dt className="font-medium">Funding Status:</dt>
                    <dd>{resultData.fundingStatus}</dd>
                  </div>
                )}
                {resultData.fundingPageUrl && (
                  <div>
                    <dt className="font-medium">Funding Page:</dt>
                    <dd>
                      <a
                        href={resultData.fundingPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline break-all"
                      >
                        {resultData.fundingPageUrl}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
              {resultData.otherCommunityLinks &&
                resultData.otherCommunityLinks.length > 0 && (
                  <div className="pt-3">
                    <h3 className="font-medium text-sm">
                      Other Community Links:
                    </h3>
                    <ul className="list-none text-sm space-y-1">
                      {resultData.otherCommunityLinks.map((link, index) => (
                        <li key={index}>
                          <span className="font-semibold">{link.name}:</span>{" "}
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline break-all"
                          >
                            {link.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </section>

            {/* --- Raw/Debug Info Section (Optional) --- */}
            <section>
              <h2 className="text-xl font-semibold border-b pb-2 mb-3">
                Source Data & Summaries
              </h2>
              {resultData.tweetSummary && (
                <div className="pt-2">
                  <h3 className="font-medium text-sm">Tweet Summary:</h3>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-2 rounded">
                    {resultData.tweetSummary}
                  </p>
                </div>
              )}
              {resultData.initialWebSearchSummary && (
                <div className="pt-2">
                  <h3 className="font-medium text-sm">
                    Web Search Summary (AI):
                  </h3>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-2 rounded">
                    {resultData.initialWebSearchSummary}
                  </p>
                </div>
              )}
              {resultData.scrapedSteamDescription && (
                <div className="pt-2">
                  <h3 className="font-medium text-sm">Scraped Steam Desc:</h3>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-2 rounded">
                    {resultData.scrapedSteamDescription}
                  </p>
                </div>
              )}
              {resultData.scrapedSteamTags && (
                <div className="pt-2">
                  <h3 className="font-medium text-sm">Scraped Steam Tags:</h3>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-2 rounded">
                    {resultData.scrapedSteamTags}
                  </p>
                </div>
              )}
              {resultData.overallSummary && (
                <div className="pt-4 border-t mt-4">
                  <h3 className="font-semibold">Overall Summary (AI):</h3>
                  <p className="text-sm whitespace-pre-wrap">
                    {resultData.overallSummary}
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
