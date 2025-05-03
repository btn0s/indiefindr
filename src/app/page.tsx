"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { DetailedIndieGameReport } from "@/schema";
import { Button } from "@/components/ui/button";
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

  const groupLinksByType = (
    links: DetailedIndieGameReport["relevantLinks"]
  ) => {
    if (!links) return {};
    return links.reduce((acc, link) => {
      if (!link || !link.type || !link.url) return acc;
      const type = link.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(link);
      return acc;
    }, {} as { [key: string]: typeof links });
  };

  const groupedLinks = resultData
    ? groupLinksByType(resultData.relevantLinks)
    : {};

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
          <span className="text-xs text-muted-foreground text-center">
            Example: https://x.com/Just_Game_Dev/status/1918036677609521466
          </span>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Gathering Info..." : "Analyze Tweet"}
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
            <section>
              <h2 className="text-xl font-semibold border-b pb-2 mb-3">
                Report Summary
              </h2>
              {resultData.overallReportSummary && (
                <p className="text-sm mb-3">
                  {resultData.overallReportSummary}
                </p>
              )}
              {resultData.aiConfidenceAssessment && (
                <p className="text-xs text-muted-foreground italic">
                  AI Confidence: {resultData.aiConfidenceAssessment}
                </p>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold border-b pb-2 mb-3">
                Core Information
              </h2>
              <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                {resultData.gameName && (
                  <div>
                    <dt className="font-medium text-muted-foreground">
                      Game Name:
                    </dt>
                    <dd className="font-semibold text-lg">
                      {resultData.gameName}
                    </dd>
                  </div>
                )}
                {resultData.developerName && (
                  <div>
                    <dt className="font-medium text-muted-foreground">
                      Developer:
                    </dt>
                    <dd>{resultData.developerName}</dd>
                  </div>
                )}
                {resultData.publisherName && (
                  <div>
                    <dt className="font-medium text-muted-foreground">
                      Publisher:
                    </dt>
                    <dd>{resultData.publisherName}</dd>
                  </div>
                )}
              </dl>
            </section>

            <section>
              <h2 className="text-xl font-semibold border-b pb-2 mb-3">
                Details & Background
              </h2>
              {resultData.gameDescription && (
                <div className="pt-2">
                  <h3 className="font-medium text-base mb-1">
                    Game Description:
                  </h3>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                    {resultData.gameDescription}
                  </p>
                </div>
              )}
              {resultData.developerBackground && (
                <div className="pt-3">
                  <h3 className="font-medium text-base mb-1">
                    Developer Background:
                  </h3>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                    {resultData.developerBackground}
                  </p>
                </div>
              )}
              {resultData.publisherInfo && (
                <div className="pt-3">
                  <h3 className="font-medium text-base mb-1">
                    Publisher Info:
                  </h3>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                    {resultData.publisherInfo}
                  </p>
                </div>
              )}
              {resultData.fundingInfo && (
                <div className="pt-3">
                  <h3 className="font-medium text-base mb-1">Funding Info:</h3>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                    {resultData.fundingInfo}
                  </p>
                </div>
              )}
              {resultData.releaseInfo && (
                <div className="pt-3">
                  <h3 className="font-medium text-base mb-1">Release Info:</h3>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">
                    {resultData.releaseInfo}
                  </p>
                </div>
              )}
              {resultData.genresAndTags &&
                resultData.genresAndTags.length > 0 && (
                  <div className="pt-3">
                    <h3 className="font-medium text-base mb-1">
                      Genres & Tags:
                    </h3>
                    <div className="flex flex-wrap gap-1">
                      {resultData.genresAndTags.map((item, index) => (
                        <span
                          key={index}
                          className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              {resultData.teamMembers && resultData.teamMembers.length > 0 && (
                <div className="pt-3">
                  <h3 className="font-medium text-base mb-1">Team Members:</h3>
                  <ul className="list-disc list-inside text-sm space-y-1 pl-4">
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
            </section>

            <section>
              <h2 className="text-xl font-semibold border-b pb-2 mb-3">
                Relevant Links
              </h2>
              {Object.keys(groupedLinks).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                  {Object.entries(groupedLinks).map(([type, links]) => (
                    <div key={type}>
                      <h3 className="font-medium text-muted-foreground mb-1">
                        {type}
                      </h3>
                      <ul className="list-none space-y-1">
                        {(
                          links as DetailedIndieGameReport["relevantLinks"]
                        )?.map((link, index) => (
                          <li key={index}>
                            <a
                              href={link?.url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline break-all"
                            >
                              {link?.name || link?.url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No relevant links found.
                </p>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold border-b pb-2 mb-3">
                Source Data (for Debugging)
              </h2>
              {resultData.sourceTweetText && (
                <div className="pt-2">
                  <h3 className="font-medium text-sm">Source Tweet:</h3>
                  <p className="text-xs whitespace-pre-wrap bg-muted p-2 rounded font-mono">
                    {resultData.sourceTweetText}
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
