import { retry } from '../../utils/retry';

const STEAM_REVIEWS_API = 'https://store.steampowered.com/appreviews';

export interface ReviewSummary {
  review_score: number;
  review_score_desc: string;
  total_positive: number;
  total_negative: number;
  total_reviews: number;
}

/**
 * Fetch review summary from Steam Reviews API
 */
export async function fetchSteamReviewSummary(
  appId: number
): Promise<ReviewSummary | null> {
  try {
    const url = `${STEAM_REVIEWS_API}/${appId}?json=1&language=all&purchase_type=all&num_per_page=0`;
    
    const response = await retry(
      async () => {
        const res = await fetch(url);
        if (!res.ok && res.status !== 404) {
          // Only throw for non-404 errors (404 means no reviews)
          throw new Error(`Steam Reviews API error: ${res.status} ${res.statusText}`);
        }
        return res;
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        retryable: (error) => {
          // Retry on network errors and 5xx/429 status codes
          if (error instanceof TypeError) return true;
          const status = parseInt(error.message?.match(/\d+/)?.[0] || '0');
          return status >= 500 || status === 429;
        },
      }
    );

    if (!response.ok) {
      // Reviews API might not be available for all games
      return null;
    }

    const data = await response.json();

    if (!data.query_summary) {
      return null;
    }

    return {
      review_score: data.query_summary.review_score || 0,
      review_score_desc: data.query_summary.review_score_desc || 'No user reviews',
      total_positive: data.query_summary.total_positive || 0,
      total_negative: data.query_summary.total_negative || 0,
      total_reviews: data.query_summary.total_reviews || 0,
    };
  } catch (error) {
    // Fail silently - reviews are optional
    console.warn(`Failed to fetch reviews for app ${appId}:`, error);
    return null;
  }
}
