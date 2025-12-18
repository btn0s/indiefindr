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
    const response = await fetch(url);

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
