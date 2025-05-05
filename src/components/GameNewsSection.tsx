import { useState, useEffect } from "react";
// Remove Card imports
// import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
// Remove unused Link import
// import Link from "next/link";
// Remove unused ExternalLinkIcon import
// import { ExternalLinkIcon } from "lucide-react";

// Remove direct API key usage
// const apiKey = process.env.RAPID_API_KEY;

// Define the expected structure of a news item from the API
interface NewsItem {
  news_title: string;
  url?: string;
  author?: string;
  content?: string;
  feed_label?: string;
  date: string;
  feed_name?: string;
  feed_type?: number;
  appid?: number;
  like?: string;
}

interface GameNewsSectionProps {
  steamAppId: string;
}

export function GameNewsSection({ steamAppId }: GameNewsSectionProps) {
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!steamAppId) {
      setLoading(false);
      setError("Steam App ID is missing.");
      return;
    }

    const fetchNews = async () => {
      setLoading(true);
      setError(null);
      setNews(null); // Clear previous news on new fetch

      // Update the URL to point to the local API route
      const url = `/api/game-news/${steamAppId}`;

      try {
        // Remove RapidAPI specific headers
        const response = await fetch(url, {
          method: "GET",
          // headers: { // <-- Remove these
          //   "x-rapidapi-host": "games-details.p.rapidapi.com",
          //   "x-rapidapi-key": apiKey || "",
          // },
        });

        if (!response.ok) {
          // Try to get a more specific error message from our API route
          let errorMsg = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData && errorData.error) {
              errorMsg = errorData.error;
            }
          } catch (jsonError) {
            // Ignore if response isn't JSON
          }
          throw new Error(errorMsg);
        }

        const newsData = await response.json();
        // The API route now returns the correct structure directly
        // const newsData = data?.data?.news || []; <-- Remove this adjustment

        if (!Array.isArray(newsData)) {
          console.error("API response is not an array:", newsData);
          throw new Error("Unexpected API response format.");
        }

        setNews(newsData);
      } catch (err) {
        console.error("Failed to fetch game news:", err);
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [steamAppId]); // Refetch when steamAppId changes

  // Helper function to truncate text
  const truncateText = (text: string | undefined, maxLength: number) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  return (
    // Replace Card with a simple div
    <div className="">
      {/* Add an h3 title like the screenshots section */}
      <h3 className="font-medium mb-2">Latest News</h3>

      {/* Keep the content rendering logic, remove CardContent wrapper */}
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600">Could not load news: {error}</p>
      )}
      {!loading && !error && news && news.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No recent news found for this game.
        </p>
      )}
      {!loading && !error && news && news.length > 0 && (
        <Carousel
          opts={{
            align: "start",
            loop: news.length > 1,
          }}
          className="w-full max-w-full"
        >
          <CarouselContent className="-ml-2">
            {news.map((item, index) => (
              <CarouselItem
                key={`news-${index}`}
                className="pl-2 md:basis-1/2 lg:basis-1/3"
              >
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="p-3 rounded-lg border bg-background h-full flex flex-col justify-between cursor-pointer hover:border-primary transition-colors">
                      <div>
                        <p className="font-medium text-sm mb-1 line-clamp-2">
                          {item.news_title}
                        </p>
                        <p className="text-xs text-muted-foreground mb-2">
                          {item.date}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {truncateText(item.content, 100)}
                        </p>
                      </div>
                      <p className="text-xs text-primary mt-2 self-start">
                        Read More
                      </p>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-h-[80vh] overflow-y-auto">
                    <DialogTitle className="mb-4">
                      {item.news_title}
                    </DialogTitle>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {item.content
                        ?.split("\n")
                        .map((paragraph, i) => <p key={i}>{paragraph}</p>) ||
                        "No content available."}
                    </div>
                  </DialogContent>
                </Dialog>
              </CarouselItem>
            ))}
          </CarouselContent>
          {news.length > 1 && (
            <>
              <CarouselPrevious className="-left-2 shadow-md top-1/2 -translate-y-1/2" />
              <CarouselNext className="-right-2 shadow-md top-1/2 -translate-y-1/2" />
            </>
          )}
        </Carousel>
      )}
    </div>
  );
}
